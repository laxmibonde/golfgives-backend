const router = require('express').Router();
const {
  getStats,
  getUsers,
  updateUserSubscription,
  adminEditScores,
  getWinners,
  verifyWinner,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.put('/users/:id/subscription', updateUserSubscription);
router.put('/users/:id/scores', adminEditScores);
router.get('/winners', getWinners);
router.put('/draws/:drawId/winners/:winnerId/verify', verifyWinner);

module.exports = router;
