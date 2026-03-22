const router = require('express').Router();
const {
  createCheckout,
  createPortalSession,
  getSubscriptionStatus,
  stripeWebhook,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Webhook must be raw body — registered in server.js before express.json()
router.post('/webhook', stripeWebhook);

router.post('/create-checkout', protect, createCheckout);
router.post('/portal', protect, createPortalSession);
router.get('/status', protect, getSubscriptionStatus);

module.exports = router;
