import { razorpay } from '../config/razorpay';
import { Subscription, User } from '../models';
import { SubscriptionPlan, SubscriptionStatus } from '../types';
import { getSubscriptionEndDate } from '../utils/payment';

// Plan pricing (in paise - ₹1 = 100 paise)
const PLANS = {
  basic: {
    amount: 29900, // ₹299
    name: 'Basic Plan',
    description: 'Essential features for staying connected',
    period: 30, // days
  },
  pro: {
    amount: 49900, // ₹499
    name: 'Pro Plan',
    description: 'Advanced features with priority support',
    period: 30, // days
  },
};

class SubscriptionService {
  
  /**
   * Create Razorpay order for subscription
   */
  async createSubscriptionOrder(
    userId: string,
    plan: 'basic' | 'pro'
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    plan: string;
  }> {
    try {
      const planDetails = PLANS[plan];

      if (!planDetails) {
        throw new Error('Invalid plan selected');
      }

      // Create Razorpay order
      const order = await razorpay.orders.create({
        amount: planDetails.amount,
        currency: 'INR',
        receipt: `receipt_${userId}_${Date.now()}`,
        notes: {
          userId,
          plan,
        },
      });

      return {
        orderId: order.id,
        amount: planDetails.amount,
        currency: 'INR',
        plan: planDetails.name,
      };

    } catch (error: any) {
      console.error('Error creating subscription order:', error);
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  /**
   * Verify payment and activate subscription
   */
  async verifyAndActivateSubscription(
    userId: string,
    orderId: string,
    paymentId: string,
    signature: string,
    plan: 'basic' | 'pro'
  ): Promise<void> {
    try {
      // Verify signature
      const text = `${orderId}|${paymentId}`;
      const generatedSignature = require('crypto')
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(text)
        .digest('hex');

      if (generatedSignature !== signature) {
        throw new Error('Invalid payment signature');
      }

      // Fetch payment details from Razorpay
      const payment = await razorpay.payments.fetch(paymentId);

      if (payment.status !== 'captured') {
        throw new Error('Payment not captured');
      }

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = getSubscriptionEndDate(startDate);

      // Create or update subscription
      await Subscription.findOneAndUpdate(
        { userId },
        {
          userId,
          plan: plan === 'basic' ? SubscriptionPlan.BASIC : SubscriptionPlan.PRO,
          razorpaySubscriptionId: paymentId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate,
        },
        { upsert: true, new: true }
      );

      // Update user subscription status
      await User.findByIdAndUpdate(userId, {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      });

      console.log(`✅ Subscription activated for user: ${userId}`);

    } catch (error: any) {
      console.error('Error verifying payment:', error);
      throw new Error(`Payment verification failed: ${error.message}`);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    try {
      const subscription = await Subscription.findOne({ userId });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Update subscription status
      subscription.status = SubscriptionStatus.EXPIRED;
      await subscription.save();

      // Update user status
      await User.findByIdAndUpdate(userId, {
        subscriptionStatus: SubscriptionStatus.EXPIRED,
      });

      console.log(`✅ Subscription cancelled for user: ${userId}`);

    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(userId: string) {
    const subscription = await Subscription.findOne({ userId });
    return subscription;
  }

  /**
   * Check and update expired subscriptions (cron job)
   */
  async checkExpiredSubscriptions(): Promise<void> {
    try {
      const now = new Date();

      // Find all active subscriptions that have expired
      const expiredSubscriptions = await Subscription.find({
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { $lt: now },
      });

      console.log(`🔍 Found ${expiredSubscriptions.length} expired subscriptions`);

      for (const sub of expiredSubscriptions) {
        // Update subscription status
        sub.status = SubscriptionStatus.EXPIRED;
        await sub.save();

        // Update user status
        await User.findByIdAndUpdate(sub.userId, {
          subscriptionStatus: SubscriptionStatus.EXPIRED,
        });

        console.log(`⏰ Subscription expired for user: ${sub.userId}`);
      }

    } catch (error) {
      console.error('Error checking expired subscriptions:', error);
    }
  }

  /**
   * Check if user can use AI features
   */
  async canUseAI(userId: string): Promise<boolean> {
    const user = await User.findById(userId);

    if (!user) {
      return false;
    }

    // Trial users can use until trial ends
    if (user.subscriptionStatus === SubscriptionStatus.TRIAL) {
      return new Date() < new Date(user.trialEndsAt);
    }

    // Active paid users can use
    if (user.subscriptionStatus === SubscriptionStatus.ACTIVE) {
      return true;
    }

    // Expired users cannot use
    return false;
  }
}

export default new SubscriptionService();