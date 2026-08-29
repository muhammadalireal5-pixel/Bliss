import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISuppression extends Document {
  userId: string;
  email: string;
  reason: 'unsubscribe' | 'bounce' | 'manual';
  suppressedAt: Date;
}

const SuppressionSchema = new Schema<ISuppression>({
  userId: { type: String, required: true },
  email: { type: String, required: true },
  reason: { type: String, enum: ['unsubscribe', 'bounce', 'manual'], required: true },
  suppressedAt: { type: Date, default: Date.now }
});

SuppressionSchema.index({ userId: 1, email: 1 }, { unique: true });

export const Suppression: Model<ISuppression> = 
  mongoose.models.Suppression || mongoose.model<ISuppression>('Suppression', SuppressionSchema);
