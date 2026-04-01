import mongoose, { Schema } from 'mongoose';
import { ISubscription, SubscriptionPlan, SubscriptionStatus } from '../types';

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    plan: {
      type: String,
      enum: Object.values(SubscriptionPlan),
      default: SubscriptionPlan.TRIAL
    },
    razorpaySubscriptionId: {
      type: String,
      default: null
    },
    razorpayCustomerId: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.TRIAL
    },
    currentPeriodStart: {
      type: Date,
      required: true,
      default: Date.now
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  },
  {
    timestamps: true
  }
);

// Indexes
// SubscriptionSchema.index({ userId: 1 });
SubscriptionSchema.index({ razorpaySubscriptionId: 1 });

export const Subscription = mongoose.model<ISubscription>(
  'Subscription',
  SubscriptionSchema
);