const router = require('express').Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// GET /api/users/profile
router.get('/profile', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('selectedCharity', 'name logo slug')
      .select('-password');
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

// PUT /api/users/profile
router.put('/profile', protect, async (req, res, next) => {
  try {
    const { name, handicap, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, handicap, avatar },
      { new: true, runValidators: true }
    ).select('-password');
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

// PUT /api/users/change-password
router.put('/change-password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password incorrect' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { next(err); }
});

module.exports = router;
