import mongoose, { Schema, Document, Model } from 'mongoose';

import { ICampaign } from '@/types';

const CampaignSchema = new Schema<ICampaign>(
  {
    targetAudience: { type: String, required: true },
    reasonForOutreach: { type: String, required: true },
    offering: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { timestamps: true }
);

export const Campaign: Model<ICampaign> =
  mongoose.models.Campaign || mongoose.model<ICampaign>('Campaign', CampaignSchema);
