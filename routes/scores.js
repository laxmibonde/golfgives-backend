const router = require('express').Router();
const { getMyScores, addScore, updateScore, deleteScore } = require('../controllers/scoreController');
const { protect, requireSubscription } = require('../middleware/auth');

router.use(protect, requireSubscription);

router.get('/', getMyScores);
router.post('/', addScore);
router.put('/:index', updateScore);
router.delete('/:index', deleteScore);

module.exports = router;
