import mongoose, { Schema, Document } from 'mongoose';

export interface IConversationMeta extends Document {
  userId:    string;
  contactId: string;
  summary:   string;
  updatedAt: Date;
}

const ConversationMetaSchema = new Schema<IConversationMeta>(
  {
    userId: {
      type: String,
      required: true,
    },
    contactId: {
      type: String,
      required: true,
    },
    summary: {
      type: String,
      default: '',
      maxlength: 500,
    },
  },
  {
    timestamps: true, // gives createdAt + updatedAt automatically
  }
);

// Compound unique index — one summary doc per user+contact pair
ConversationMetaSchema.index({ userId: 1, contactId: 1 }, { unique: true });

export const ConversationMeta = mongoose.model<IConversationMeta>(
  'ConversationMeta',
  ConversationMetaSchema
);