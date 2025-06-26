const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureStaff } = require('../middleware/auth');
const { Customer, Bill, Payment, sequelize } = require('../models');
const { Op, QueryTypes } = require('sequelize');
const moment = require('moment');
const ExcelJS = require('exceljs');

// Generate financial report
router.get('/financial', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    // Set default date range (last 30 days)
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    
    const start = startDate ? new Date(startDate) : defaultStartDate;
    const end = endDate ? new Date(endDate) : defaultEndDate;
    
    // Format dates for display
    const formattedStartDate = start.toISOString().split('T')[0];
    const formattedEndDate = end.toISOString().split('T')[0];
    
    // Build where clause
    const whereClause = {
      paymentDate: {
        [Op.gte]: start,
        [Op.lte]: end
      },
      status: 'completed'
    };
    
    if (type && type !== 'all') {
      whereClause['$bill.billType$'] = type;
    }
    
    // Get payments with related bill and customer data
    const payments = await Payment.findAll({
      where: whereClause,
      include: [
        {
          model: Bill,
          as: 'bill',
          include: [
            {
              model: Customer,
              as: 'customer',
              attributes: ['id', 'firstName', 'lastName', 'customerId']
            }
          ]
        }
      ],
      order: [['paymentDate', 'DESC']]
    });
    
    // Calculate totals
    const totalAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    const totalPayments = payments.length;
    
    // Group by payment method
    const paymentMethods = {};
    payments.forEach(payment => {
      const method = payment.paymentMethod || 'other';
      paymentMethods[method] = (paymentMethods[method] || 0) + parseFloat(payment.amount);
    });
    
    // Get monthly summary for chart
    const monthlySummary = await sequelize.query(
      `SELECT 
        strftime('%Y-%m', payment_date) as month,
        SUM(amount) as total
      FROM payments
      WHERE payment_date BETWEEN ? AND ?
      GROUP BY strftime('%Y-%m', payment_date)
      ORDER BY month ASC`,
      {
        replacements: [start, end],
        type: QueryTypes.SELECT
      }
    );
    
    // Format data for chart
    const chartLabels = monthlySummary.map(item => 
      moment(item.month, 'YYYY-MM').format('MMM YYYY')
    );
    const chartData = monthlySummary.map(item => parseFloat(item.total).toFixed(2));
    
    res.render('reports/financial', {
      title: 'Financial Report',
      payments,
      totalAmount: totalAmount.toFixed(2),
      totalPayments,
      paymentMethods,
      chartLabels: JSON.stringify(chartLabels),
      chartData: JSON.stringify(chartData),
      filters: {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        type: type || 'all'
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error generating financial report');
    res.redirect('/dashboard');
  }
});

// Export financial report to Excel
router.get('/financial/export', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    // Set default date range (last 30 days)
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    
    const start = startDate ? new Date(startDate) : defaultStartDate;
    const end = endDate ? new Date(endDate) : defaultEndDate;
    
    // Build where clause
    const whereClause = {
      paymentDate: {
        [Op.gte]: start,
        [Op.lte]: end
      },
      status: 'completed'
    };
    
    if (type && type !== 'all') {
      whereClause['$bill.billType$'] = type;
    }
    
    // Get payments with related bill and customer data
    const payments = await Payment.findAll({
      where: whereClause,
      include: [
        {
          model: Bill,
          as: 'bill',
          include: [
            {
              model: Customer,
              as: 'customer',
              attributes: ['id', 'firstName', 'lastName', 'customerId']
            }
          ]
        }
      ],
      order: [['paymentDate', 'DESC']]
    });
    
    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Financial Report');
    
    // Set up columns
    worksheet.columns = [
      { header: 'Payment ID', key: 'paymentId', width: 15 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Customer', key: 'customer', width: 30 },
      { header: 'Customer ID', key: 'customerId', width: 15 },
      { header: 'Bill Type', key: 'billType', width: 15 },
      { header: 'Bill Number', key: 'billNumber', width: 15 },
      { header: 'Amount', key: 'amount', width: 15, style: { numFmt: '$#,##0.00' } },
      { header: 'Payment Method', key: 'paymentMethod', width: 20 },
      { header: 'Reference', key: 'reference', width: 20 }
    ];
    
    // Add data rows
    payments.forEach(payment => {
      worksheet.addRow({
        paymentId: payment.paymentNumber,
        date: payment.paymentDate.toLocaleDateString(),
        customer: payment.bill?.customer ? 
          `${payment.bill.customer.firstName} ${payment.bill.customer.lastName}` : 'N/A',
        customerId: payment.bill?.customer?.customerId || 'N/A',
        billType: payment.bill?.billType ? 
          payment.bill.billType.charAt(0).toUpperCase() + payment.bill.billType.slice(1) : 'N/A',
        billNumber: payment.bill?.billNumber || 'N/A',
        amount: parseFloat(payment.amount),
        paymentMethod: payment.paymentMethod ? 
          payment.paymentMethod.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ') : 'N/A',
        reference: payment.referenceNumber || 'N/A'
      });
    });
    
    // Add summary row
    const totalAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    
    worksheet.addRow({});
    worksheet.addRow({
      customer: 'Total Payments:',
      amount: totalAmount
    });
    
    // Style the summary row
    const summaryRow = worksheet.lastRow;
    summaryRow.font = { bold: true };
    
    // Set response headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=financial-report-${new Date().toISOString().split('T')[0]}.xlsx`
    );
    
    // Write the workbook to the response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error exporting financial report');
    res.redirect('/reports/financial');
  }
});

