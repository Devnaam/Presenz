import mongoose, { Schema } from 'mongoose';
import { IStudentStatus, StudentMode } from '../types';

const StudentStatusSchema = new Schema<IStudentStatus>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    mode: {
      type: String,
      enum: Object.values(StudentMode),
      default: StudentMode.AVAILABLE
    },
    autoAwayEnabled: {
      type: Boolean,
      default: true
    },
    autoAwayMinutes: {
      type: Number,
      default: 30
    },
    lastActiveAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Indexes

export const StudentStatus = mongoose.model<IStudentStatus>(
  'StudentStatus',
  StudentStatusSchema
);