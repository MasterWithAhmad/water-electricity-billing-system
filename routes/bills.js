const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { ensureAuthenticated, ensureStaff } = require('../middleware/auth');
const { Customer, Bill, Payment } = require('../models');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Middleware to check if user has permission to manage bills
const canManageBills = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'staff') {
    return next();
  }
  req.flash('error_msg', 'You do not have permission to manage bills');
  res.redirect('/dashboard');
};

// Get all bills
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { status, type, month, year, customer } = req.query;
    const whereClause = {};
    
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    
    if (type && type !== 'all') {
      whereClause.billType = type;
    }
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      whereClause.issueDate = {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      };
    } else if (month) {
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear, month - 1, 1);
      const endDate = new Date(currentYear, month, 0);
      whereClause.issueDate = {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      };
    } else if (year) {
      whereClause.issueDate = {
        [Op.gte]: new Date(year, 0, 1),
        [Op.lt]: new Date(parseInt(year) + 1, 0, 1)
      };
    }
    
    if (customer) {
      whereClause['$customer.id$'] = customer;
    }

    const bills = await Bill.findAll({
      where: whereClause,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'firstName', 'lastName', 'customerId']
        }
      ],
      order: [['issueDate', 'DESC']]
    });

    // Get customers for filter dropdown
    const customers = await Customer.findAll({
      attributes: ['id', 'firstName', 'lastName', 'customerId'],
      order: [['lastName', 'ASC'], ['firstName', 'ASC']]
    });

    res.render('bills/index', {
      title: 'Bills',
      bills,
      customers,
      filters: {
        status: status || 'all',
        type: type || 'all',
        month: month || '',
        year: year || '',
        customer: customer || ''
      },
      currentUrl: req.originalUrl
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect('/dashboard');
  }
});

// Show new bill form
router.get('/new', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const customers = await Customer.findAll({
      where: { status: 'active' },
      order: [['lastName', 'ASC'], ['firstName', 'ASC']]
    });

    res.render('bills/form', {
      title: 'Create New Bill',
      bill: {},
      customers,
      isEdit: false
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect('/bills');
  }
});

// Create new bill
router.post('/', [
  ensureAuthenticated,
  ensureStaff,
  [
    check('customerId', 'Customer is required').not().isEmpty(),
    check('billType', 'Bill type is required').isIn(['water', 'electricity', 'combined']),
    check('currentReading', 'Current reading is required').isNumeric(),
    check('rate', 'Rate is required').isNumeric(),
    check('dueDate', 'Due date is required').not().isEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    try {
      const customers = await Customer.findAll({
        where: { status: 'active' },
        order: [['lastName', 'ASC'], ['firstName', 'ASC']]
      });

      return res.render('bills/form', {
        title: 'Create New Bill',
        bill: req.body,
        customers,
        errors: errors.array(),
        isEdit: false
      });
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Server error');
      return res.redirect('/bills');
    }
  }

  try {
    const { customerId, billType, previousReading, currentReading, rate, dueDate, notes } = req.body;
    
    // Get customer
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      req.flash('error_msg', 'Customer not found');
      return res.redirect('/bills/new');
    }

    // Calculate consumption and amounts
    const consumption = parseFloat(currentReading) - (parseFloat(previousReading) || 0);
    const amount = parseFloat((consumption * rate).toFixed(2));
    const taxRate = 0.1; // 10% tax rate (adjust as needed)
    const taxAmount = parseFloat((amount * taxRate).toFixed(2));
    const totalAmount = parseFloat((amount + taxAmount).toFixed(2));

    // Create bill
    const bill = await Bill.create({
      customerId,
      billType,
      previousReading: previousReading || 0,
      currentReading,
      consumption,
      rate,
      amount,
      taxRate: taxRate * 100, // Store as percentage
      taxAmount,
      totalAmount,
      dueDate,
      status: 'pending',
      notes: notes || null,
      issuedBy: req.user.id
    });

    req.flash('success_msg', 'Bill created successfully');
    res.redirect(`/bills/${bill.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect('/bills/new');
  }
});

// Show bill details
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id, {
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Payment,
          as: 'payments',
          order: [['paymentDate', 'DESC']]
        }
      ]
    });

    if (!bill) {
      req.flash('error_msg', 'Bill not found');
      return res.redirect('/bills');
    }

    // Calculate amount paid
    const amountPaid = bill.payments
      .filter(p => p.status === 'completed')
      .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

    // Calculate balance
    const balance = parseFloat(bill.totalAmount) - amountPaid;

    res.render('bills/view', {
      title: `Bill #${bill.billNumber}`,
      bill: bill.toJSON(),
      amountPaid: amountPaid.toFixed(2),
      balance: balance.toFixed(2),
      isOverdue: bill.status === 'pending' && new Date(bill.dueDate) < new Date()
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect('/bills');
  }
});

