import mongoose, { Schema, Document, Model } from 'mongoose';

import { ILead } from '@/types';

const LeadSchema = new Schema<ILead>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    profileUrl: { type: String },
    source: { type: String },
    summary: { type: String },
    draftEmail: { type: String, default: '' }, // Not required — allows empty strings when AI fails
    status: { type: String, enum: ['draft', 'sent', 'bounced'], default: 'draft' },
  },
  { timestamps: true }
);

export const Lead: Model<ILead> =
  mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
