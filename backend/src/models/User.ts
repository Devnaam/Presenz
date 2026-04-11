import mongoose, { Schema } from 'mongoose';
import { IUser, SubscriptionStatus, SubscriptionPlan } from '../types';


// ─── Referral code generator ────────────────────────────────────
// 6-char alphanumeric uppercase — e.g. "X7KP2R"
// Uses Math.random — no extra dependency needed
const generateReferralCode = (): string =>
  Math.random().toString(36).substring(2, 8).toUpperCase();


const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      unique: true,   // ← ADD THIS
      sparse: true,   // ← ADD THIS (handles any legacy null values safely)
    },

    // ── Subscription ─────────────────────────────────────────────
    subscriptionStatus: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.PENDING,   // PENDING until trial activated
    },
    plan: {
      type: String,
      enum: Object.values(SubscriptionPlan),
      default: SubscriptionPlan.TRIAL,
    },
    trialActivatedAt: {
      type: Date,
      default: null,   // null until user clicks "Activate My Free Trial"
    },
    trialEndsAt: {
      type: Date,
      default: null,   // set only when activateTrial() is called
    },

    // ── Daily reply usage ────────────────────────────────────────
    repliesUsedToday: {
      type: Number,
      default: 0,
    },
    repliesResetAt: {
      type: Date,
      default: Date.now,   // initialised to registration time, resets daily
    },

    // ── Referral system ──────────────────────────────────────────
    referralCode: {
      type: String,
      unique: true,
      default: generateReferralCode,
    },
    referredBy: {
      type: String,
      default: null,   // stores the referralCode of whoever referred this user
    },
    bonusDays: {
      type: Number,
      default: 0,   // extra days earned via referrals, added to trialEndsAt
    },
  },
  {
    timestamps: true,
  }
);


// ── Indexes ──────────────────────────────────────────────────────
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });
UserSchema.index({ referralCode: 1 });


export const User = mongoose.model<IUser>('User', UserSchema);