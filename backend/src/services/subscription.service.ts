import crypto from 'crypto';
import { razorpay } from '../config/razorpay';
import { Subscription, User } from '../models';
import { SubscriptionPlan, SubscriptionStatus } from '../types';
import { getSubscriptionEndDate } from '../utils/payment';


// ─────────────────────────────────────────────────────────────────
// Plan config — single source of truth
// Prices in paise (₹1 = 100 paise)
// ─────────────────────────────────────────────────────────────────
const PLAN_CONFIG = {
  pro: {
    amount: 29900,           // ₹299
    name: 'Pro Plan',
    description: '5 contacts, 500 AI replies/day',
    contacts: 5,
    repliesPerDay: 500,
    period: 30,              // days
  },
  business: {
    amount: 99900,           // ₹999
    name: 'Business Plan',
    description: '25 contacts, unlimited AI replies',
    contacts: 25,
    repliesPerDay: Infinity,
    period: 30,
  },
};

const TRIAL_LIMITS = {
  contacts: 1,
  repliesPerDay: 100,
};

// How many referral rewards a single user can earn (max 21 bonus days)
const MAX_REFERRAL_REWARDS = 3;
const REFERRAL_BONUS_DAYS = 7;

// Grace period after payment failure (days)
// const GRACE_PERIOD_DAYS = 3;


// ─────────────────────────────────────────────────────────────────
// Types for return values
// ─────────────────────────────────────────────────────────────────
export interface PlanLimits {
  contacts: number;
  repliesPerDay: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  plan: string;
  code?: string;   // 'CONTACT_LIMIT_REACHED' | 'REPLY_LIMIT_REACHED'
}

export interface SubscriptionWithStatus {
  subscription: any;
  plan: string;
  status: string;
  daysLeft: number;
  isTrialActive: boolean;
  isPaid: boolean;
  isExpired: boolean;
  isPending: boolean;
  contactLimit: number;
  replyLimit: number;
  repliesUsedToday: number;
}


// ─────────────────────────────────────────────────────────────────
class SubscriptionService {

  // ── 1. getPlanLimits ─────────────────────────────────────────
  // Single source of truth — every limit check calls this
  getPlanLimits(plan: string): PlanLimits {
    if (plan === 'pro') return { contacts: PLAN_CONFIG.pro.contacts, repliesPerDay: PLAN_CONFIG.pro.repliesPerDay };
    if (plan === 'business') return { contacts: PLAN_CONFIG.business.contacts, repliesPerDay: PLAN_CONFIG.business.repliesPerDay };
    // trial / pending / expired — trial limits apply (expired still shows limit, enforcement handled separately)
    return { contacts: TRIAL_LIMITS.contacts, repliesPerDay: TRIAL_LIMITS.repliesPerDay };
  }


  // ── 2. activateTrial ─────────────────────────────────────────
  // Called when user clicks "Activate My Free Trial"
  // Only works if status is PENDING — prevents double activation
  async activateTrial(userId: string, referralCode?: string): Promise<{
    trialEndsAt: Date;
    status: string;
    plan: string;
  }> {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.subscriptionStatus !== SubscriptionStatus.PENDING) {
      throw new Error('Trial already activated or subscription already exists');
    }

    const now = new Date();
    const baseDays = 7;
    const totalDays = baseDays + (user.bonusDays || 0);
    const trialEndsAt = new Date(now.getTime() + totalDays * 24 * 60 * 60 * 1000);

    // Update user
    await User.findByIdAndUpdate(userId, {
      subscriptionStatus: SubscriptionStatus.TRIAL,
      trialActivatedAt: now,
      trialEndsAt,
    });

    // Create subscription record
    await Subscription.findOneAndUpdate(
      { userId },
      {
        userId,
        plan: SubscriptionPlan.TRIAL,
        status: SubscriptionStatus.TRIAL,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        cancelledAt: null,
        gracePeriodEndsAt: null,
      },
      { upsert: true, new: true }
    );

    // Apply referral reward if a code was passed
    if (referralCode) {
      await this.applyReferralReward(referralCode, userId);
    }

    console.log(`✅ Trial activated for user: ${userId} — ends ${trialEndsAt.toISOString()}`);

