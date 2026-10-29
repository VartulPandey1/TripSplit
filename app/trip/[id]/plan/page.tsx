import { Suspense } from 'react';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db/mongoose';
import Task from '@/lib/db/models/Task';
import Trip from '@/lib/db/models/Trip';
import Expense from '@/lib/db/models/Expense';
import Budget from '@/lib/db/models/Budget';
import PlanClient from './PlanClient';
import PlanSkeleton from './PlanSkeleton';

export const instant = false;

async function PlanContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  await connectDB();
  const [trip, milestones, budget, expenses] = await Promise.all([
    Trip.findById(id).populate('members', 'username avatarId email').lean(),
    Task.find({ tripId: id, type: 'milestone' }).lean(),
    Budget.findOne({ tripId: id })
      .populate('items.guesses.userId', 'username avatarId')
      .populate('acknowledgments', 'username avatarId')
      .lean(),
    Expense.find({ tripId: id }).lean(),
  ]);

  if (!trip) redirect('/dashboard');

  const members: any[] = (trip as any).members || [];
  const isMember =
    members.some((m: any) => (m?._id ? m._id.toString() : m?.toString()) === session.user.id) ||
    ((trip as any).creatorId?._id ? (trip as any).creatorId._id.toString() : (trip as any).creatorId?.toString()) === session.user.id;

  if (!isMember) redirect('/dashboard');

  const creatorId = (trip as any).creatorId?._id
    ? (trip as any).creatorId._id.toString()
    : (trip as any).creatorId?.toString() || '';
  const isCreator = creatorId === session.user.id;

  const serializedMembers = members.map((m: any) => ({
    _id: m._id ? m._id.toString() : m.toString(),
    username: m.username || 'Member',
    avatarId: m.avatarId || 'avatar-fox.svg',
    email: m.email || '',
  }));

  // Calculate actual group shared spend (excluding settlements and personal spends)
  const sharedExpenses = (expenses || []).filter(
    (e: any) => !e.isPersonal && e.splitType !== 'personal' && e.category !== 'Settlement'
  );
  const totalActualSpend = sharedExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

  let serializedBudget = null;
  if (budget) {
    serializedBudget = {
      _id: (budget as any)._id.toString(),
      tripId: (budget as any).tripId.toString(),
      totalEstimated: (budget as any).totalEstimated || 0,
      acknowledgments: ((budget as any).acknowledgments || []).map((u: any) =>
        u?._id ? u._id.toString() : u?.toString()
      ),
      items: ((budget as any).items || []).map((item: any) => ({
        _id: item._id.toString(),
        title: item.title,
        category: item.category || 'Activities',
        addedBy: item.addedBy ? item.addedBy.toString() : '',
        consensusCost: item.consensusCost || 0,
        agreedCost: item.agreedCost != null ? item.agreedCost : null,
        isLocked: Boolean(item.isLocked),
        guesses: (item.guesses || []).map((g: any) => ({
          userId: {
            _id: g.userId?._id ? g.userId._id.toString() : g.userId?.toString() || '',
            username: g.userId?.username || 'Member',
            avatarId: g.userId?.avatarId || 'avatar-fox.svg',
          },
          amount: g.amount || 0,
          notes: g.notes || '',
          updatedAt: g.updatedAt ? new Date(g.updatedAt).toISOString() : '',
        })),
      })),
    };
  }

  const serialized = milestones.map((m: any) => ({
    _id: m._id.toString(),
    title: m.title,
    targetDate: m.targetDate ? m.targetDate.toISOString().split('T')[0] : '',
    targetTime: m.targetTime || '',
    order: typeof m.order === 'number' ? m.order : 0,
    isCompleted: Boolean(m.isCompleted),
  }));

  // Date-wise & Intra-day sort: chronological by date, then time, then order within the day
  serialized.sort((a: any, b: any) => {
    if (a.targetDate && b.targetDate) {
      const dateCmp = a.targetDate.localeCompare(b.targetDate);
      if (dateCmp !== 0) return dateCmp;
      if (a.targetTime && b.targetTime) {
        const timeCmp = a.targetTime.localeCompare(b.targetTime);
        if (timeCmp !== 0) return timeCmp;
      }
      if (a.targetTime && !b.targetTime) return -1;
      if (!a.targetTime && b.targetTime) return 1;
      return (a.order || 0) - (b.order || 0);
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
      currentUserId={session.user.id}
      isCreator={isCreator}
      members={serializedMembers}
      initialBudget={serializedBudget}
      currency={(trip as any)?.currency || 'INR'}
      totalActualSpend={totalActualSpend}
    />
  );
}

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <Suspense fallback={<PlanSkeleton />}>
      <PlanContent params={params} />
    </Suspense>
  );
}
