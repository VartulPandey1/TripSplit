import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Trip from '@/lib/db/models/Trip';
import User from '@/lib/db/models/User';
import { checkRateLimitDurable } from '@/lib/utils/rateLimit';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Brute-force protection: rate limit room code guesses per user / IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  const rateLimitKey = `join:${session.user.id}:${ip}`;
  const rateCheck = await checkRateLimitDurable(rateLimitKey, 10, 5 * 60 * 1000);

  if (!rateCheck.success) {
    return NextResponse.json(
      { error: `Too many attempts to join trips. Please wait ${rateCheck.resetSeconds}s before trying again.` },
      {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.resetSeconds) },
      }
    );
  }

  const { roomCode } = await req.json();
  if (!roomCode) return NextResponse.json({ error: 'Room code required' }, { status: 400 });

  await connectDB();
  const trip = await Trip.findOne({ roomCode: roomCode.toUpperCase() });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const alreadyMember = trip.members.some((m: any) => m.toString() === session.user.id);
  if (!alreadyMember) {
    trip.members.push(new mongoose.Types.ObjectId(session.user.id));
    await trip.save();
    await User.findByIdAndUpdate(session.user.id, { $push: { tripIds: trip._id } });
  }

  return NextResponse.json(trip);
}
