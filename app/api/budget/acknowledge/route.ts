import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Budget from '@/lib/db/models/Budget';
import Trip from '@/lib/db/models/Trip';

// POST /api/budget/acknowledge -> Toggle approval/acknowledgment of the budget baseline
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tripId } = await req.json();

  if (!tripId) {
    return NextResponse.json({ error: 'tripId is required' }, { status: 400 });
  }

  await connectDB();

  const trip = await Trip.findById(tripId).lean();
  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  const isMember =
    trip.members?.some((m: any) => m.toString() === session.user.id) ||
    trip.creatorId?.toString() === session.user.id;

  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const budget = await Budget.findOne({ tripId });
  if (!budget) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }

  const currentUserIdStr = session.user.id;
  const alreadyAcked = budget.acknowledgments.some(
    (uid: any) => uid.toString() === currentUserIdStr
  );

  if (alreadyAcked) {
    budget.acknowledgments = budget.acknowledgments.filter(
      (uid: any) => uid.toString() !== currentUserIdStr
    );
  } else {
    budget.acknowledgments.push(currentUserIdStr as any);
  }

  await budget.save();

  const populated = await Budget.findById(budget._id)
    .populate('items.guesses.userId', 'username avatarId')
    .populate('acknowledgments', 'username avatarId');

  return NextResponse.json(populated);
}
