import mongoose, { Schema, Document } from 'mongoose';

export type ActivityEventType =
  | 'account.registered'
  | 'account.onboarded'
  | 'subscription.trial_activated'
  | 'subscription.upgraded'
  | 'subscription.cancelled'
  | 'subscription.expired'
  | 'subscription.referral_earned'
  | 'whatsapp.connected'
  | 'whatsapp.disconnected'
  | 'whatsapp.rejected'
  | 'contact.added'
  | 'contact.removed'
  | 'contact.profile_created';

export interface IActivityLog extends Document {
  userId: mongoose.Types.ObjectId;
  type: ActivityEventType;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type:        { type: String, required: true },
    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    metadata:    { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ userId: 1, createdAt: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);