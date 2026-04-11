import mongoose, { Schema, Document } from 'mongoose';
import { SessionStatus } from '../types';


export interface IWhatsAppSession extends Document {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  status: SessionStatus;
  qrCode: string | null;
  connectedAt: Date | null;
  lastSeenAt: Date | null;
  connectedPhone: string | null; 
  authState: any;
  lidMap: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}


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
      default: null,
      index:   true, 
    },
    authState: {
      type: Schema.Types.Mixed,
      default: null
    },
    // Persists LID → phone mappings across server restarts.
    // WhatsApp only sends contacts once (on first QR scan), so we
    // store them here and reload on every restart instead of waiting
    // for contacts.upsert which never fires on session restore.
    lidMap: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);


export const WhatsAppSession = mongoose.model<IWhatsAppSession>(
  'WhatsAppSession',
  WhatsAppSessionSchema
);