const Score = require('../models/Score');

// ── GET /api/scores ───────────────────────────────────────────────────────────
exports.getMyScores = async (req, res, next) => {
  try {
    let scoreDoc = await Score.findOne({ user: req.user.id });
    if (!scoreDoc) {
      scoreDoc = await Score.create({ user: req.user.id, scores: [] });
    }

    // Return newest-first
    const sorted = [...scoreDoc.scores].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, scores: sorted });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/scores ──────────────────────────────────────────────────────────
exports.addScore = async (req, res, next) => {
  try {
    const { value, date } = req.body;

    if (!value || value < 1 || value > 45) {
      return res.status(400).json({ success: false, message: 'Score must be between 1 and 45' });
    }

    let scoreDoc = await Score.findOne({ user: req.user.id });
    if (!scoreDoc) {
      scoreDoc = await Score.create({ user: req.user.id, scores: [] });
    }

    scoreDoc.addScore(Number(value), date ? new Date(date) : new Date());
    await scoreDoc.save();

    const sorted = [...scoreDoc.scores].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.status(201).json({ success: true, scores: sorted });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/scores/:index ────────────────────────────────────────────────────
exports.updateScore = async (req, res, next) => {
  try {
    const { value, date } = req.body;
    const idx = parseInt(req.params.index);

    const scoreDoc = await Score.findOne({ user: req.user.id });
    if (!scoreDoc || !scoreDoc.scores[idx]) {
      return res.status(404).json({ success: false, message: 'Score not found' });
    }

    if (value !== undefined) {
      if (value < 1 || value > 45) {
        return res.status(400).json({ success: false, message: 'Score must be between 1 and 45' });
      }
      scoreDoc.scores[idx].value = value;
    }
    if (date) scoreDoc.scores[idx].date = new Date(date);

    scoreDoc.markModified('scores');
    await scoreDoc.save();

    const sorted = [...scoreDoc.scores].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, scores: sorted });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/scores/:index ─────────────────────────────────────────────────
exports.deleteScore = async (req, res, next) => {
  try {
    const idx = parseInt(req.params.index);
    const scoreDoc = await Score.findOne({ user: req.user.id });

    if (!scoreDoc || !scoreDoc.scores[idx]) {
      return res.status(404).json({ success: false, message: 'Score not found' });
    }

    scoreDoc.scores.splice(idx, 1);
    scoreDoc.markModified('scores');
    await scoreDoc.save();

    res.json({ success: true, scores: scoreDoc.scores });
  } catch (err) {
    next(err);
  }
};
