const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT and attach user to request
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorised — no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Require active subscription
exports.requireSubscription = (req, res, next) => {
  if (!req.user.hasActiveSubscription()) {
    return res.status(403).json({
      success: false,
      message: 'Active subscription required',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }
  next();
};

// Restrict to admin role
exports.adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};
