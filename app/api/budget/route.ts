import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Budget, { recalculateBudget } from '@/lib/db/models/Budget';
import Trip from '@/lib/db/models/Trip';

// GET /api/budget?tripId=...
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get('tripId');
  if (!tripId) {
    return NextResponse.json({ error: 'tripId is required' }, { status: 400 });
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

  // Find or create initial budget document for this trip
  let budget = await Budget.findOne({ tripId })
    .populate('items.guesses.userId', 'username avatarId')
    .populate('acknowledgments', 'username avatarId');

  if (!budget) {
    budget = await Budget.create({
      tripId,
      items: [],
      totalEstimated: 0,
      acknowledgments: [],
    });
  }

  return NextResponse.json(budget);
}

// POST /api/budget -> Add a new budget item to estimate
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { tripId, title, category, initialGuess, notes } = body;

  const resolvedCategory = category || 'Activities';
  const resolvedTitle = title?.trim() || resolvedCategory;

  if (!tripId) {
    return NextResponse.json({ error: 'tripId is required' }, { status: 400 });
  }

  if (initialGuess == null || isNaN(Number(initialGuess)) || Number(initialGuess) <= 0) {
    return NextResponse.json(
      { error: 'A valid estimated price/amount greater than 0 is required' },
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

  let budget = await Budget.findOne({ tripId });
  if (!budget) {
    budget = new Budget({ tripId, items: [], totalEstimated: 0, acknowledgments: [] });
  }

  const guesses: any[] = [];
  if (initialGuess != null && !isNaN(Number(initialGuess)) && Number(initialGuess) > 0) {
    guesses.push({
      userId: session.user.id,
      amount: Number(initialGuess),
      notes: notes || '',
      updatedAt: new Date(),
    });
  }

  const newItem: any = {
    title: resolvedTitle,
    category: resolvedCategory,
    addedBy: session.user.id,
    guesses,
    consensusCost: guesses.length > 0 ? Number(initialGuess) : 0,
    agreedCost: null,
    isLocked: false,
    createdAt: new Date(),
  };

  budget.items.push(newItem);

  // Recalculate totals and auto-approve the user who added this item
  recalculateBudget(budget);
  budget.acknowledgments = [session.user.id as any];

  await budget.save();

  // Re-populate and return
  const populated = await Budget.findById(budget._id)
    .populate('items.guesses.userId', 'username avatarId')
    .populate('acknowledgments', 'username avatarId');

  return NextResponse.json(populated, { status: 201 });
}

// PATCH /api/budget -> Update an existing budget item
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { tripId, itemId, title, category, amount, notes } = body;

  if (!tripId || !itemId) {
    return NextResponse.json({ error: 'tripId and itemId are required' }, { status: 400 });
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

  const item = budget.items.find((i: any) => i._id.toString() === itemId);
  if (!item) {
    return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });
  }

  if (category !== undefined) item.category = category;
  if (title !== undefined) item.title = title.trim() || item.category;

  if (amount !== undefined && !isNaN(Number(amount)) && Number(amount) >= 0) {
    item.consensusCost = Number(amount);
    item.agreedCost = Number(amount);
    if (!item.guesses || item.guesses.length === 0) {
      item.guesses = [
        {
          userId: session.user.id as any,
          amount: Number(amount),
          notes: notes || '',
          updatedAt: new Date(),
        },
      ];
    } else {
      item.guesses[0].amount = Number(amount);
      if (notes !== undefined) item.guesses[0].notes = notes;
      item.guesses[0].updatedAt = new Date();
    }
  }

  recalculateBudget(budget);
  await budget.save();

  const populated = await Budget.findById(budget._id)
    .populate('items.guesses.userId', 'username avatarId')
    .populate('acknowledgments', 'username avatarId');

  return NextResponse.json(populated);
}

// DELETE /api/budget?tripId=...&itemId=... -> Delete an item
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get('tripId');
  const itemId = searchParams.get('itemId');

  if (!tripId || !itemId) {
    return NextResponse.json({ error: 'tripId and itemId are required' }, { status: 400 });
  }

  await connectDB();

  const budget = await Budget.findOne({ tripId });
  if (!budget) {
    return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  }

  budget.items = budget.items.filter((item: any) => item._id.toString() !== itemId);
  recalculateBudget(budget);
  budget.acknowledgments = [session.user.id as any];

  await budget.save();

  const populated = await Budget.findById(budget._id)
    .populate('items.guesses.userId', 'username avatarId')
    .populate('acknowledgments', 'username avatarId');

  return NextResponse.json(populated);
}
