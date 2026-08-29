import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITrackingEvent extends Document {
  trackingId: string;
  leadId: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  userId: string;
  type: 'open' | 'click';
  url?: string;
  firstAt: Date;
  count: number;
}

const TrackingEventSchema = new Schema<ITrackingEvent>({
  trackingId: { type: String, required: true, index: true },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
  userId: { type: String, required: true },
  type: { type: String, enum: ['open', 'click'], required: true },
  url: { type: String },
  firstAt: { type: Date, default: Date.now },
  count: { type: Number, default: 0 }
});

export const TrackingEvent: Model<ITrackingEvent> = 
  mongoose.models.TrackingEvent || mongoose.model<ITrackingEvent>('TrackingEvent', TrackingEventSchema);
