import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITrip extends Document {
  name: string;
  destinationQuery: string;
  roomCode: string;
  creatorId: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  status: 'active' | 'completed' | 'reopened';
  startDate: Date;
  endDate: Date;
  currency: string;
  notes?: string;
}

const TripSchema = new Schema<ITrip>({
  name: { type: String, required: true, trim: true, minlength: 1 },
  destinationQuery: { type: String, required: true, trim: true, minlength: 1 },
  roomCode: { type: String, required: true, unique: true, uppercase: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['active', 'completed', 'reopened'], default: 'active' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  currency: { type: String, default: 'INR' },
  notes: { type: String, default: '' },
});
(TripSchema as any).set('strictPopulate', false);

/**
 * Checks if a trip has passed its end date.
 * Uses the end of the end date (23:59:59.999 UTC) so trips remain active during their final day.
 */
export function isTripCompleted(trip: { status?: string; endDate?: Date | string | null }): boolean {
  if (trip.status === 'completed') return true;
  if (!trip.endDate) return false;
  const end = new Date(trip.endDate);
  if (isNaN(end.getTime())) return false;
  end.setUTCHours(23, 59, 59, 999);
  return Date.now() > end.getTime();
}

/**
 * Resolves the computed trip status ('active' | 'completed')
 */
export function getTripStatus(trip: { status?: string; endDate?: Date | string | null }): 'active' | 'completed' {
  return isTripCompleted(trip) ? 'completed' : 'active';
}

/**
 * Auto-transitions all active trips whose end date has passed to 'completed' in MongoDB
 */
export async function autoUpdateExpiredTrips(userId?: string): Promise<void> {
  try {
    const endThreshold = new Date();
    // Match any active trip where endDate is in the past
    const query: any = {
      status: 'active',
      endDate: { $lt: endThreshold },
    };
    if (userId) {
      query.$or = [{ members: userId }, { creatorId: userId }];
    }
    await Trip.updateMany(query, { $set: { status: 'completed' } });
  } catch (err) {
    console.error('Failed to auto-update expired trips:', err);
  }
}

// Pre-save hook: auto-set completed if endDate has already passed and not explicitly reopened
TripSchema.pre('save', function () {
  if (this.status !== 'reopened' && this.endDate && isTripCompleted({ status: this.status, endDate: this.endDate })) {
    this.status = 'completed';
  }
});

if (mongoose.models.Trip && !mongoose.models.Trip.schema.paths.notes) {
  delete (mongoose.models as any).Trip;
}

const Trip: Model<ITrip> = mongoose.models.Trip || mongoose.model<ITrip>('Trip', TripSchema);
export default Trip;
