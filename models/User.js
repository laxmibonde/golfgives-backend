const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },
  role: {
    type: String,
    enum: ['subscriber', 'admin'],
    default: 'subscriber',
  },
  // ── Subscription ───────────────────────────────────────────────────────────
  subscription: {
    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'lapsed'],
      default: 'inactive',
    },
    plan: {
      type: String,
      enum: ['monthly', 'yearly'],
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  // ── Charity ────────────────────────────────────────────────────────────────
  selectedCharity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Charity',
  },
  charityContributionPercent: {
    type: Number,
    default: 10,
    min: [10, 'Minimum charity contribution is 10%'],
    max: [100, 'Cannot exceed 100%'],
  },
  // ── Draw Participation ─────────────────────────────────────────────────────
  drawsEntered: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Draw',
  }],
  totalWinnings: {
    type: Number,
    default: 0,
  },
  // ── Profile ────────────────────────────────────────────────────────────────
  handicap: {
    type: Number,
    min: 0,
    max: 54,
  },
  avatar: String,
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Check if subscription is active
userSchema.methods.hasActiveSubscription = function () {
  return (
    this.subscription.status === 'active' &&
    this.subscription.currentPeriodEnd &&
    new Date(this.subscription.currentPeriodEnd) > new Date()
  );
};

module.exports = mongoose.model('User', userSchema);
