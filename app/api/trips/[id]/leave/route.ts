import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Trip from '@/lib/db/models/Trip';
import User from '@/lib/db/models/User';
import Expense from '@/lib/db/models/Expense';
import Budget from '@/lib/db/models/Budget';
import Task from '@/lib/db/models/Task';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const trip = await Trip.findById(id);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const userId = session.user.id;
  const isMember = trip.members.some((m: any) => m.toString() === userId);
  if (!isMember) {
    return NextResponse.json({ error: 'You are not a member of this trip' }, { status: 403 });
  }

  const creatorId = (trip.creatorId as any)?._id?.toString() || trip.creatorId?.toString();
  const isCreator = creatorId === userId;

  // Prevent creator from leaving if other travelers are still in the trip
  if (isCreator && trip.members.length > 1) {
    return NextResponse.json(
      { error: 'Trip creators cannot leave while other travelers are in the trip. You can delete the trip instead.' },
      { status: 400 }
    );
  }

  // Guarded financial check: members with non-zero balances cannot leave
  const expenses = await Expense.find({ tripId: id });
  let paid = 0;
  let owed = 0;

  for (const exp of expenses) {
    const payerId = (exp.paidBy as any)?._id?.toString() || exp.paidBy?.toString();
    const isPayer = payerId === userId;
    const included = exp.includedMembers && exp.includedMembers.length > 0 ? exp.includedMembers : trip.members;
    const isIncluded = included.some((m: any) => (m?._id?.toString() || m?.toString()) === userId);

    if (exp.category === 'Settlement') {
      if (isPayer) paid += exp.amount || 0;
      if (isIncluded) owed += exp.amount || 0;
      continue;
    }

    if (isPayer) {
      paid += exp.amount || 0;
    }

    if (isIncluded) {
      if (exp.splitType === 'exact' && Array.isArray(exp.splitDetails) && exp.splitDetails.length > 0) {
        const detail = exp.splitDetails.find((d: any) => (d.userId?._id?.toString() || d.userId?.toString()) === userId);
        owed += detail ? Number(detail.amountOwed || 0) : 0;
      } else if (exp.splitType === 'percentage' && Array.isArray(exp.splitDetails) && exp.splitDetails.length > 0) {
        const detail = exp.splitDetails.find((d: any) => (d.userId?._id?.toString() || d.userId?.toString()) === userId);
        owed += detail ? ((exp.amount || 0) * Number(detail.amountOwed || 0)) / 100 : 0;
      } else {
        owed += (exp.amount || 0) / Math.max(1, included.length);
      }
    }
  }

  const netBalance = Math.round((paid - owed) * 100) / 100;
  const currency = trip.currency || 'INR';

  if (Math.abs(netBalance) >= 0.01) {
    if (netBalance > 0) {
      return NextResponse.json(
        {
          error: `You cannot leave this trip yet because you are still owed ${currency} ${netBalance.toFixed(2)}. Please settle all balances with travelers before leaving.`,
          netBalance,
        },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        {
          error: `You cannot leave this trip yet because you still owe ${currency} ${Math.abs(netBalance).toFixed(2)}. Please settle your outstanding debts before leaving.`,
          netBalance,
        },
        { status: 400 }
      );
    }
  }

  // Net balance is 0: Proceed with departure
  if (trip.members.length === 1) {
    // Sole member leaving -> delete trip and cleanup
    await Expense.deleteMany({ tripId: id });
    await Budget.deleteMany({ tripId: id });
    await Task.deleteMany({ tripId: id });
    await User.findByIdAndUpdate(userId, { $pull: { tripIds: trip._id } });
    await Trip.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: 'You have left and closed the trip.' });
  }

  await Trip.findByIdAndUpdate(id, { $pull: { members: userId } });
  await User.findByIdAndUpdate(userId, { $pull: { tripIds: trip._id } });

  return NextResponse.json({ success: true, message: 'You have left the trip successfully.' });
}
