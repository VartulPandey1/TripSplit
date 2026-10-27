import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Task from '@/lib/db/models/Task';
import Trip from '@/lib/db/models/Trip';
import { getTripStatus } from '@/lib/utils/tripStatus';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  await connectDB();
  const task = await Task.findById(id);
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Guard: trip membership
  const trip = await Trip.findById(task.tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const isMember =
    trip.members.some((m: any) => m.toString() === session.user.id) ||
    trip.creatorId?.toString() === session.user.id;

  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tripCompleted = getTripStatus(trip) === 'completed';
  if (task.type !== 'milestone' && tripCompleted) {
    return NextResponse.json(
      { error: 'Trip is completed. Checklist items are archived and locked.' },
      { status: 403 }
    );
  }

  // Guard: Milestone target date validation
  if (task.type === 'milestone' && body.targetDate) {
    const target = new Date(body.targetDate);
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

  // Guard (Rule 4): Only the person who claimed a gear item can mark it as packed/completed
  const effectiveAssignee =
    body.assignedTo !== undefined ? (body.assignedTo ? body.assignedTo.toString() : null) : task.assignedTo?.toString();

  if (body.isCompleted !== undefined && task.type === 'gear') {
    if (!effectiveAssignee) {
      return NextResponse.json(
        { error: 'Claim this gear item first before marking it as packed' },
        { status: 400 }
      );
    }
    if (effectiveAssignee !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the member who claimed this gear item can mark it as packed' },
        { status: 403 }
      );
    }
  }

  // Guard: If an errand is taken/assigned to a member, others cannot complete it
  if (body.isCompleted !== undefined && task.type === 'errand' && effectiveAssignee) {
    if (effectiveAssignee !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the member assigned to this errand can complete it' },
        { status: 403 }
      );
    }
  }

  // Guard: Finalized (completed/packed) items cannot be moved or released
  if (task.isCompleted && (body.type !== undefined || body.assignedTo !== undefined)) {
    return NextResponse.json(
      { error: 'Completed or packed items cannot be moved or reassigned. Uncheck the item first to re-open it.' },
      { status: 400 }
    );
  }

  if (body.type !== undefined && !['milestone', 'errand', 'gear'].includes(body.type)) {
    return NextResponse.json({ error: 'Invalid task type' }, { status: 400 });
  }

  // Guard: Whitespace-only title check
  if (body.title !== undefined) {
    const rawTitle = typeof body.title === 'string' ? body.title.trim() : '';
    if (!rawTitle) {
      return NextResponse.json({ error: 'Task title cannot be empty or only whitespace' }, { status: 400 });
    }
    task.title = rawTitle;
  }

  const allowedFields = ['isCompleted', 'assignedTo', 'targetDate', 'targetTime', 'order', 'type', 'quantity'];
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      if (field === 'targetDate') {
        task.targetDate = body[field] ? new Date(body[field]) : undefined;
      } else if (field === 'assignedTo') {
        task.assignedTo = body[field] ? body[field] : null;
      } else {
        (task as any)[field] = body[field];
      }
    }
  });

  await task.save();
  const populated = await Task.findById(task._id)
    .populate('assignedTo', 'username avatarId')
    .populate('createdBy', 'username avatarId');

  return NextResponse.json(populated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  await connectDB();
  const task = await Task.findById(id);
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  // Guard: trip membership
  const trip = await Trip.findById(task.tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const isMember =
    trip.members.some((m: any) => m.toString() === session.user.id) ||
    trip.creatorId?.toString() === session.user.id;

  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tripCompleted = getTripStatus(trip) === 'completed';
  if (task.type !== 'milestone' && tripCompleted) {
    return NextResponse.json(
      { error: 'Trip is completed. Checklist items are archived and locked.' },
      { status: 403 }
    );
  }

  await task.deleteOne();
  return NextResponse.json({ success: true });
}
