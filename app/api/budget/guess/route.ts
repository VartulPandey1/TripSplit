import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Budget, { recalculateBudget } from '@/lib/db/models/Budget';
import Trip from '@/lib/db/models/Trip';

// POST /api/budget/guess -> Submit or edit a price guess for an item
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tripId, itemId, amount, notes } = await req.json();

  if (!tripId || !itemId || amount == null || isNaN(Number(amount)) || Number(amount) < 0) {
    return NextResponse.json(
      { error: 'tripId, itemId, and a valid positive amount are required' },
      { status: 400 }
    );
  }

  await connectDB();

  // Validate trip membership
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

  const item = budget.items.find((i: any) => i._id.toString() === itemId);
  if (!item) {
    return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });
  }

  // Guard: Cannot submit guesses on locked budget items
  if (item.isLocked) {
    return NextResponse.json(
      { error: 'This budget item has been locked to an agreed price. Additional guesses cannot be submitted.' },
      { status: 400 }
    );
  }

  // Update existing guess or append new guess
  const existingGuessIndex = item.guesses.findIndex(
    (g: any) => g.userId?.toString() === session.user.id
  );

  const numAmount = Number(amount);

  if (existingGuessIndex >= 0) {
    item.guesses[existingGuessIndex].amount = numAmount;
    if (notes !== undefined) item.guesses[existingGuessIndex].notes = notes;
    item.guesses[existingGuessIndex].updatedAt = new Date();
  } else {
    item.guesses.push({
      userId: session.user.id as any,
      amount: numAmount,
      notes: notes || '',
      updatedAt: new Date(),
    });
  }

  // Recalculate item consensus and budget total
  recalculateBudget(budget);
  // Auto-approve the user submitting the guess
  budget.acknowledgments = [session.user.id as any];

  await budget.save();

  const populated = await Budget.findById(budget._id)
    .populate('items.guesses.userId', 'username avatarId')
    .populate('acknowledgments', 'username avatarId');

  return NextResponse.json(populated);
}
