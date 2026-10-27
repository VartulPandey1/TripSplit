import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Budget from '@/lib/db/models/Budget';
import Trip from '@/lib/db/models/Trip';

// GET /api/budget/personal?tripId=...
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

  const budget = await Budget.findOne({ tripId }).lean();
  const userBudget = (budget as any)?.memberBudgets?.find(
    (mb: any) => (mb.userId?._id?.toString() || mb.userId?.toString()) === session.user.id
  );

  return NextResponse.json({ amount: userBudget?.amount ?? 0 });
}

// POST /api/budget/personal -> Save personal budget to MongoDB for multi-device continuity
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { tripId, amount } = body;

  if (!tripId) {
    return NextResponse.json({ error: 'tripId is required' }, { status: 400 });
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 0) {
    return NextResponse.json({ error: 'Valid amount >= 0 is required' }, { status: 400 });
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

  let budget = await Budget.findOne({ tripId });
  if (!budget) {
    budget = new Budget({
      tripId,
      items: [],
      totalEstimated: 0,
      acknowledgments: [],
      memberBudgets: [],
    });
  }

  if (!budget.memberBudgets) {
    budget.memberBudgets = [];
  }

  const existingIdx = budget.memberBudgets.findIndex(
    (mb: any) => (mb.userId?._id?.toString() || mb.userId?.toString()) === session.user.id
  );

  if (existingIdx >= 0) {
    budget.memberBudgets[existingIdx].amount = numAmount;
    budget.memberBudgets[existingIdx].updatedAt = new Date();
  } else {
    budget.memberBudgets.push({
      userId: session.user.id as any,
      amount: numAmount,
      updatedAt: new Date(),
    });
  }

  await budget.save();

  return NextResponse.json({ success: true, amount: numAmount });
}
