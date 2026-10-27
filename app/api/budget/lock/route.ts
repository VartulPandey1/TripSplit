import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Budget, { recalculateBudget } from '@/lib/db/models/Budget';
import Trip from '@/lib/db/models/Trip';

// POST /api/budget/lock -> Lock in agreed cost or unlock to consensus
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tripId, itemId, isLocked, agreedCost } = await req.json();

  if (!tripId || !itemId) {
    return NextResponse.json({ error: 'tripId and itemId are required' }, { status: 400 });
  }

  await connectDB();

  const trip = await Trip.findById(tripId).lean();
  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  const creatorId = (trip.creatorId as any)?._id?.toString() || trip.creatorId?.toString();
  const isCreator = creatorId === session.user.id;

  if (!isCreator) {
    return NextResponse.json(
      { error: 'Forbidden: only the trip creator can lock or unlock agreed budget costs' },
      { status: 403 }
    );
  }

  const budget = await Budget.findOne({ tripId });
  if (!budget) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }

  const item = budget.items.find((i: any) => i._id.toString() === itemId);
  if (!item) {
    return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });
  }

  item.isLocked = Boolean(isLocked);
  if (isLocked) {
    item.agreedCost =
      agreedCost != null && !isNaN(Number(agreedCost))
        ? Number(agreedCost)
        : item.consensusCost;
  } else {
    item.agreedCost = null;
  }

  recalculateBudget(budget);
  budget.acknowledgments = [session.user.id as any];

  await budget.save();

  const populated = await Budget.findById(budget._id)
    .populate('items.guesses.userId', 'username avatarId')
    .populate('acknowledgments', 'username avatarId');

  return NextResponse.json(populated);
}
