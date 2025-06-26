const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const { Bill, Payment, Customer } = require('../models');
const { Op, fn, col } = require('sequelize');

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// Get dashboard data
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Get metrics
    const metrics = await getDashboardMetrics();
    
    // Get recent payments
    const recentPayments = await Payment.findAll({
      include: [
        {
          model: Customer,
          attributes: ['firstName', 'lastName']
        },
        {
          model: Bill,
          attributes: ['billNumber']
        }
      ],
      order: [['paymentDate', 'DESC']],
      limit: 5
    });

    // Get recent bills
    const recentBills = await Bill.findAll({
      include: [
        {
          model: Customer,
          attributes: ['firstName', 'lastName']
        }
      ],
      order: [['dueDate', 'ASC']],
      limit: 5,
      where: {
        status: {
          [Op.in]: ['pending', 'overdue']
        }
      }
    });

    // Format the data for the view
    const viewData = {
      metrics,
      recentPayments: recentPayments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        customer: payment.Customer ? 
          `${payment.Customer.firstName} ${payment.Customer.lastName}` : 'N/A',
        billNumber: payment.Bill ? payment.Bill.billNumber : 'N/A'
      })),
      recentBills: recentBills.map(bill => ({
        id: bill.id,
        billNumber: bill.billNumber,
        totalAmount: bill.totalAmount,
        dueDate: bill.dueDate,
        status: bill.status,
        customer: bill.Customer ? 
          `${bill.Customer.firstName} ${bill.Customer.lastName}` : 'N/A'
      }))
    };

    res.render('dashboard', viewData);
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error_msg', 'Error loading dashboard data');
    res.redirect('/');
  }
});

// Helper function to get dashboard metrics
async function getDashboardMetrics() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Get total customers
  const totalCustomers = await Customer.count();

  // Get bills summary
  const [billsSummary, monthlyRevenue] = await Promise.all([
    // Get bills summary
    Bill.findAll({
      attributes: [
        'status',
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('totalAmount')), 'totalAmount']
      ],
      group: ['status'],
      raw: true
    }),
    
    // Get monthly revenue
    Payment.sum('amount', {
      where: {
        status: 'completed',
        paymentDate: {
          [Op.between]: [startOfMonth, endOfMonth]
        }
      }
    })
  ]);

  // Calculate pending and overdue bills
  const pendingBills = billsSummary.find(b => b.status === 'pending') || { count: 0, totalAmount: 0 };
  const overdueBills = billsSummary.find(b => b.status === 'overdue') || { count: 0, totalAmount: 0 };

  return {
    totalCustomers,
    pendingBills: {
      count: parseInt(pendingBills.count),
      amount: parseFloat(pendingBills.totalAmount || 0)
    },
    overdueBills: {
      count: parseInt(overdueBills.count),
      amount: parseFloat(overdueBills.totalAmount || 0)
    },
    monthlyRevenue: parseFloat(monthlyRevenue || 0)
  };
}

module.exports = router;
