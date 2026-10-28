import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Expense from '@/lib/db/models/Expense';
import Trip from '@/lib/db/models/Trip';
import '@/lib/db/models/User';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { description, amount, category, isPersonal, paidBy, includedMembers, splitType, splitDetails } = body;

  await connectDB();
  const expense = await Expense.findById(id);
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

  const trip = await Trip.findById(expense.tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const isPayer = expense.paidBy.toString() === session.user.id;
  const isCreator = (trip.creatorId as any)?._id?.toString() === session.user.id || trip.creatorId?.toString() === session.user.id;
  const isMember = trip.members.some((m: any) => (m._id?.toString() || m.toString()) === session.user.id);

  if (!isMember && !isCreator) {
    return NextResponse.json({ error: 'Forbidden: you are not a member of this trip' }, { status: 403 });
  }

  if (!isPayer && !isCreator) {
    return NextResponse.json({ error: 'Forbidden: only the payer or trip creator can edit this expense' }, { status: 403 });
  }

  // Guard: Settlements cannot be edited as standard expenses
  if (expense.category === 'Settlement') {
    return NextResponse.json(
      { error: 'Debt settlements cannot be edited. Delete and record a new settlement if needed.' },
      { status: 400 }
    );
  }

  if (description !== undefined) {
    if (!description.trim()) {
      return NextResponse.json({ error: 'Description cannot be empty' }, { status: 400 });
    }
    expense.description = description.trim();
  }

  if (amount !== undefined) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }
    expense.amount = numAmount;
  }

  if (category !== undefined) {
    expense.category = category;
  }

  if (isPersonal !== undefined) {
    expense.isPersonal = isPersonal;
  }

  if (paidBy !== undefined) {
    expense.paidBy = paidBy;
  }

  if (includedMembers !== undefined) {
    if (!Array.isArray(includedMembers) || includedMembers.length === 0) {
      return NextResponse.json({ error: 'At least one participant must be included' }, { status: 400 });
    }
    expense.includedMembers = includedMembers;
  }

  if (splitType !== undefined) {
    expense.splitType = splitType;
  }

  if (splitDetails !== undefined) {
    expense.splitDetails = splitDetails;
  }

  if (body.receiptImage !== undefined) {
    expense.receiptImage = body.receiptImage || undefined;
  }

  await expense.save();
  const populated = await Expense.findById(expense._id).populate('paidBy', 'username avatarId');

  return NextResponse.json(populated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const expense = await Expense.findById(id);
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

  const trip = await Trip.findById(expense.tripId);
  const isPayer = expense.paidBy.toString() === session.user.id;
  const isCreator = trip?.creatorId?.toString() === session.user.id;

  if (!isPayer && !isCreator) {
    return NextResponse.json({ error: 'Forbidden: only the payer or trip creator can remove this expense' }, { status: 403 });
  }

  await expense.deleteOne();
  return NextResponse.json({ success: true, message: 'Expense removed successfully' });
}
