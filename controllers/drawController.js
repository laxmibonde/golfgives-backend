const Draw = require('../models/Draw');
const User = require('../models/User');
const Score = require('../models/Score');

const PRIZE_POOL_PERCENT = 0.60; // 60% of subscription revenue goes to prize pool
const POOL_DISTRIBUTION = { fiveMatch: 0.40, fourMatch: 0.35, threeMatch: 0.25 };
const SUBSCRIPTION_PRICES = { monthly: 999, yearly: 9990 }; // pence/cents

// ── Helper: generate 5 random numbers 1-45 ───────────────────────────────────
const randomDraw = () => {
  const nums = new Set();
  while (nums.size < 5) nums.add(Math.floor(Math.random() * 45) + 1);
  return [...nums].sort((a, b) => a - b);
};

// ── Helper: algorithmic draw weighted by least-common user scores ─────────────
const algorithmicDraw = async () => {
  const scores = await Score.find({});
  const freq = {};

  scores.forEach(doc =>
    doc.scores.forEach(s => {
      freq[s.value] = (freq[s.value] || 0) + 1;
    })
  );

  // Build weighted pool — less frequent numbers have higher weight
  const pool = [];
  for (let n = 1; n <= 45; n++) {
    const weight = Math.max(1, 10 - (freq[n] || 0));
    for (let i = 0; i < weight; i++) pool.push(n);
  }

  const picked = new Set();
  while (picked.size < 5) {
    picked.add(pool[Math.floor(Math.random() * pool.length)]);
  }
  return [...picked].sort((a, b) => a - b);
};

// ── Helper: match scores against drawn numbers ────────────────────────────────
const countMatches = (userScores, drawn) => {
  const drawnSet = new Set(drawn);
  return userScores.filter(s => drawnSet.has(s)).length;
};

// ── Helper: calculate prize pools ────────────────────────────────────────────
const calculatePools = async (jackpotCarried = 0) => {
  const activeUsers = await User.countDocuments({ 'subscription.status': 'active' });

  // Approximate monthly revenue (mix of plan types — simplified)
  const monthlyRevenue = activeUsers * SUBSCRIPTION_PRICES.monthly;
  const totalPool = Math.floor(monthlyRevenue * PRIZE_POOL_PERCENT) + jackpotCarried;

  return {
    totalPool,
    pools: {
      fiveMatch: { amount: Math.floor(totalPool * POOL_DISTRIBUTION.fiveMatch) },
      fourMatch: { amount: Math.floor(totalPool * POOL_DISTRIBUTION.fourMatch) },
      threeMatch: { amount: Math.floor(totalPool * POOL_DISTRIBUTION.threeMatch) },
    },
  };
};

// ── GET /api/draws ────────────────────────────────────────────────────────────
exports.getDraws = async (req, res, next) => {
  try {
    const draws = await Draw.find({ status: 'published' })
      .sort({ year: -1, month: -1 })
      .limit(12)
      .populate('winners.user', 'name');

    res.json({ success: true, draws });
  } catch (err) { next(err); }
};

// ── GET /api/draws/current ────────────────────────────────────────────────────
exports.getCurrentDraw = async (req, res, next) => {
  try {
    const now = new Date();
    const draw = await Draw.findOne({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    }).populate('winners.user', 'name');

    if (!draw) return res.json({ success: true, draw: null });
    res.json({ success: true, draw });
  } catch (err) { next(err); }
};

// ── POST /api/draws/simulate — Admin only ────────────────────────────────────
exports.simulateDraw = async (req, res, next) => {
  try {
    const { logic = 'random', month, year } = req.body;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    // Get previous jackpot if any
    const prev = await Draw.findOne({ month: targetMonth - 1 || 12, year: targetYear })
      .lean();
    const jackpotCarried = prev?.pools?.fiveMatch?.isRolledOver
      ? (prev?.pools?.fiveMatch?.amount || 0) : 0;

    const drawn = logic === 'algorithmic' ? await algorithmicDraw() : randomDraw();
    const { totalPool, pools } = await calculatePools(jackpotCarried);

    // Snapshot all active subscribers' scores
    const activeUsers = await User.find({ 'subscription.status': 'active' }).select('_id');
    const scoresDocs = await Score.find({ user: { $in: activeUsers.map(u => u._id) } });

    const participants = scoresDocs.map(doc => ({
      user: doc.user,
      scores: doc.scores.map(s => s.value),
    }));

    // Simulate winners
    const fiveWinners = [], fourWinners = [], threeWinners = [];
    participants.forEach(p => {
      const matches = countMatches(p.scores, drawn);
      if (matches >= 5) fiveWinners.push(p.user);
      else if (matches === 4) fourWinners.push(p.user);
      else if (matches === 3) threeWinners.push(p.user);
    });

    const simulation = {
      drawn,
      logic,
      totalPool,
      pools,
      jackpotCarried,
      participantCount: participants.length,
      winners: { fiveMatch: fiveWinners, fourMatch: fourWinners, threeMatch: threeWinners },
      hasJackpotWinner: fiveWinners.length > 0,
    };

    res.json({ success: true, simulation });
  } catch (err) { next(err); }
};

