import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Expense from '@/lib/db/models/Expense';
import Trip from '@/lib/db/models/Trip';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get('tripId');
  if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 });

  await connectDB();

  // Guard: User must be a member or creator of the trip
  const trip = await Trip.findById(tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const isMember =
    trip.members.some((m: any) => m.toString() === session.user.id) ||
    trip.creatorId?.toString() === session.user.id;

  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden: you are not a member of this trip' }, { status: 403 });
  }

  const expenses = await Expense.find({ tripId })
    .populate('paidBy', 'username avatarId')
    .sort({ timestamp: -1 });

  return NextResponse.json(expenses);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { tripId, amount, description, category, isPersonal, paidBy, splitType, includedMembers, splitDetails, receiptImage } = body;

  if (!tripId || amount === undefined || !description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
  }

  await connectDB();

  // Guard: User must be a member or creator of the trip
  const trip = await Trip.findById(tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const isMember =
    trip.members.some((m: any) => m.toString() === session.user.id) ||
    trip.creatorId?.toString() === session.user.id;

  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden: you are not a member of this trip' }, { status: 403 });
  }

  const isExpensePersonal = Boolean(isPersonal || splitType === 'personal');
  const effectivePayer = isExpensePersonal ? session.user.id : (paidBy || session.user.id);
  const effectiveIncluded = isExpensePersonal
    ? [session.user.id]
    : (includedMembers && includedMembers.length > 0 ? includedMembers : trip.members);

  const expense = await Expense.create({
    tripId,
    amount: numAmount,
    description: description.trim(),
    category: category || 'Misc',
    isPersonal: isExpensePersonal,
    splitType: isExpensePersonal ? 'personal' : (splitType || 'equal'),
    includedMembers: effectiveIncluded,
    splitDetails: splitDetails || [],
    receiptImage: typeof receiptImage === 'string' ? receiptImage : undefined,
    paidBy: effectivePayer,
    timestamp: new Date(),
    isSynced: true,
  });

  const populated = await Expense.findById(expense._id).populate('paidBy', 'username avatarId');

  return NextResponse.json(populated, { status: 201 });
}
