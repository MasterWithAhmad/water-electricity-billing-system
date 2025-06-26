const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { ensureAuthenticated, ensureStaff } = require('../middleware/auth');
const { Customer, Bill, Payment } = require('../models');
const { Op } = require('sequelize');

// Middleware to check if user has permission to manage customers
const canManageCustomers = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'staff') {
    return next();
  }
  req.flash('error_msg', 'You do not have permission to manage customers');
  res.redirect('/dashboard');
};

// Get all customers
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { search, status } = req.query;
    const whereClause = {};
    
    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { customerId: { [Op.like]: `%${search}%` } }
      ];
    }
    
    if (status) {
      whereClause.status = status;
    }

    const customers = await Customer.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.render('customers/index', {
      title: 'Customers',
      customers,
      search: search || '',
      status: status || 'all'
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect('/dashboard');
  }
});

// Show new customer form
router.get('/new', [ensureAuthenticated, ensureStaff], (req, res) => {
  res.render('customers/form', {
    title: 'Add New Customer',
    customer: {},
    isEdit: false
  });
});

// Create new customer
router.post('/', [
  ensureAuthenticated,
  ensureStaff,
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('phone', 'Phone number is required').not().isEmpty(),
    check('address', 'Address is required').not().isEmpty(),
    check('city', 'City is required').not().isEmpty(),
    check('state', 'State is required').not().isEmpty(),
    check('zipCode', 'ZIP code is required').not().isEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('customers/form', {
      title: 'Add New Customer',
      customer: req.body,
      errors: errors.array(),
      isEdit: false
    });
  }

  try {
    // Check if email already exists
    const existingCustomer = await Customer.findOne({ where: { email: req.body.email } });
    if (existingCustomer) {
      req.flash('error_msg', 'A customer with this email already exists');
      return res.redirect('/customers/new');
    }

    // Create new customer
    await Customer.create({
      ...req.body,
      status: 'active'
    });

    req.flash('success_msg', 'Customer added successfully');
    res.redirect('/customers');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect('/customers/new');
  }
});

// Show customer details
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: [
        {
          model: Bill,
          as: 'bills',
          order: [['createdAt', 'DESC']],
          limit: 5
        },
        {
          model: Payment,
          as: 'payments',
          order: [['createdAt', 'DESC']],
          limit: 5
        }
      ]
    });

    if (!customer) {
      req.flash('error_msg', 'Customer not found');
      return res.redirect('/customers');
    }

    // Get stats
    const totalBills = await Bill.count({ where: { customerId: customer.id } });
    const totalPaid = await Payment.sum('amount', {
      where: { 
        customerId: customer.id,
        status: 'completed'
      }
    }) || 0;
    
    const pendingBills = await Bill.count({
      where: { 
        customerId: customer.id,
        status: 'pending'
      }
    });

    res.render('customers/view', {
      title: `${customer.firstName} ${customer.lastName}`,
      customer: customer.toJSON(),
      totalBills,
      totalPaid,
      pendingBills
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect('/customers');
  }
});

// Show edit customer form
router.get('/:id/edit', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      req.flash('error_msg', 'Customer not found');
      return res.redirect('/customers');
    }

    res.render('customers/form', {
      title: 'Edit Customer',
      customer: customer.toJSON(),
      isEdit: true
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect('/customers');
  }
});

// Update customer
router.put('/:id', [
  ensureAuthenticated,
  ensureStaff,
  [
    check('firstName', 'First name is required').not().isEmpty(),
    check('lastName', 'Last name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('phone', 'Phone number is required').not().isEmpty(),
    check('address', 'Address is required').not().isEmpty(),
    check('city', 'City is required').not().isEmpty(),
    check('state', 'State is required').not().isEmpty(),
    check('zipCode', 'ZIP code is required').not().isEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('customers/form', {
      title: 'Edit Customer',
      customer: { ...req.body, id: req.params.id },
      errors: errors.array(),
      isEdit: true
    });
  }

  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      req.flash('error_msg', 'Customer not found');
      return res.redirect('/customers');
    }

    // Check if email is being changed and already exists
    if (req.body.email !== customer.email) {
      const existingCustomer = await Customer.findOne({ where: { email: req.body.email } });
      if (existingCustomer) {
        req.flash('error_msg', 'A customer with this email already exists');
        return res.redirect(`/customers/${req.params.id}/edit`);
      }
    }

    // Update customer
    await customer.update(req.body);

    req.flash('success_msg', 'Customer updated successfully');
    res.redirect(`/customers/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect(`/customers/${req.params.id}/edit`);
  }
});

// Delete customer
router.delete('/:id', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      req.flash('error_msg', 'Customer not found');
      return res.redirect('/customers');
    }

    // Check if customer has any bills or payments
    const billsCount = await Bill.count({ where: { customerId: customer.id } });
    const paymentsCount = await Payment.count({ where: { customerId: customer.id } });

    if (billsCount > 0 || paymentsCount > 0) {
      req.flash('error_msg', 'Cannot delete customer with associated bills or payments');
      return res.redirect(`/customers/${customer.id}`);
    }

    await customer.destroy();
    req.flash('success_msg', 'Customer deleted successfully');
    res.redirect('/customers');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect(`/customers/${req.params.id}`);
  }
});

// Export customers to CSV
router.get('/export/csv', [ensureAuthenticated, ensureStaff], async (req, res) => {
  try {
    const customers = await Customer.findAll({
      order: [['lastName', 'ASC'], ['firstName', 'ASC']]
    });

    // Convert to CSV
    let csv = 'ID,First Name,Last Name,Email,Phone,Address,City,State,Zip Code,Status\n';
    customers.forEach(customer => {
      csv += `"${customer.customerId}",`;
      csv += `"${customer.firstName}",`;
      csv += `"${customer.lastName}",`;
      csv += `"${customer.email}",`;
      csv += `"${customer.phone}",`;
      csv += `"${customer.address}",`;
      csv += `"${customer.city}",`;
      csv += `"${customer.state}",`;
      csv += `"${customer.zipCode}",`;
      csv += `"${customer.status}"\n`;
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=customers-export.csv');
    res.send(csv);
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error exporting customers');
    res.redirect('/customers');
  }
});

module.exports = router;