// Generate PDF for bill
router.get('/:id/pdf', ensureAuthenticated, async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id, {
      include: [
        {
          model: Customer,
          as: 'customer'
        }
      ]
    });

    if (!bill) {
      req.flash('error_msg', 'Bill not found');
      return res.redirect('/bills');
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=bill-${bill.billNumber}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content to PDF
    // Header
    doc
      .fontSize(20)
      .text('WATER & ELECTRICITY BILLING SYSTEM', { align: 'center' })
      .fontSize(10)
      .text('123 Utility Street, City, Country', { align: 'center' })
      .text('Phone: +123 456 7890 | Email: billing@utility.com', { align: 'center' })
      .moveDown(2);
    
    // Bill info
    doc
      .fontSize(16)
      .text(`INVOICE #${bill.billNumber}`, { align: 'right' })
      .fontSize(10)
      .text(`Issue Date: ${new Date(bill.issueDate).toLocaleDateString()}`, { align: 'right' })
      .text(`Due Date: ${new Date(bill.dueDate).toLocaleDateString()}`, { align: 'right' })
      .moveDown();
    
    // Bill to
    doc
      .text('BILL TO:', { continued: true })
      .font('Helvetica-Bold')
      .text(` ${bill.customer.firstName} ${bill.customer.lastName}`)
      .font('Helvetica')
      .text(`   ${bill.customer.address}`)
      .text(`   ${bill.customer.city}, ${bill.customer.state} ${bill.customer.zipCode}`)
      .text(`   ${bill.customer.email} | ${bill.customer.phone}`)
      .moveDown();
    
    // Bill details
    const billType = bill.billType.charAt(0).toUpperCase() + bill.billType.slice(1);
    doc
      .font('Helvetica-Bold')
      .text('Bill Type', 50, 250)
      .text('Previous Reading', 200, 250)
      .text('Current Reading', 300, 250)
      .text('Consumption', 400, 250)
      .text('Rate', 500, 250)
      .font('Helvetica')
      .text(billType, 50, 270)
      .text(bill.previousReading.toFixed(2), 200, 270)
      .text(bill.currentReading.toFixed(2), 300, 270)
      .text(bill.consumption.toFixed(2), 400, 270)
      .text(`$${bill.rate.toFixed(4)}`, 500, 270)
      .moveDown(3);
    
    // Summary
    doc
      .text(`Subtotal: $${bill.amount.toFixed(2)}`, { align: 'right' })
      .text(`Tax (${bill.taxRate}%): $${bill.taxAmount.toFixed(2)}`, { align: 'right' })
      .font('Helvetica-Bold')
      .text(`Total: $${bill.totalAmount.toFixed(2)}`, { align: 'right' })
      .font('Helvetica')
      .moveDown(2);
    
    // Status
    doc
      .font('Helvetica-Bold')
      .text('Status:', { continued: true })
      .font('Helvetica')
      .text(` ${bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}`);
    
    // Notes
    if (bill.notes) {
      doc
        .moveDown()
        .text('Notes:', { underline: true })
        .text(bill.notes);
    }
    
    // Footer
    doc
      .fontSize(8)
      .text('Thank you for your business!', 50, 700, { align: 'center' })
      .text('Please pay your bill by the due date to avoid late fees.', 50, 715, { align: 'center' });
    
    // Finalize PDF
    doc.end();
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error generating PDF');
    res.redirect(`/bills/${req.params.id}`);
  }
});

// Update bill status
router.post('/:id/status', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'paid', 'overdue', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    
    await bill.update({ status });
    
    res.json({ success: true, message: 'Bill status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete bill
router.delete('/:id', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id);
    if (!bill) {
      req.flash('error_msg', 'Bill not found');
      return res.redirect('/bills');
    }
    
    // Check if bill has payments
    const paymentsCount = await Payment.count({ where: { billId: bill.id } });
    if (paymentsCount > 0) {
      req.flash('error_msg', 'Cannot delete bill with associated payments');
      return res.redirect(`/bills/${bill.id}`);
    }
    
    await bill.destroy();
    
    req.flash('success_msg', 'Bill deleted successfully');
    res.redirect('/bills');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect(`/bills/${req.params.id}`);
  }
});

// Send bill via email
router.post('/:id/send', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const bill = await Bill.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }]
    });
    
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    
    // In a real application, you would send an email here
    // This is a placeholder for the email sending logic
    console.log(`Sending bill #${bill.billNumber} to ${bill.customer.email}`);
    
    res.json({ success: true, message: 'Bill sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error sending bill' });
  }
});

module.exports = router;
