const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Score = require('../models/Score');
const sendEmail = require('../utils/sendEmail');

// ── Helper: generate signed JWT ───────────────────────────────────────────────
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  user.password = undefined;
  res.status(statusCode).json({ success: true, token, user });
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });

    // Create empty score document for this user
    await Score.create({ user: user._id, scores: [] });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user.id).populate('selectedCharity', 'name logo');
  res.json({ success: true, user });
};

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account with that email' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Password Reset — Golf Charity Platform',
      html: `<p>Reset your password here: <a href="${resetUrl}">${resetUrl}</a></p><p>Link expires in 15 minutes.</p>`,
    });

    res.json({ success: true, message: 'Password reset email sent' });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/auth/reset-password/:token ──────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};
