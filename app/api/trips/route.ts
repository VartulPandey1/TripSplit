import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Trip, { autoUpdateExpiredTrips, isTripCompleted } from '@/lib/db/models/Trip';
import User from '@/lib/db/models/User';
import { generateRoomCode } from '@/lib/utils/roomCode';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  // Auto-complete any trips whose end date has passed
  await autoUpdateExpiredTrips(session.user.id);

  const user = await User.findById(session.user.id).populate('tripIds');
  return NextResponse.json(user?.tripIds ?? []);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, destinationQuery, startDate, endDate, currency, notes } = body;

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedDest = typeof destinationQuery === 'string' ? destinationQuery.trim() : '';

  if (!trimmedName) {
    return NextResponse.json({ error: 'Trip name cannot be blank' }, { status: 400 });
  }
  if (!trimmedDest) {
    return NextResponse.json({ error: 'Destination cannot be blank' }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid start or end date' }, { status: 400 });
  }

  // Enforce start date <= end date
  if (start > end) {
    return NextResponse.json({ error: 'End date cannot be earlier than start date' }, { status: 400 });
  }

  // Set end date to the end of the day so the trip remains active on its final day
  end.setUTCHours(23, 59, 59, 999);

  const initialStatus = isTripCompleted({ endDate: end }) ? 'completed' : 'active';

  await connectDB();
  let roomCode = generateRoomCode();
  while (await Trip.findOne({ roomCode })) roomCode = generateRoomCode();

  const trip = await Trip.create({
    name: trimmedName,
    destinationQuery: trimmedDest,
    startDate: start,
    endDate: end,
    status: initialStatus,
    roomCode,
    currency: currency || 'INR',
    notes: typeof notes === 'string' ? notes.trim() : '',
    creatorId: session.user.id,
    members: [session.user.id],
  });

  await User.findByIdAndUpdate(session.user.id, { $push: { tripIds: trip._id } });

  return NextResponse.json(trip, { status: 201 });
}
