import mongoose, { Schema } from 'mongoose';
import { IFamilyContact } from '../types';

const FamilyContactSchema = new Schema<IFamilyContact>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    relation: {
      type: String,
      required: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
FamilyContactSchema.index({ userId: 1 });
FamilyContactSchema.index({ phone: 1 });

export const FamilyContact = mongoose.model<IFamilyContact>(
  'FamilyContact',
  FamilyContactSchema
);