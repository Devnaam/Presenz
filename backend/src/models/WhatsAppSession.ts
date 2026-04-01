import mongoose, { Schema } from 'mongoose';
import { IWhatsAppSession, SessionStatus } from '../types';

const WhatsAppSessionSchema = new Schema<IWhatsAppSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    sessionId: {
      type: String,
      required: true,
      unique: true
    },
    status: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.PENDING_QR
    },
    qrCode: {
      type: String,
      default: null
    },
    connectedAt: {
      type: Date,
      default: null
    },
    lastSeenAt: {
      type: Date,
      default: null
    },
    authState: {
      type: Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
// WhatsAppSessionSchema.index({ userId: 1 });
// WhatsAppSessionSchema.index({ sessionId: 1 });

export const WhatsAppSession = mongoose.model<IWhatsAppSession>(
  'WhatsAppSession',
  WhatsAppSessionSchema
);