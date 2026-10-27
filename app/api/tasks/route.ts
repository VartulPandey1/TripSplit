import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Task from '@/lib/db/models/Task';
import Trip from '@/lib/db/models/Trip';
import { getTripStatus } from '@/lib/utils/tripStatus';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get('tripId');
  const type = searchParams.get('type');

  if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 });

  await connectDB();

  // Guard: trip membership
  const trip = await Trip.findById(tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const isMember =
    trip.members.some((m: any) => m.toString() === session.user.id) ||
    trip.creatorId?.toString() === session.user.id;

  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const query: any = { tripId };
  if (type) query.type = type;

  const tasks = await Task.find(query)
    .populate('assignedTo', 'username avatarId')
    .populate('createdBy', 'username avatarId')
    .sort({ targetDate: 1, _id: -1 });

  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { tripId, type, title, quantity, assignedTo, targetDate } = body;

  const rawTitle = typeof title === 'string' ? title.trim() : '';

  if (!tripId || !type || !rawTitle) {
    return NextResponse.json({ error: 'tripId, type, and non-empty title are required' }, { status: 400 });
  }

  if (!['milestone', 'errand', 'gear'].includes(type)) {
    return NextResponse.json({ error: 'Invalid task type' }, { status: 400 });
  }

  await connectDB();

  // Guard: trip membership
  const trip = await Trip.findById(tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const isMember =
    trip.members.some((m: any) => m.toString() === session.user.id) ||
    trip.creatorId?.toString() === session.user.id;

  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tripCompleted = getTripStatus(trip) === 'completed';

  // Guard: If trip is completed, lock checklists (errand & gear)
  if ((type === 'errand' || type === 'gear') && tripCompleted) {
    return NextResponse.json(
      { error: 'Trip is completed. Checklist is locked in archive mode.' },
      { status: 403 }
    );
  }

  // Guard: Milestone target date must fall within trip date boundaries
  if (type === 'milestone' && targetDate) {
    const target = new Date(targetDate);
    if (isNaN(target.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduled date' }, { status: 400 });
    }
    if (trip.startDate) {
      const s = new Date(trip.startDate);
      s.setHours(0, 0, 0, 0);
      const t = new Date(target);
      t.setHours(0, 0, 0, 0);
      if (t < s) {
        return NextResponse.json(
          { error: `Scheduled date cannot be earlier than trip start date (${s.toISOString().split('T')[0]})` },
          { status: 400 }
        );
      }
    }
    if (trip.endDate) {
      const e = new Date(trip.endDate);
      e.setHours(23, 59, 59, 999);
      if (target > e) {
        return NextResponse.json(
          { error: `Scheduled date cannot be later than trip end date (${e.toISOString().split('T')[0]})` },
          { status: 400 }
        );
      }
    }
  }

  const task = await Task.create({
    tripId,
    type,
    title: title.trim(),
    quantity: typeof quantity === 'number' && quantity >= 1 ? Math.floor(quantity) : 1,
    assignedTo: assignedTo || null,
    createdBy: session.user.id,
    targetDate: targetDate ? new Date(targetDate) : undefined,
    targetTime: typeof body.targetTime === 'string' ? body.targetTime.trim() : undefined,
    order: typeof body.order === 'number' ? body.order : 0,
    isCompleted: false,
  });

  const populated = await Task.findById(task._id)
    .populate('assignedTo', 'username avatarId')
    .populate('createdBy', 'username avatarId');

  return NextResponse.json(populated, { status: 201 });
}
