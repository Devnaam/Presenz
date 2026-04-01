import mongoose, { Schema } from 'mongoose';
import { IMessage, MessageDirection, MessageType, MessageStatus } from '../types';

const MessageSchema = new Schema<IMessage>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'FamilyContact',
      required: true
    },
    direction: {
      type: String,
      enum: Object.values(MessageDirection),
      required: true
    },
    type: {
      type: String,
      enum: Object.values(MessageType),
      required: true
    },
    originalContent: {
      type: String,
      required: true
    },
    transcribedText: {
      type: String,
      default: null
    },
    finalText: {
      type: String,
      default: null
    },
    generatedByAI: {
      type: Boolean,
      default: false
    },
    studentOverride: {
      type: Boolean,
      default: false
    },
    language: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: Object.values(MessageStatus),
      default: MessageStatus.RECEIVED
    },
    whatsappMessageId: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Indexes
MessageSchema.index({ userId: 1 });
MessageSchema.index({ contactId: 1 });
MessageSchema.index({ timestamp: -1 });
MessageSchema.index({ userId: 1, contactId: 1, timestamp: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);