import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserMailAccount extends Document {
  userId: string;
  provider: 'gmail' | 'microsoft';
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  active: boolean;
  connectedAt: Date;
  disconnectedAt?: Date;
}

const UserMailAccountSchema = new Schema<IUserMailAccount>({
  userId: { type: String, required: true, index: true },
  provider: { type: String, enum: ['gmail', 'microsoft'], required: true },
  email: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  tokenExpiresAt: { type: Date, required: true },
  active: { type: Boolean, default: true },
  connectedAt: { type: Date, default: Date.now },
  disconnectedAt: { type: Date },
});

UserMailAccountSchema.index({ userId: 1, active: 1 });

export const UserMailAccount: Model<IUserMailAccount> =
  mongoose.models.UserMailAccount || mongoose.model<IUserMailAccount>('UserMailAccount', UserMailAccountSchema);
