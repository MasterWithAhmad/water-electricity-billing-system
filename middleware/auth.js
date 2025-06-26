// Middleware to check if user is authenticated
exports.ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', 'Please log in to view that resource');
  res.redirect('/users/login');
};

// Middleware to check if user is not authenticated
exports.forwardAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect('/dashboard');
};

// Middleware to check if user has admin role
exports.ensureAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  req.flash('error_msg', 'You are not authorized to view that resource');
  res.redirect('/dashboard');
};

// Middleware to check if user has staff role
exports.ensureStaff = (req, res, next) => {
  if (req.isAuthenticated() && (req.user.role === 'staff' || req.user.role === 'admin')) {
    return next();
  }
  req.flash('error_msg', 'You are not authorized to view that resource');
  res.redirect('/dashboard');
};

// Middleware to check if user is the owner of the resource or admin/staff
exports.checkOwnership = (model, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const item = await model.findByPk(req.params[paramName]);
      
      if (!item) {
        req.flash('error_msg', 'Resource not found');
        return res.redirect('back');
      }

      // Allow if user is admin or staff
      if (req.user.role === 'admin' || req.user.role === 'staff') {
        return next();
      }

      // Check if the item belongs to the user (assuming items have a userId field)
      if (item.userId && item.userId === req.user.id) {
        return next();
      }

      req.flash('error_msg', 'You are not authorized to perform this action');
      res.redirect('back');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Server Error');
      res.redirect('back');
    }
  };
};
