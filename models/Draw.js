const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  matchType: { type: String, enum: ['5-match', '4-match', '3-match'] },
  prizeAmount: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  proofUploaded: { type: Boolean, default: false },
  proofUrl: String,
  verificationStatus: { type: String, enum: ['unsubmitted', 'pending', 'approved', 'rejected'], default: 'unsubmitted' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
}, { _id: true });

const drawSchema = new mongoose.Schema({
  month: { type: Number, required: true, min: 1, max: 12 }, // 1-12
  year: { type: Number, required: true },
  status: {
    type: String,
    enum: ['upcoming', 'simulation', 'published'],
    default: 'upcoming',
  },
  // ── Draw Numbers ──────────────────────────────────────────────────────────
  drawnNumbers: {
    type: [Number],
    validate: {
      validator: (arr) => arr.length === 0 || arr.length === 5,
      message: 'Draw must produce exactly 5 numbers',
    },
    default: [],
  },
  drawLogic: {
    type: String,
    enum: ['random', 'algorithmic'],
    default: 'random',
  },
  // ── Prize Pools ───────────────────────────────────────────────────────────
  totalPool: { type: Number, default: 0 },
  jackpotCarriedForward: { type: Number, default: 0 }, // from previous month
  pools: {
    fiveMatch: { amount: Number, isRolledOver: { type: Boolean, default: false } },
    fourMatch: { amount: Number },
    threeMatch: { amount: Number },
  },
  // ── Participants ──────────────────────────────────────────────────────────
  participantCount: { type: Number, default: 0 },
  participantSnapshots: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scores: [Number],
  }],
  // ── Winners ───────────────────────────────────────────────────────────────
  winners: [winnerSchema],
  // ── Admin ─────────────────────────────────────────────────────────────────
  runBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: Date,
  simulationResults: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

// Ensure unique draw per month/year
drawSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Draw', drawSchema);
