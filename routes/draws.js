const router = require('express').Router();
const {
  getDraws,
  getCurrentDraw,
  simulateDraw,
  publishDraw,
  uploadProof,
} = require('../controllers/drawController');
const { protect, requireSubscription, adminOnly } = require('../middleware/auth');

router.get('/', getDraws);
router.get('/current', protect, getCurrentDraw);

// Admin
router.post('/simulate', protect, adminOnly, simulateDraw);
router.post('/publish', protect, adminOnly, publishDraw);

// Winner proof upload
router.post('/:drawId/winners/:winnerId/proof', protect, requireSubscription, uploadProof);

module.exports = router;