// Generate customer statement
router.get('/customer-statement/:customerId', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Set default date range (last 30 days)
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    
    const start = startDate ? new Date(startDate) : defaultStartDate;
    const end = endDate ? new Date(endDate) : defaultEndDate;
    
    // Format dates for display
    const formattedStartDate = start.toISOString().split('T')[0];
    const formattedEndDate = end.toISOString().split('T')[0];
    
    // Get customer
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      req.flash('error_msg', 'Customer not found');
      return res.redirect('/customers');
    }
    
    // Get customer's bills
    const bills = await Bill.findAll({
      where: {
        customerId,
        issueDate: {
          [Op.gte]: start,
          [Op.lte]: end
        }
      },
      order: [['issueDate', 'DESC']],
      include: [
        {
          model: Payment,
          as: 'payments',
          where: { status: 'completed' },
          required: false
        }
      ]
    });
    
    // Calculate totals
    const totalBilled = bills.reduce((sum, bill) => sum + parseFloat(bill.totalAmount), 0);
    const totalPaid = bills.reduce((sum, bill) => {
      const paymentsTotal = bill.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      return sum + paymentsTotal;
    }, 0);
    
    const balance = totalBilled - totalPaid;
    
    res.render('reports/customer-statement', {
      title: 'Customer Statement',
      customer,
      bills,
      totalBilled: totalBilled.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      balance: balance.toFixed(2),
      filters: {
        startDate: formattedStartDate,
        endDate: formattedEndDate
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error generating customer statement');
    res.redirect('/customers');
  }
});

// Generate collection efficiency report
router.get('/collection-efficiency', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const { year, month } = req.query;
    
    // Set default to current month and year
    const currentDate = new Date();
    const reportYear = parseInt(year) || currentDate.getFullYear();
    const reportMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    
    // Calculate date range for the selected month
    const startDate = new Date(reportYear, reportMonth - 1, 1);
    const endDate = new Date(reportYear, reportMonth, 0);
    
    // Get all bills due in the selected month
    const bills = await Bill.findAll({
      where: {
        dueDate: {
          [Op.gte]: startDate,
          [Op.lte]: endDate
        },
        status: {
          [Op.in]: ['pending', 'overdue', 'paid']
        }
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'firstName', 'lastName', 'customerId']
        },
        {
          model: Payment,
          as: 'payments',
          where: { status: 'completed' },
          required: false
        }
      ]
    });
    
    // Calculate collection efficiency
    let totalBilled = 0;
    let totalCollected = 0;
    
    const billData = bills.map(bill => {
      const amountBilled = parseFloat(bill.totalAmount);
      const amountPaid = bill.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      
      totalBilled += amountBilled;
      totalCollected += amountPaid;
      
      return {
        ...bill.toJSON(),
        amountBilled,
        amountPaid,
        amountDue: amountBilled - amountPaid,
        isPaid: amountPaid >= amountBilled,
        isOverdue: bill.status === 'overdue' || (bill.status === 'pending' && new Date(bill.dueDate) < new Date())
      };
    });
    
    const collectionEfficiency = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;
    
    res.render('reports/collection-efficiency', {
      title: 'Collection Efficiency Report',
      bills: billData,
      totalBilled: totalBilled.toFixed(2),
      totalCollected: totalCollected.toFixed(2),
      collectionEfficiency: collectionEfficiency.toFixed(2),
      filters: {
        year: reportYear,
        month: reportMonth,
        months: Array.from({ length: 12 }, (_, i) => ({
          value: i + 1,
          name: new Date(2020, i, 1).toLocaleString('default', { month: 'long' }),
          selected: i + 1 === reportMonth
        })),
        years: Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i)
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error generating collection efficiency report');
    res.redirect('/dashboard');
  }
});

// Generate overdue bills report
router.get('/overdue-bills', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const { daysOverdue } = req.query;
    const days = parseInt(daysOverdue) || 30;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Get overdue bills
    const bills = await Bill.findAll({
      where: {
        dueDate: {
          [Op.lt]: new Date(),
          [Op.gte]: cutoffDate
        },
        status: 'pending'
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'firstName', 'lastName', 'customerId', 'phone', 'email']
        },
        {
          model: Payment,
          as: 'payments',
          where: { status: 'completed' },
          required: false
        }
      ],
      order: [['dueDate', 'ASC']]
    });
    
    // Calculate amounts
    const billData = bills.map(bill => {
      const amountPaid = bill.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const amountDue = parseFloat(bill.totalAmount) - amountPaid;
      const daysOverdue = Math.ceil((new Date() - new Date(bill.dueDate)) / (1000 * 60 * 60 * 24));
      
      return {
        ...bill.toJSON(),
        amountPaid,
        amountDue,
        daysOverdue
      };
    }).filter(bill => bill.amountDue > 0);
    
    // Calculate totals
    const totalOverdue = billData.reduce((sum, bill) => sum + bill.amountDue, 0);
    const totalBills = billData.length;
    
    res.render('reports/overdue-bills', {
      title: 'Overdue Bills Report',
      bills: billData,
      totalOverdue: totalOverdue.toFixed(2),
      totalBills,
      daysOverdue: days
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error generating overdue bills report');
    res.redirect('/dashboard');
  }
});

module.exports = router;
