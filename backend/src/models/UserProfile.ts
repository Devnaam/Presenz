import mongoose, { Schema } from 'mongoose';
import { IUserProfile, AILanguage, AITone, AILength } from '../types';


const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    aboutMe: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    aiLanguage: {
      type: String,
      enum: Object.values(AILanguage),
      default: AILanguage.AUTO,
    },
    aiTone: {
      type: String,
      enum: Object.values(AITone),
      default: AITone.FRIENDLY,
    },
    aiLength: {
      type: String,
      enum: Object.values(AILength),
      default: AILength.MATCH,
    },
  },
  { timestamps: true }
);


export const UserProfile = mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);