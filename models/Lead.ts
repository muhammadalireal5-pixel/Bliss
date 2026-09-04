import mongoose, { Schema, Document, Model } from 'mongoose';
import { ILead } from '@/types';
import crypto from 'crypto';

const LeadSchema = new Schema<ILead>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    userId: { type: String, required: true },
    trackingId: { type: String, default: () => crypto.randomUUID(), index: true },
    name: { type: String, required: true },
    email: { type: String, default: '' },
    contactMethod: { type: String, enum: ['email', 'source-only'], default: 'email' },
    contactSource: { type: String, default: '' },
    confidence: { type: String, default: 'verified' },
    profileUrl: { type: String },
    source: { type: String },
    summary: { type: String },
    subject: { type: String, default: '' },
    draftEmail: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'queued', 'sent', 'replied', 'stopped', 'bounced', 'unsubscribed'], default: 'draft' },
    opens: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    step: { type: Number, default: 1 },
    sendAt: { type: Date },
  },
  { timestamps: true }
);

LeadSchema.index({ userId: 1, email: 1 });
LeadSchema.index({ userId: 1, contactSource: 1 });

export const Lead: Model<ILead> =
  mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);
