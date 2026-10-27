import { Suspense } from 'react';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db/mongoose';
import Task from '@/lib/db/models/Task';
import Trip from '@/lib/db/models/Trip';
import PlanClient from './PlanClient';

async function PlanContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  await connectDB();
  const [trip, milestones] = await Promise.all([
    Trip.findById(id).lean(),
    Task.find({ tripId: id, type: 'milestone' }).lean(),
  ]);

  const serialized = milestones.map((m: any) => ({
    _id: m._id.toString(),
    title: m.title,
    targetDate: m.targetDate ? m.targetDate.toISOString().split('T')[0] : '',
    targetTime: m.targetTime || '',
    order: typeof m.order === 'number' ? m.order : 0,
    isCompleted: Boolean(m.isCompleted),
  }));

  // Date-wise & Intra-day sort: chronological by date, then order/time within the day
  serialized.sort((a: any, b: any) => {
    if (a.targetDate && b.targetDate) {
      const dateCmp = a.targetDate.localeCompare(b.targetDate);
      if (dateCmp !== 0) return dateCmp;
      if (a.order !== b.order) return (a.order || 0) - (b.order || 0);
      if (a.targetTime && b.targetTime) return a.targetTime.localeCompare(b.targetTime);
      if (a.targetTime && !b.targetTime) return -1;
      if (!a.targetTime && b.targetTime) return 1;
      return 0;
    }
    if (a.targetDate && !b.targetDate) return -1;
    if (!a.targetDate && b.targetDate) return 1;
    return (a.order || 0) - (b.order || 0);
  });

  return (
    <PlanClient
      tripId={id}
      initialMilestones={serialized}
      tripName={(trip as any)?.name || 'Trip'}
      destination={(trip as any)?.destinationQuery || ''}
      startDate={(trip as any)?.startDate ? (trip as any).startDate.toISOString().split('T')[0] : ''}
      endDate={(trip as any)?.endDate ? (trip as any).endDate.toISOString().split('T')[0] : ''}
      initialNotes={(trip as any)?.notes || ''}
    />
  );
}

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-6 max-w-2xl mx-auto text-center py-20 text-sm text-gray-500">Loading itinerary…</div>}>
      <PlanContent params={params} />
    </Suspense>
  );
}
