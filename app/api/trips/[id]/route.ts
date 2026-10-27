import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Trip, { isTripCompleted } from '@/lib/db/models/Trip';
import User from '@/lib/db/models/User';
import Expense from '@/lib/db/models/Expense';
import Budget from '@/lib/db/models/Budget';
import Task from '@/lib/db/models/Task';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const trip = await Trip.findById(id).populate('members', 'username email avatarId');
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const isMember = trip.members.some(
    (m: any) => m._id?.toString() === session.user.id || m.toString() === session.user.id
  );
  const isCreator = trip.creatorId?.toString() === session.user.id;

  if (!isMember && !isCreator) {
    return NextResponse.json({ error: 'Forbidden: you are not a member of this trip' }, { status: 403 });
  }

  // Auto-complete if end date has passed
  if (trip.status === 'active' && isTripCompleted(trip)) {
    trip.status = 'completed';
    await trip.save();
  }

  return NextResponse.json(trip);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  await connectDB();
  const trip = await Trip.findById(id);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const isMember = trip.members.some(
    (m: any) => (m._id?.toString() || m.toString()) === session.user.id
  );
  const creatorId = (trip.creatorId as any)?._id?.toString() || trip.creatorId?.toString();
  const isCreator = creatorId === session.user.id;
  if (!isMember && !isCreator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Guard: Restrict critical trip settings & member management to trip creator
  const isEditingSettings =
    body.name !== undefined ||
    body.destinationQuery !== undefined ||
    body.startDate !== undefined ||
    body.endDate !== undefined ||
    body.currency !== undefined ||
    body.status !== undefined ||
    body.removeMemberId !== undefined;

  if (isEditingSettings && !isCreator) {
    return NextResponse.json(
      { error: 'Forbidden: only the trip creator can modify trip settings or manage members' },
      { status: 403 }
    );
  }

  // Handle member removal by creator
  if (body.removeMemberId && isCreator) {
    const memberToRemove = body.removeMemberId.toString();
    if (memberToRemove === session.user.id) {
      return NextResponse.json({ error: 'Trip creator cannot be removed from the trip' }, { status: 400 });
    }
    trip.members = trip.members.filter(
      (m: any) => (m._id?.toString() || m.toString()) !== memberToRemove
    );
    await User.findByIdAndUpdate(memberToRemove, { $pull: { tripIds: trip._id } });
  }

  // 1. Validate & update trip name (prevent whitespace-only)
  if (body.name !== undefined) {
    const trimmedName = typeof body.name === 'string' ? body.name.trim() : '';
    if (!trimmedName) {
      return NextResponse.json({ error: 'Trip name cannot be blank' }, { status: 400 });
    }
    trip.name = trimmedName;
  }

  // 2. Validate & update destination query
  if (body.destinationQuery !== undefined) {
    const trimmedDest = typeof body.destinationQuery === 'string' ? body.destinationQuery.trim() : '';
    if (!trimmedDest) {
      return NextResponse.json({ error: 'Destination cannot be blank' }, { status: 400 });
    }
    trip.destinationQuery = trimmedDest;
  }

  // 3. Validate & update trip dates (startDate and endDate)
  if (body.startDate !== undefined || body.endDate !== undefined) {
    const newStart = body.startDate !== undefined ? new Date(body.startDate) : new Date(trip.startDate);
    const newEnd = body.endDate !== undefined ? new Date(body.endDate) : new Date(trip.endDate);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid start or end date' }, { status: 400 });
    }

    if (newStart > newEnd) {
      return NextResponse.json({ error: 'End date cannot be earlier than start date' }, { status: 400 });
    }

    if (body.startDate !== undefined) {
      trip.startDate = newStart;
    }
    if (body.endDate !== undefined) {
      newEnd.setUTCHours(23, 59, 59, 999);
      trip.endDate = newEnd;
    }
  }

  // 4. Update currency & revalue existing expenses if requested
  if (body.currency) {
    const oldCurrency = trip.currency;
    const newCurrency = body.currency;
    trip.currency = newCurrency;

    if (body.convertExisting && typeof body.exchangeRate === 'number' && body.exchangeRate > 0 && oldCurrency !== newCurrency) {
      const rate = body.exchangeRate;

      // Revalue all recorded expenses for this trip
      const tripExpenses = await Expense.find({ tripId: id });
      for (const exp of tripExpenses) {
        exp.amount = Math.round(exp.amount * rate * 100) / 100;
        await exp.save();
      }

      // Revalue budget items and guesses
      const tripBudget = await Budget.findOne({ tripId: id });
      if (tripBudget) {
        if (tripBudget.items && tripBudget.items.length > 0) {
          tripBudget.items.forEach((item: any) => {
            if (item.consensusCost != null) {
              item.consensusCost = Math.round(item.consensusCost * rate * 100) / 100;
            }
            if (item.agreedCost != null) {
              item.agreedCost = Math.round(item.agreedCost * rate * 100) / 100;
            }
            if (item.guesses && item.guesses.length > 0) {
              item.guesses.forEach((g: any) => {
                if (g.amount != null) {
                  g.amount = Math.round(g.amount * rate * 100) / 100;
                }
              });
            }
          });
        }
        if (tripBudget.totalEstimated != null) {
          tripBudget.totalEstimated = Math.round(tripBudget.totalEstimated * rate * 100) / 100;
        }
        await tripBudget.save();
      }
    }
  }

  // 5. Update status
  if (body.status && ['active', 'completed', 'reopened'].includes(body.status)) {
    trip.status = body.status;
  }

  // 6. Update notes
  if (typeof body.notes === 'string') {
    trip.notes = body.notes;
  }

  // Auto-complete if end date has passed and status was not manually set or reopened
  if (trip.status !== 'reopened' && trip.status === 'active' && isTripCompleted(trip)) {
    trip.status = 'completed';
  }

  await trip.save();
  return NextResponse.json(trip);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const trip = await Trip.findById(id);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const creatorId = (trip.creatorId as any)?._id?.toString() || trip.creatorId?.toString();
  if (creatorId !== session.user.id) {
    return NextResponse.json({ error: 'Only the trip creator can delete this trip' }, { status: 403 });
  }

  // Cascading cleanup across all collections
  await Promise.all([
    Expense.deleteMany({ tripId: id }),
    Budget.deleteMany({ tripId: id }),
    Task.deleteMany({ tripId: id }),
    User.updateMany({ _id: { $in: trip.members } }, { $pull: { tripIds: trip._id } }),
    Trip.findByIdAndDelete(id),
  ]);

  return NextResponse.json({ success: true, message: 'Trip and all associated data deleted successfully' });
}
