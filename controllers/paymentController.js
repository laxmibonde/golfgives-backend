const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

// ── POST /api/payments/create-checkout ───────────────────────────────────────
exports.createCheckout = async (req, res, next) => {
  try {
    const { plan } = req.body; // 'monthly' | 'yearly'
    const user = req.user;

    const priceId = plan === 'yearly'
      ? process.env.STRIPE_YEARLY_PRICE_ID
      : process.env.STRIPE_MONTHLY_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({ success: false, message: 'Price ID not configured' });
    }

    // Create or retrieve Stripe customer
    let customerId = user.subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user._id.toString() },
      });
      customerId = customer.id;
      await User.findByIdAndUpdate(user._id, { 'subscription.stripeCustomerId': customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/dashboard?subscribed=true`,
      cancel_url: `${process.env.CLIENT_URL}/subscribe?cancelled=true`,
      metadata: { userId: user._id.toString(), plan },
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/payments/portal — Customer self-service portal ─────────────────
exports.createPortalSession = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user.subscription.stripeCustomerId) {
      return res.status(400).json({ success: false, message: 'No Stripe customer found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.subscription.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL}/dashboard`,
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/payments/status ──────────────────────────────────────────────────
exports.getSubscriptionStatus = async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({
    success: true,
    subscription: {
      status: user.subscription.status,
      plan: user.subscription.plan,
      currentPeriodEnd: user.subscription.currentPeriodEnd,
      cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
    },
  });
};

// ── POST /api/payments/webhook — Stripe webhook ───────────────────────────────
exports.stripeWebhook = async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const data = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const userId = data.metadata?.userId;
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          'subscription.stripeSubscriptionId': data.subscription,
          'subscription.status': 'active',
        });
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const sub = await stripe.subscriptions.retrieve(data.subscription);
      const userId = sub.metadata?.userId || (await User.findOne({ 'subscription.stripeSubscriptionId': data.subscription }))?._id;

      if (userId) {
        await User.findByIdAndUpdate(userId, {
          'subscription.status': 'active',
          'subscription.plan': sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly',
          'subscription.currentPeriodStart': new Date(sub.current_period_start * 1000),
          'subscription.currentPeriodEnd': new Date(sub.current_period_end * 1000),
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const failedUser = await User.findOne({ 'subscription.stripeSubscriptionId': data.subscription });
      if (failedUser) {
        await User.findByIdAndUpdate(failedUser._id, { 'subscription.status': 'lapsed' });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const cancelledUser = await User.findOne({ 'subscription.stripeSubscriptionId': data.id });
      if (cancelledUser) {
        await User.findByIdAndUpdate(cancelledUser._id, {
          'subscription.status': 'cancelled',
          'subscription.cancelAtPeriodEnd': false,
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const updatedUser = await User.findOne({ 'subscription.stripeSubscriptionId': data.id });
      if (updatedUser) {
        await User.findByIdAndUpdate(updatedUser._id, {
          'subscription.cancelAtPeriodEnd': data.cancel_at_period_end,
          'subscription.currentPeriodEnd': new Date(data.current_period_end * 1000),
        });
      }
      break;
    }
  }

  res.json({ received: true });
};