    return {
      trialEndsAt,
      status: SubscriptionStatus.TRIAL,
      plan: SubscriptionPlan.TRIAL,
    };
  }


  // ── 3. checkContactLimit ─────────────────────────────────────
  // Called before adding a new contact
  async checkContactLimit(userId: string): Promise<LimitCheckResult> {
    const user = await User.findById(userId);

    if (!user) {
      return { allowed: false, current: 0, limit: 0, plan: 'unknown', code: 'USER_NOT_FOUND' };
    }

    // Expired or pending users cannot add contacts
    if (
      user.subscriptionStatus === SubscriptionStatus.EXPIRED ||
      user.subscriptionStatus === SubscriptionStatus.PENDING
    ) {
      return {
        allowed: false,
        current: 0,
        limit: 0,
        plan: user.plan,
        code: 'SUBSCRIPTION_REQUIRED',
      };
    }

    const limits = this.getPlanLimits(user.plan);

    // Business plan — unlimited contacts
    if (limits.contacts === Infinity || limits.contacts >= 999) {
      return { allowed: true, current: 0, limit: Infinity, plan: user.plan };
    }

    // Count existing active contacts for this user
    const FamilyContact = (await import('../models')).FamilyContact;
    const current = await FamilyContact.countDocuments({ userId, isActive: true });

    const allowed = current < limits.contacts;

    return {
      allowed,
      current,
      limit: limits.contacts,
      plan: user.plan,
      code: allowed ? undefined : 'CONTACT_LIMIT_REACHED',
    };
  }


  // ── 4. checkReplyLimit ───────────────────────────────────────
  // Called before generating every AI reply
  async checkReplyLimit(userId: string): Promise<LimitCheckResult> {
    const user = await User.findById(userId);

    if (!user) {
      return { allowed: false, current: 0, limit: 0, plan: 'unknown', code: 'USER_NOT_FOUND' };
    }

    // Expired / pending — no replies allowed
    if (
      user.subscriptionStatus === SubscriptionStatus.EXPIRED ||
      user.subscriptionStatus === SubscriptionStatus.PENDING
    ) {
      return {
        allowed: false,
        current: user.repliesUsedToday,
        limit: 0,
        plan: user.plan,
        code: 'SUBSCRIPTION_REQUIRED',
      };
    }

    // Trial — check trial expiry
    if (user.subscriptionStatus === SubscriptionStatus.TRIAL) {
      if (!user.trialEndsAt || new Date() > new Date(user.trialEndsAt)) {
        // Trial has expired — update status
        await User.findByIdAndUpdate(userId, {
          subscriptionStatus: SubscriptionStatus.EXPIRED,
        });
        return {
          allowed: false,
          current: user.repliesUsedToday,
          limit: TRIAL_LIMITS.repliesPerDay,
          plan: user.plan,
          code: 'TRIAL_EXPIRED',
        };
      }
    }

    // Reset daily counter if it's a new day
    const resetUser = await this._resetDailyCounterIfNeeded(user);

    const limits = this.getPlanLimits(resetUser.plan);

    // Business plan — unlimited
    if (limits.repliesPerDay === Infinity) {
      return {
        allowed: true,
        current: resetUser.repliesUsedToday,
        limit: Infinity,
        plan: resetUser.plan,
      };
    }

    const allowed = resetUser.repliesUsedToday < limits.repliesPerDay;

    return {
      allowed,
      current: resetUser.repliesUsedToday,
      limit: limits.repliesPerDay,
      plan: resetUser.plan,
      code: allowed ? undefined : 'REPLY_LIMIT_REACHED',
    };
  }


  // ── 5. incrementReplyCount ───────────────────────────────────
  // Called after every successful AI reply
  async incrementReplyCount(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $inc: { repliesUsedToday: 1 },
    });
  }


  // ── 6. applyReferralReward ───────────────────────────────────
  // Called when a new user activates trial with a referral code
  // Referrer gets +7 bonus days (max 3 referrals = 21 days total)
  async applyReferralReward(referralCode: string, newUserId: string): Promise<void> {
    try {
      // Find the referrer
      const referrer = await User.findOne({ referralCode });

      if (!referrer) {
        console.log(`ℹ️ Referral code ${referralCode} not found — skipping reward`);
        return;
      }

      // Don't reward self-referral
      if (referrer._id.toString() === newUserId) {
        console.log(`⚠️ Self-referral attempt by user: ${newUserId} — skipping`);
        return;
      }

      // Count how many referrals this user has already earned rewards for
      const existingReferrals = await User.countDocuments({
        referredBy: referralCode,
        subscriptionStatus: { $ne: SubscriptionStatus.PENDING }, // only activated users count
      });

      if (existingReferrals > MAX_REFERRAL_REWARDS) {
        console.log(`ℹ️ Referrer ${referrer._id} has already earned max referral rewards`);
        return;
      }

      // Mark the new user as referred
      await User.findByIdAndUpdate(newUserId, {
        referredBy: referralCode,
      });

      // Add bonus days to referrer
      const newBonusDays = (referrer.bonusDays || 0) + REFERRAL_BONUS_DAYS;

      await User.findByIdAndUpdate(referrer._id, {
        bonusDays: newBonusDays,
      });

      // If referrer is on an active trial, extend it immediately
      if (
        referrer.subscriptionStatus === SubscriptionStatus.TRIAL &&
        referrer.trialEndsAt
      ) {
        const newTrialEndsAt = new Date(
          new Date(referrer.trialEndsAt).getTime() + REFERRAL_BONUS_DAYS * 24 * 60 * 60 * 1000
        );

        await User.findByIdAndUpdate(referrer._id, { trialEndsAt: newTrialEndsAt });
        await Subscription.findOneAndUpdate(
          { userId: referrer._id },
          { currentPeriodEnd: newTrialEndsAt }
        );

        console.log(`🎁 Referral reward: +${REFERRAL_BONUS_DAYS} days added to user ${referrer._id}`);
      }

    } catch (error) {
      // Referral reward is non-critical — log but don't throw
      console.error('Error applying referral reward:', error);
    }
  }


  // ── 7. createSubscriptionOrder ───────────────────────────────
  // Creates a Razorpay order — updated to pro/business
  async createSubscriptionOrder(
    userId: string,
    plan: 'pro' | 'business'
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    plan: string;
  }> {
    const planDetails = PLAN_CONFIG[plan];

    if (!planDetails) {
      throw new Error('Invalid plan. Must be "pro" or "business"');
    }

    const order = await razorpay.orders.create({
      amount: planDetails.amount,
      currency: 'INR',
      receipt: `r_${userId.slice(-8)}_${Date.now().toString().slice(-10)}`,
      notes: { userId, plan },
    });

    return {
      orderId: order.id,
      amount: planDetails.amount,
      currency: 'INR',
      plan: planDetails.name,
    };
    console.log('KEY BEING USED:', process.env.RAZORPAY_KEY_ID);
    console.log('SECRET LENGTH:', process.env.RAZORPAY_KEY_SECRET?.length);
  }


  // ── 8. verifyAndActivateSubscription ─────────────────────────
  // Verifies Razorpay payment + activates paid plan
  async verifyAndActivateSubscription(
    userId: string,
    orderId: string,
    paymentId: string,
    signature: string,
    plan: 'pro' | 'business'
  ): Promise<void> {
    // Verify signature
    const text = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest('hex');

    if (generatedSignature !== signature) {
      throw new Error('Invalid payment signature');
    }

    // Verify payment was actually captured
    const payment = await razorpay.payments.fetch(paymentId);

    if (payment.status !== 'captured') {
      throw new Error('Payment not captured');
    }

    const startDate = new Date();
    const endDate = getSubscriptionEndDate(startDate);
    const planEnum = plan === 'pro' ? SubscriptionPlan.PRO : SubscriptionPlan.BUSINESS;

    // Create / update subscription record
    await Subscription.findOneAndUpdate(
      { userId },
      {
        userId,
        plan: planEnum,
        razorpaySubscriptionId: paymentId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        cancelledAt: null,
        gracePeriodEndsAt: null,
      },
      { upsert: true, new: true }
    );

    // Update user
    await User.findByIdAndUpdate(userId, {
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      plan: planEnum,
    });

    console.log(`✅ Paid subscription activated — user: ${userId}, plan: ${plan}`);
  }


  // ── 9. cancelSubscription ────────────────────────────────────
  // Sets cancelledAt but keeps plan ACTIVE until currentPeriodEnd
  // (user already paid for the period — don't cut them off immediately)
  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new Error('Subscription is not currently active');
    }

    const now = new Date();

    // Mark cancelled but stay ACTIVE till period ends
    await Subscription.findOneAndUpdate(
      { userId },
      { cancelledAt: now }
      // status stays ACTIVE — cron job will expire it at currentPeriodEnd
    );

    console.log(`🔴 Subscription cancelled for user: ${userId} — active until ${subscription.currentPeriodEnd}`);
  }


  // ── 10. getSubscription ──────────────────────────────────────
  // Returns subscription + computed fields the frontend needs
  async getSubscription(userId: string): Promise<SubscriptionWithStatus | null> {
    const user = await User.findById(userId);
    const subscription = await Subscription.findOne({ userId });

    if (!user) return null;

    const now = new Date();
    const limits = this.getPlanLimits(user.plan);

    // Calculate days left
    let daysLeft = 0;
    if (subscription?.currentPeriodEnd) {
      const msLeft = new Date(subscription.currentPeriodEnd).getTime() - now.getTime();
      daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    }

    const isTrialActive = user.subscriptionStatus === SubscriptionStatus.TRIAL && daysLeft > 0;
    const isPaid = user.subscriptionStatus === SubscriptionStatus.ACTIVE;
    const isExpired = user.subscriptionStatus === SubscriptionStatus.EXPIRED;
    const isPending = user.subscriptionStatus === SubscriptionStatus.PENDING;

    // Reset daily counter if needed before returning usage
    const freshUser = await this._resetDailyCounterIfNeeded(user);

    return {
      subscription,
      plan: user.plan,
      status: user.subscriptionStatus,
      daysLeft,
      isTrialActive,
      isPaid,
      isExpired,
      isPending,
      contactLimit: limits.contacts === Infinity ? 999999 : limits.contacts,
      replyLimit: limits.repliesPerDay === Infinity ? 999999 : limits.repliesPerDay,
      repliesUsedToday: freshUser.repliesUsedToday,
    };
  }


  // ── 11. checkExpiredSubscriptions (cron job) ─────────────────
  // Run this daily — expires trials, expires cancelled plans, clears grace periods
  async checkExpiredSubscriptions(): Promise<void> {
    const now = new Date();

    // ── a) Expire active PAID subscriptions past currentPeriodEnd ──
    const expiredPaid = await Subscription.find({
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { $lt: now },
      cancelledAt: { $ne: null },  // only if user already cancelled
    });

    for (const sub of expiredPaid) {
      sub.status = SubscriptionStatus.EXPIRED;
      await sub.save();
      await User.findByIdAndUpdate(sub.userId, {
        subscriptionStatus: SubscriptionStatus.EXPIRED,
        plan: SubscriptionPlan.TRIAL,
      });
      console.log(`⏰ Cancelled paid subscription expired — user: ${sub.userId}`);
    }

    // ── b) Expire active TRIAL subscriptions past trialEndsAt ──
    const expiredTrials = await User.find({
      subscriptionStatus: SubscriptionStatus.TRIAL,
      trialEndsAt: { $lt: now },
    });

    for (const user of expiredTrials) {
      await User.findByIdAndUpdate(user._id, {
        subscriptionStatus: SubscriptionStatus.EXPIRED,
      });
      await Subscription.findOneAndUpdate(
        { userId: user._id },
        { status: SubscriptionStatus.EXPIRED }
      );
      console.log(`⏰ Trial expired — user: ${user._id}`);
    }

    // ── c) Handle grace period end — expire users who didn't fix payment ──
    const graceExpired = await Subscription.find({
      status: SubscriptionStatus.GRACE,
      gracePeriodEndsAt: { $lt: now },
    });

    for (const sub of graceExpired) {
      sub.status = SubscriptionStatus.EXPIRED;
      await sub.save();
      await User.findByIdAndUpdate(sub.userId, {
        subscriptionStatus: SubscriptionStatus.EXPIRED,
        plan: SubscriptionPlan.TRIAL,
      });
      console.log(`⏰ Grace period expired — user: ${sub.userId}`);
    }

    console.log(
      `✅ Cron complete — ${expiredPaid.length} paid expired, ` +
      `${expiredTrials.length} trials expired, ` +
      `${graceExpired.length} grace periods ended`
    );
  }


  // ── 12. canUseAI ─────────────────────────────────────────────
  // Quick boolean — used by the existing checkSubscription middleware
  // Kept for backward compatibility
  async canUseAI(userId: string): Promise<boolean> {
    const result = await this.checkReplyLimit(userId);
    return result.allowed;
  }


  // ── Private: _resetDailyCounterIfNeeded ──────────────────────
  // Resets repliesUsedToday to 0 if it's a new day since repliesResetAt
  private async _resetDailyCounterIfNeeded(user: any): Promise<any> {
    const now = new Date();
    const resetAt = new Date(user.repliesResetAt || now);

    // Check if reset date is from a previous calendar day
    const isNewDay =
      now.getUTCFullYear() !== resetAt.getUTCFullYear() ||
      now.getUTCMonth() !== resetAt.getUTCMonth() ||
      now.getUTCDate() !== resetAt.getUTCDate();

    if (isNewDay) {
      const updated = await User.findByIdAndUpdate(
        user._id,
        {
          repliesUsedToday: 0,
          repliesResetAt: now,
        },
        { new: true }
      );
      console.log(`🔄 Daily reply counter reset for user: ${user._id}`);
      return updated;
    }

    return user;
  }
}


export default new SubscriptionService();