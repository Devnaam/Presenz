import { Router, Request, Response } from 'express';
import subscriptionService from '../services/subscription.service';
import { verifyRazorpaySignature } from '../utils/payment';


const router = Router();


// ─────────────────────────────────────────────────────────────────
// GET /api/v1/subscription
// Get current subscription + computed status for the frontend
// ─────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    const data = await subscriptionService.getSubscription(userId as string);

    res.status(200).json({ success: true, data });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to get subscription' });
  }
});


// ─────────────────────────────────────────────────────────────────
// POST /api/v1/subscription/activate-trial
// Called when user clicks "Activate My Free Trial"
// Body: { userId, referralCode? }
// ─────────────────────────────────────────────────────────────────
router.post('/activate-trial', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, referralCode } = req.body;

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    const result = await subscriptionService.activateTrial(userId, referralCode);

    res.status(200).json({
      success: true,
      message: 'Free trial activated! Enjoy 7 days of Presenz.',
      data: result,
    });

  } catch (error: any) {
    console.error('Activate trial error:', error);

    // Friendly message for double-activation attempts
    const message = error.message?.includes('already activated')
      ? 'Trial is already active on your account'
      : error.message || 'Failed to activate trial';

    res.status(400).json({ success: false, message });
  }
});


// ─────────────────────────────────────────────────────────────────
// POST /api/v1/subscription/create-order
// Creates a Razorpay order for Pro or Business plan
// Body: { userId, plan: 'pro' | 'business' }
// ─────────────────────────────────────────────────────────────────
router.post('/create-order', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, plan } = req.body;

    if (!userId || !plan) {
      res.status(400).json({ success: false, message: 'userId and plan are required' });
      return;
    }

    if (plan !== 'pro' && plan !== 'business') {
      res.status(400).json({ success: false, message: 'Invalid plan. Use "pro" or "business"' });
      return;
    }

    const order = await subscriptionService.createSubscriptionOrder(userId, plan);

    res.status(200).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });

  } catch (error: any) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create order' });
  }
});


// ─────────────────────────────────────────────────────────────────
// POST /api/v1/subscription/verify-payment
// Verifies Razorpay payment + activates paid plan
// Body: { userId, orderId, paymentId, signature, plan }
// ─────────────────────────────────────────────────────────────────
router.post('/verify-payment', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, orderId, paymentId, signature, plan } = req.body;

    if (!userId || !orderId || !paymentId || !signature || !plan) {
      res.status(400).json({ success: false, message: 'All payment fields are required' });
      return;
    }

    await subscriptionService.verifyAndActivateSubscription(
      userId, orderId, paymentId, signature, plan
    );

    res.status(200).json({
      success: true,
      message: 'Subscription activated successfully!',
    });

  } catch (error: any) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Payment verification failed' });
  }
});


// ─────────────────────────────────────────────────────────────────
// POST /api/v1/subscription/webhook
// Razorpay webhook — UNCHANGED structure, updated event handling
// ─────────────────────────────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(req.body);

    const isValid = verifyRazorpaySignature(
      body,
      signature,
      process.env.RAZORPAY_WEBHOOK_SECRET!
    );

    if (!isValid) {
      res.status(400).json({ success: false, message: 'Invalid signature' });
      return;
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`📨 Razorpay webhook: ${event}`);

    switch (event) {
      case 'payment.captured':
        console.log('✅ Payment captured:', payload.payment.entity.id);
        break;

      case 'payment.failed': {
        // Put user in grace period
        const userId = payload.payment.entity.notes?.userId;
        if (userId) {
          const gracePeriodEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          const { Subscription } = await import('../models');
          const { User } = await import('../models');
          const { SubscriptionStatus } = await import('../types');

          await Subscription.findOneAndUpdate(
            { userId },
            { status: SubscriptionStatus.GRACE, gracePeriodEndsAt }
          );
          await User.findByIdAndUpdate(userId, {
            subscriptionStatus: SubscriptionStatus.GRACE,
          });
          console.log(`⚠️ Payment failed — grace period set for user: ${userId}`);
        }
        break;
      }

      case 'subscription.cancelled':
        console.log('🔴 Razorpay subscription cancelled');
        break;

      default:
        console.log('ℹ️ Unhandled webhook event:', event);
    }

    res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});


// ─────────────────────────────────────────────────────────────────
// DELETE /api/v1/subscription/cancel
// Cancels subscription — stays active till period end
// Body: { userId }
// ─────────────────────────────────────────────────────────────────
router.delete('/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    await subscriptionService.cancelSubscription(userId);

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled. You can continue using Presenz until your billing period ends.',
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to cancel subscription' });
  }
});


export default router;