// ── POST /api/draws/publish — Admin only ─────────────────────────────────────
exports.publishDraw = async (req, res, next) => {
  try {
    const { logic = 'random', month, year } = req.body;

    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const existing = await Draw.findOne({ month: targetMonth, year: targetYear, status: 'published' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Draw already published for this month' });
    }

    const prev = await Draw.findOne({ month: targetMonth - 1 || 12, year: targetYear });
    const jackpotCarried = prev?.pools?.fiveMatch?.isRolledOver ? (prev?.pools?.fiveMatch?.amount || 0) : 0;

    const drawn = logic === 'algorithmic' ? await algorithmicDraw() : randomDraw();
    const { totalPool, pools } = await calculatePools(jackpotCarried);

    // Snapshot participants
    const activeUsers = await User.find({ 'subscription.status': 'active' }).select('_id');
    const scoresDocs = await Score.find({ user: { $in: activeUsers.map(u => u._id) } });

    const participantSnapshots = scoresDocs.map(doc => ({
      user: doc.user,
      scores: doc.scores.map(s => s.value),
    }));

    // Build winners list
    const buildWinners = (users, matchType, poolAmount) => {
      if (!users.length) return [];
      const share = Math.floor(poolAmount / users.length);
      return users.map(userId => ({ user: userId, matchType, prizeAmount: share }));
    };

    const fiveWinners = [], fourWinners = [], threeWinners = [];
    participantSnapshots.forEach(p => {
      const matches = countMatches(p.scores, drawn);
      if (matches >= 5) fiveWinners.push(p.user);
      else if (matches === 4) fourWinners.push(p.user);
      else if (matches === 3) threeWinners.push(p.user);
    });

    const jackpotRolled = fiveWinners.length === 0;
    if (jackpotRolled) pools.fiveMatch.isRolledOver = true;

    const winners = [
      ...buildWinners(fiveWinners, '5-match', pools.fiveMatch.amount),
      ...buildWinners(fourWinners, '4-match', pools.fourMatch.amount),
      ...buildWinners(threeWinners, '3-match', pools.threeMatch.amount),
    ];

    const draw = await Draw.create({
      month: targetMonth,
      year: targetYear,
      status: 'published',
      drawnNumbers: drawn,
      drawLogic: logic,
      totalPool,
      jackpotCarriedForward: jackpotCarried,
      pools,
      participantCount: participantSnapshots.length,
      participantSnapshots,
      winners,
      runBy: req.user._id,
      publishedAt: new Date(),
    });

    // Update user totalWinnings & drawsEntered
    for (const w of winners) {
      await User.findByIdAndUpdate(w.user, {
        $inc: { totalWinnings: w.prizeAmount },
        $addToSet: { drawsEntered: draw._id },
      });
    }

    res.status(201).json({ success: true, draw });
  } catch (err) { next(err); }
};

// ── POST /api/draws/:drawId/winners/:winnerId/proof — Subscriber ──────────────
exports.uploadProof = async (req, res, next) => {
  try {
    const draw = await Draw.findById(req.params.drawId);
    if (!draw) return res.status(404).json({ success: false, message: 'Draw not found' });

    const winner = draw.winners.id(req.params.winnerId);
    if (!winner || winner.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    winner.proofUploaded = true;
    winner.proofUrl = req.file?.path || req.body.proofUrl;
    winner.verificationStatus = 'pending';
    await draw.save();

    res.json({ success: true, winner });
  } catch (err) { next(err); }
};
