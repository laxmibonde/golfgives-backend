const Charity = require('../models/Charity');
const User = require('../models/User');

// ── GET /api/charities ────────────────────────────────────────────────────────
exports.getCharities = async (req, res, next) => {
  try {
    const { search, category, featured } = req.query;
    const filter = { isActive: true };

    if (search) filter.name = { $regex: search, $options: 'i' };
    if (category) filter.category = category;
    if (featured === 'true') filter.isFeatured = true;

    const charities = await Charity.find(filter).sort({ isFeatured: -1, name: 1 });
    res.json({ success: true, charities });
  } catch (err) { next(err); }
};

// ── GET /api/charities/:id ────────────────────────────────────────────────────
exports.getCharity = async (req, res, next) => {
  try {
    const charity = await Charity.findOne({
      $or: [{ _id: req.params.id }, { slug: req.params.id }],
      isActive: true,
    });
    if (!charity) return res.status(404).json({ success: false, message: 'Charity not found' });
    res.json({ success: true, charity });
  } catch (err) { next(err); }
};

// ── POST /api/charities — Admin only ─────────────────────────────────────────
exports.createCharity = async (req, res, next) => {
  try {
    const charity = await Charity.create(req.body);
    res.status(201).json({ success: true, charity });
  } catch (err) { next(err); }
};

// ── PUT /api/charities/:id — Admin only ──────────────────────────────────────
exports.updateCharity = async (req, res, next) => {
  try {
    const charity = await Charity.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!charity) return res.status(404).json({ success: false, message: 'Charity not found' });
    res.json({ success: true, charity });
  } catch (err) { next(err); }
};

// ── DELETE /api/charities/:id — Admin only ────────────────────────────────────
exports.deleteCharity = async (req, res, next) => {
  try {
    const charity = await Charity.findById(req.params.id);
    if (!charity) return res.status(404).json({ success: false, message: 'Charity not found' });

    // Soft delete
    charity.isActive = false;
    await charity.save();
    res.json({ success: true, message: 'Charity deactivated' });
  } catch (err) { next(err); }
};

// ── PUT /api/charities/select — Subscriber selects their charity ──────────────
exports.selectCharity = async (req, res, next) => {
  try {
    const { charityId, contributionPercent } = req.body;

    const charity = await Charity.findById(charityId);
    if (!charity) return res.status(404).json({ success: false, message: 'Charity not found' });

    const percent = contributionPercent ? Number(contributionPercent) : 10;
    if (percent < 10 || percent > 100) {
      return res.status(400).json({ success: false, message: 'Contribution must be 10–100%' });
    }

    // Decrement old charity subscriber count
    const user = await User.findById(req.user.id);
    if (user.selectedCharity && user.selectedCharity.toString() !== charityId) {
      await Charity.findByIdAndUpdate(user.selectedCharity, { $inc: { subscriberCount: -1 } });
    }

    await User.findByIdAndUpdate(req.user.id, {
      selectedCharity: charityId,
      charityContributionPercent: percent,
    });

    await Charity.findByIdAndUpdate(charityId, { $inc: { subscriberCount: 1 } });

    res.json({ success: true, message: 'Charity selection saved' });
  } catch (err) { next(err); }
};
