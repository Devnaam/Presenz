import mongoose, { Schema } from 'mongoose';
import { IPersonalityProfile, MessageSender } from '../types';


const RawMessageSchema = new Schema(
  {
    timestamp: {
      type: Date,
      required: true
    },
    sender: {
      type: String,
      enum: Object.values(MessageSender),
      required: true
    },
    text: {
      type: String,
      required: true
    },
    language: {
      type: String,
      required: true
    }
  },
  { _id: false }
);


const PersonalityProfileSchema = new Schema<IPersonalityProfile>(
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
    rawMessages: {
      type: [RawMessageSchema],
      default: []
    },
    processedAt: {
      type: Date,
      default: null
    },
    messageCount: {
      type: Number,
      default: 0
    },
    dominantLanguages: {
      type: [String],
      default: []
    },
    systemPrompt: {
      type: String,
      default: ''
    },
    knowledgeBase: {
      type: String,
      default: ''
    },
    // ✅ NEW — AI-analyzed summary of how the CONTACT texts
    // Generated during chat upload, used in buildSystemPrompt
    contactStyleSummary: {
      type: String,
      default: ''
    },
    // ✅ NEW — Topics user wants AI to never bring up with this contact
    // e.g. ['exams', 'money', 'ex-girlfriend']
    sensitiveTopics: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);


// Indexes
PersonalityProfileSchema.index({ userId: 1 });
PersonalityProfileSchema.index({ contactId: 1 });
PersonalityProfileSchema.index({ userId: 1, contactId: 1 }, { unique: true });


export const PersonalityProfile = mongoose.model<IPersonalityProfile>(
  'PersonalityProfile',
  PersonalityProfileSchema
);