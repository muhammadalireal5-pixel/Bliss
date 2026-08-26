import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILead extends Document {
  campaignId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  profileUrl?: string;
  source?: string; // e.g., LinkedIn, Reddit, Generic Web
  draftEmail: string;
  status: 'draft' | 'sent' | 'bounced';
  createdAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    profileUrl: { type: String },
    source: { type: String },
    draftEmail: { type: String, default: '' }, // Not required — allows empty strings when AI fails
    status: { type: String, enum: ['draft', 'sent', 'bounced'], default: 'draft' },
  },
  { timestamps: true }
);

export const Lead: Model<ILead> =
  mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
