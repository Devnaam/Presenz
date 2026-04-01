import mongoose, { Schema } from 'mongoose';
import { IUser, SubscriptionStatus } from '../types';

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    subscriptionStatus: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.TRIAL
    },
    trialEndsAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    }
  },
  {
    timestamps: true
  }
);

// Indexes
UserSchema.index({ phone: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);