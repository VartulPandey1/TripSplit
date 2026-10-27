import { Suspense } from 'react';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db/mongoose';
import Task from '@/lib/db/models/Task';
import Trip, { autoUpdateExpiredTrips } from '@/lib/db/models/Trip';
import { getTripStatus } from '@/lib/utils/tripStatus';
import TasksClient from './TasksClient';

async function TasksContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  await connectDB();
  await autoUpdateExpiredTrips(session.user.id);
  const trip = await Trip.findById(id).populate('members', 'username avatarId email').lean();
  if (!trip) redirect('/dashboard');

  const isTripCompleted = getTripStatus(trip) === 'completed';

  const members: any[] = (trip.members as any[]) || [];
  const tasks = await Task.find({ tripId: id, type: { $in: ['errand', 'gear'] } })
    .populate('assignedTo', 'username avatarId')
    .populate('createdBy', 'username avatarId')
    .sort({ _id: -1 })
    .lean();

  const serializedMembers = members.map((m: any) => ({
    _id: m._id.toString(),
    username: m.username,
    avatarId: m.avatarId,
  }));

  const serializedTasks = tasks.map((t: any) => ({
    _id: t._id.toString(),
    type: t.type,
    title: t.title,
    quantity: typeof t.quantity === 'number' && t.quantity >= 1 ? t.quantity : 1,
    assignedTo: t.assignedTo
      ? {
          _id: t.assignedTo._id.toString(),
          username: t.assignedTo.username,
          avatarId: t.assignedTo.avatarId,
        }
      : null,
    createdBy: t.createdBy
      ? {
          _id: t.createdBy._id.toString(),
          username: t.createdBy.username,
          avatarId: t.createdBy.avatarId,
        }
      : null,
    isCompleted: Boolean(t.isCompleted),
  }));

  return (
    <TasksClient
      tripId={id}
      currentUserId={session.user.id}
      members={serializedMembers}
      initialTasks={serializedTasks}
      isTripCompleted={isTripCompleted}
    />
  );
}

export default function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-6 max-w-2xl mx-auto text-center py-20">Loading tasks…</div>}>
      <TasksContent params={params} />
    </Suspense>
  );
}
