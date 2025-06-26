const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const { check, validationResult } = require('express-validator');
const { ensureAuthenticated, forwardAuthenticated } = require('../middleware/auth');
const User = require('../models/User');

// Login Page
router.get('/login', forwardAuthenticated, (req, res) => {
  res.render('users/login', {
    title: 'Login',
    layout: 'layouts/auth'
  });
});

// Login Handle
router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/users/login',
    failureFlash: true
  })(req, res, next);
});

// Register Page
router.get('/register', forwardAuthenticated, (req, res) => {
  res.render('users/register', {
    title: 'Register',
    layout: 'layouts/auth',
    name: '',
    email: ''
  });
});

// Register Handle
router.post('/register', [
  check('name', 'Name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
  check('password2', 'Passwords do not match').custom((value, { req }) => value === req.body.password)
], async (req, res) => {
  const errors = validationResult(req);
  const { name, email, password } = req.body;

  if (!errors.isEmpty()) {
    return res.render('users/register', {
      title: 'Register',
      layout: 'layouts/auth',
      errors: errors.array(),
      name,
      email
    });
  }

  try {
    let user = await User.findOne({ where: { email } });
    
    if (user) {
      req.flash('error_msg', 'Email is already registered');
      return res.redirect('/users/register');
    }

    user = await User.create({
      name,
      email,
      password,
      role: 'customer' // Default role
    });

    req.flash('success_msg', 'You are now registered and can log in');
    res.redirect('/users/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect('/users/register');
  }
});

// Logout Handle
router.get('/logout', (req, res) => {
  req.logout();
  req.flash('success_msg', 'You are logged out');
  res.redirect('/users/login');
});

// Forgot Password Page
router.get('/forgot-password', forwardAuthenticated, (req, res) => {
  res.render('users/forgot-password', {
    title: 'Forgot Password',
    layout: 'layouts/auth'
  });
});

// Reset Password Page
router.get('/reset-password/:token', forwardAuthenticated, async (req, res) => {
  try {
    const user = await User.findOne({
      where: {
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { [Op.gt]: Date.now() }
      }
    });

    if (!user) {
      req.flash('error_msg', 'Password reset token is invalid or has expired');
      return res.redirect('/users/forgot-password');
    }

    res.render('users/reset-password', {
      title: 'Reset Password',
      layout: 'layouts/auth',
      token: req.params.token
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect('/users/forgot-password');
  }
});

module.exports = router;
