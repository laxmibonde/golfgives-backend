const User = require('../models/User');
const Draw = require('../models/Draw');
const Charity = require('../models/Charity');
const Score = require('../models/Score');

// GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const [totalUsers, activeSubscribers, totalCharities, latestDraw, cancelledUsers, lapsedUsers, totalDraws] = await Promise.all([
      User.countDocuments({ role: 'subscriber' }),
      User.countDocuments({ 'subscription.status': 'active' }),
      Charity.countDocuments({ isActive: true }),
      Draw.findOne({ status: 'published' }).sort({ year: -1, month: -1 }),
      User.countDocuments({ 'subscription.status': 'cancelled' }),
      User.countDocuments({ 'subscription.status': 'lapsed' }),
      Draw.countDocuments({ status: 'published' }),
    ]);

    const totalContributions = await Charity.aggregate([
      { $group: { _id: null, total: { $sum: '$totalContributions' } } },
    ]);

    const totalWinnings = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalWinnings' } } },
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeSubscribers,
        cancelledUsers,
        lapsedUsers,
        inactiveUsers: totalUsers - activeSubscribers,
        totalCharities,
        latestDrawPool: latestDraw?.totalPool || 0,
        totalContributions: totalContributions[0]?.total || 0,
        totalDraws,
        totalWinningsPaid: totalWinnings[0]?.total || 0,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/admin/users
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const filter = { role: 'subscriber' };

    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    if (status && status !== 'all') filter['subscription.status'] = status;

    const users = await User.find(filter)
      .select('-password')
      .populate('selectedCharity', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);
    res.json({ success: true, users, total, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// PUT /api/admin/users/:id/subscription
exports.updateUserSubscription = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 'subscription.status': req.body.status },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

// PUT /api/admin/users/:id/scores
exports.adminEditScores = async (req, res, next) => {
  try {
    const { scores } = req.body;
    if (!Array.isArray(scores) || scores.length > 5) {
      return res.status(400).json({ success: false, message: 'Provide up to 5 scores' });
    }
    const scoreDoc = await Score.findOneAndUpdate(
      { user: req.params.id },
      { scores },
      { new: true, upsert: true }
    );
    res.json({ success: true, scores: scoreDoc.scores });
  } catch (err) { next(err); }
};

// GET /api/admin/winners
exports.getWinners = async (req, res, next) => {
  try {
    const draws = await Draw.find({ status: 'published', 'winners.0': { $exists: true } })
      .populate('winners.user', 'name email')
      .sort({ year: -1, month: -1 })
      .limit(20);

    const winners = draws.flatMap(d =>
      d.winners.map(w => ({
        ...w.toObject(),
        drawMonth: d.month,
        drawYear: d.year,
        drawId: d._id,
      }))
    );

    res.json({ success: true, winners });
  } catch (err) { next(err); }
};

// PUT /api/admin/draws/:drawId/winners/:winnerId/verify
exports.verifyWinner = async (req, res, next) => {
  try {
    const { status } = req.body;
    const draw = await Draw.findById(req.params.drawId);
    if (!draw) return res.status(404).json({ success: false, message: 'Draw not found' });

    const winner = draw.winners.id(req.params.winnerId);
    if (!winner) return res.status(404).json({ success: false, message: 'Winner not found' });

    winner.verificationStatus = status;
    winner.verifiedBy = req.user._id;
    winner.verifiedAt = new Date();
    if (status === 'approved') winner.paymentStatus = 'paid';

    await draw.save();
    res.json({ success: true, winner });
  } catch (err) { next(err); }
};
