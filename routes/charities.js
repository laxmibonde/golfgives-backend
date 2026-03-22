const router = require('express').Router();
const {
  getCharities,
  getCharity,
  createCharity,
  updateCharity,
  deleteCharity,
  selectCharity,
} = require('../controllers/charityController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', getCharities);

// IMPORTANT: /select must come BEFORE /:id to avoid conflict
router.put('/select', protect, selectCharity);

router.get('/:id', getCharity);

// Admin
router.post('/', protect, adminOnly, createCharity);
router.put('/:id', protect, adminOnly, updateCharity);
router.delete('/:id', protect, adminOnly, deleteCharity);

module.exports = router;
