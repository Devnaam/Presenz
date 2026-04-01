import { Router, Request, Response } from 'express';
import subscriptionService from '../services/subscription.service';
import { verifyRazorpaySignature } from '../utils/payment';


const router = Router();


/**
 * GET /api/v1/subscription
 * Get current subscription details
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    const subscription = await subscriptionService.getSubscription(userId as string);

    res.status(200).json({
      success: true,
      data: subscription
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get subscription'
    });
  }
});


/**
 * POST /api/v1/subscription/create-order
 * Create Razorpay order for subscription
 */
router.post('/create-order', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, plan } = req.body;

    if (!userId || !plan) {
      res.status(400).json({ success: false, message: 'userId and plan are required' });
      return;
    }

    if (plan !== 'basic' && plan !== 'pro') {
      res.status(400).json({ success: false, message: 'Invalid plan. Use "basic" or "pro"' });
      return;
    }

    const order = await subscriptionService.createSubscriptionOrder(userId, plan);

    res.status(200).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });

  } catch (error: any) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order'
    });
  }
});


/**
 * POST /api/v1/subscription/verify-payment
 * Verify payment and activate subscription
 */
router.post('/verify-payment', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, orderId, paymentId, signature, plan } = req.body;

    if (!userId || !orderId || !paymentId || !signature || !plan) {
      res.status(400).json({ success: false, message: 'All payment details are required' });
      return;
    }

    await subscriptionService.verifyAndActivateSubscription(
      userId,
      orderId,
      paymentId,
      signature,
      plan
    );

    res.status(200).json({
      success: true,
      message: 'Subscription activated successfully'
    });

  } catch (error: any) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed'
    });
  }
});


/**
 * POST /api/v1/subscription/webhook
 * Razorpay webhook endpoint
 */
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

      case 'payment.failed':
        console.log('❌ Payment failed:', payload.payment.entity.id);
        break;

      case 'subscription.cancelled':
        console.log('🔴 Subscription cancelled');
        break;

      default:
        console.log('ℹ️ Unhandled event:', event);
    }

    res.status(200).json({ success: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});


/**
 * DELETE /api/v1/subscription/cancel
 * Cancel subscription
 */
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
      message: 'Subscription cancelled successfully'
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel subscription'
    });
  }
});


export default router;
