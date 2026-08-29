import mongoose, { Schema, Document, Model } from 'mongoose';

import { ICampaign } from '@/types';

const CampaignSchema = new Schema<ICampaign>(
  {
    targetAudience: { type: String, required: true },
    reasonForOutreach: { type: String, required: true },
    offering: { type: String, required: true },
    userId: { type: String, required: true },
    followUpEnabled: { type: Boolean, default: false },
    followUpDelayDays: { type: Number, default: 3 },
    maxFollowUps: { type: Number, default: 2 },
  },
  { timestamps: true }
);

export const Campaign: Model<ICampaign> =
  mongoose.models.Campaign || mongoose.model<ICampaign>('Campaign', CampaignSchema);
