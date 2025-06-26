const express = require('express');
const router = express.Router();
const { ensureAuthenticated, forwardAuthenticated } = require('../middleware/auth');

// Home Page - Dashboard
router.get('/', ensureAuthenticated, (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard',
    user: req.user
  });
});

// About Page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Us',
    layout: 'layouts/main'
  });
});

// Contact Page
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us',
    layout: 'layouts/main'
  });
});

// Profile Page
router.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile', {
    title: 'My Profile',
    user: req.user
  });
});

// Settings Page
router.get('/settings', ensureAuthenticated, (req, res) => {
  res.render('settings', {
    title: 'Settings',
    user: req.user
  });
});

// Help & Support Page
router.get('/help', (req, res) => {
  res.render('help', {
    title: 'Help & Support',
    layout: 'layouts/main'
  });
});

// Terms of Service Page
router.get('/terms', (req, res) => {
  res.render('terms', {
    title: 'Terms of Service',
    layout: 'layouts/main'
  });
});

// Privacy Policy Page
router.get('/privacy', (req, res) => {
  res.render('privacy', {
    title: 'Privacy Policy',
    layout: 'layouts/main'
  });
});

module.exports = router;
