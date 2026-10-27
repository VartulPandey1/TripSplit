import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRateLimit extends Document {
  key: string;
  timestamps: Date[];
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true, unique: true, index: true },
  timestamps: [{ type: Date, required: true }],
  expiresAt: { type: Date, required: true, expires: 0 },
});

const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>('RateLimit', RateLimitSchema);

export default RateLimit;
