import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICampaign extends Document {
  targetAudience: string;
  reasonForOutreach: string;
  offering: string;
  createdAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    targetAudience: { type: String, required: true },
    reasonForOutreach: { type: String, required: true },
    offering: { type: String, required: true },
  },
  { timestamps: true }
);

export const Campaign: Model<ICampaign> =
  mongoose.models.Campaign || mongoose.model<ICampaign>('Campaign', CampaignSchema);
