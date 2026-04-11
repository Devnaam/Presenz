import mongoose, { Schema } from 'mongoose';
import { ISubscription, SubscriptionPlan, SubscriptionStatus } from '../types';


const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    plan: {
      type: String,
      enum: Object.values(SubscriptionPlan),
      default: SubscriptionPlan.TRIAL,
    },
    razorpaySubscriptionId: {
      type: String,
      default: null,
    },
    razorpayCustomerId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.PENDING,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
      default: Date.now,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
      // default is 7 days — gets properly set when trial is activated
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },

    // ── New fields ───────────────────────────────────────────────
    cancelledAt: {
      type: Date,
      default: null,   // set when user cancels — plan stays active till currentPeriodEnd
    },
    gracePeriodEndsAt: {
      type: Date,
      default: null,   // set when payment fails — 3-day window to retry
    },
  },
  {
    timestamps: true,
  }
);


// ── Indexes ──────────────────────────────────────────────────────
SubscriptionSchema.index({ razorpaySubscriptionId: 1 });


export const Subscription = mongoose.model<ISubscription>(
  'Subscription',
  SubscriptionSchema
);