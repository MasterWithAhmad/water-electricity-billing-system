const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { ensureAuthenticated, ensureStaff } = require('../middleware/auth');
const { Bill, Payment, Customer, sequelize } = require('../models');
const { Op } = require('sequelize');
const PDFDocument = require('pdfkit');

// Generate payment reference number
const generatePaymentNumber = async () => {
  const prefix = 'PAY';
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  const lastPayment = await Payment.findOne({
    order: [['createdAt', 'DESC']]
  });
  
  let sequence = 1;
  if (lastPayment && lastPayment.paymentNumber) {
    sequence = parseInt(lastPayment.paymentNumber.split('-')[1]) + 1;
  }
  
  return `${prefix}-${sequence.toString().padStart(6, '0')}`;
};

// View all payments
router.get('/', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    const whereClause = {};
    
    if (startDate && endDate) {
      whereClause.paymentDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    
    const payments = await Payment.findAll({
      where: whereClause,
      include: [
        {
          model: Bill,
          include: [Customer]
        },
        {
          model: Customer
        }
      ],
      order: [['paymentDate', 'DESC']]
    });
    
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new payment
router.post('/', [
  ensureAuthenticated,
  ensureStaff,
  [
    check('amount', 'Amount is required').isFloat({ min: 0.01 }),
    check('paymentDate', 'Payment date is required').notEmpty(),
    check('paymentMethod', 'Payment method is required').notEmpty(),
    check('billId', 'Bill ID is required').isInt()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const transaction = await sequelize.transaction();
  
  try {
    const { amount, paymentDate, paymentMethod, referenceNumber, notes, billId } = req.body;
    
    // Get bill details
    const bill = await Bill.findByPk(billId, {
      include: [Customer],
      transaction
    });
    
    if (!bill) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    // Generate payment number
    const paymentNumber = await generatePaymentNumber();
    
    // Create payment
    const payment = await Payment.create({
      paymentNumber,
      amount,
      paymentDate: new Date(paymentDate),
      paymentMethod,
      referenceNumber: referenceNumber || null,
      notes: notes || null,
      status: 'completed',
      billId,
      customerId: bill.customerId,
      processedBy: req.user.id
    }, { transaction });
    
    // Update bill status
    const totalPaid = await Payment.sum('amount', {
      where: { billId, status: 'completed' },
      transaction
    });
    
    if (totalPaid >= bill.totalAmount) {
      await bill.update({ status: 'paid' }, { transaction });
    } else {
      await bill.update({ status: 'partially_paid' }, { transaction });
    }
    
    await transaction.commit();
    res.status(201).json(payment);
  } catch (err) {
    await transaction.rollback();
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get payment by ID
router.get('/:id', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [
        {
          model: Bill,
          include: [Customer]
        },
        {
          model: Customer
        }
      ]
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    res.json(payment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate payment receipt
router.get('/:id/receipt', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [
        {
          model: Bill,
          include: [Customer]
        },
        {
          model: Customer
        }
      ]
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Create PDF document
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=payment-${payment.paymentNumber}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Add content to PDF
    doc.fontSize(20).text('PAYMENT RECEIPT', { align: 'center' });
    doc.fontSize(12).text(`Receipt #${payment.paymentNumber}`, { align: 'right' });
    doc.moveDown();
    
    // Customer info
    const customer = payment.Customer || (payment.Bill && payment.Bill.Customer);
    if (customer) {
      doc.text(`Customer: ${customer.firstName} ${customer.lastName}`);
      doc.text(`Customer ID: ${customer.customerId}`);
      doc.moveDown();
    }
    
    // Payment details
    doc.text(`Amount: $${parseFloat(payment.amount).toFixed(2)}`);
    doc.text(`Date: ${new Date(payment.paymentDate).toLocaleDateString()}`);
    doc.text(`Method: ${payment.paymentMethod}`);
    
    if (payment.referenceNumber) {
      doc.text(`Reference: ${payment.referenceNumber}`);
    }
    
    if (payment.notes) {
      doc.moveDown();
      doc.text('Notes:');
      doc.text(payment.notes);
    }
    
    // Finalize PDF
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating receipt' });
  }
});

// Void a payment
router.post('/:id/void', [ensureAuthenticated, ensureStaff], async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [Bill],
      transaction
    });
    
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    if (payment.status === 'void') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Payment is already voided' });
    }
    
    // Update payment status
    await payment.update({ status: 'void' }, { transaction });
    
    // Update associated bill status if needed
    if (payment.Bill) {
      const bill = payment.Bill;
      const totalPaid = await Payment.sum('amount', {
        where: { 
          billId: bill.id,
          status: 'completed'
        },
        transaction
      });
      
      if (totalPaid <= 0) {
        await bill.update({ status: 'pending' }, { transaction });
      } else if (totalPaid < bill.totalAmount) {
        await bill.update({ status: 'partially_paid' }, { transaction });
      }
    }
    
    await transaction.commit();
    res.json({ message: 'Payment voided successfully' });
  } catch (err) {
    await transaction.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error voiding payment' });
  }
});

module.exports = router;