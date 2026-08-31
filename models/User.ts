import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  tier: 'Free' | 'Basic' | 'Pro';
  leadsUsedThisMonth: number;
  lastResetDate: Date;
  isAdmin: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  tier: { type: String, enum: ['Free', 'Basic', 'Pro'], default: 'Free' },
  leadsUsedThisMonth: { type: Number, default: 0 },
  lastResetDate: { type: Date, default: Date.now },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
