import { Suspense } from 'react';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db/mongoose';
import Trip from '@/lib/db/models/Trip';
import Expense from '@/lib/db/models/Expense';
import Budget from '@/lib/db/models/Budget';
import '@/lib/db/models/User';
import MoneyClient from './MoneyClient';
import MoneySkeleton from './MoneySkeleton';

async function MoneyContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string; tab?: string; mode?: string }>;
}) {
  await connection();
  const { id } = await params;
  const sParams = searchParams ? await searchParams : {};
  const rawView =
    sParams?.view ||
    (sParams?.tab === 'settle'
      ? 'settle'
      : sParams?.tab === 'expenses'
      ? 'transactions'
      : undefined);
  const initialView =
    rawView === 'settle' || rawView === 'transactions' || rawView === 'private'
      ? (rawView as 'settle' | 'transactions' | 'private')
      : 'hub';
  const initialMode = sParams?.mode === 'group' ? 'group' : 'mine';

  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  await connectDB();

  // Guard: User must be a member or creator of the trip
  const trip = await Trip.findById(id).populate('members', 'username avatarId email').lean();
  if (!trip) redirect('/dashboard');

  const members: any[] = (trip.members as any[]) || [];
  const isMember =
    members.some((m: any) => m._id.toString() === session.user.id) ||
    trip.creatorId?.toString() === session.user.id;

  if (!isMember) redirect('/dashboard');

  const expenses = await Expense.find({
    tripId: id,
    $or: [
      { isPersonal: false },
      { isPersonal: { $exists: false } },
      { paidBy: session.user.id },
    ],
  })
    .populate('paidBy', 'username avatarId')
    .sort({ timestamp: -1 })
    .lean();

  const serializedMembers = members.map((m: any) => ({
    _id: m._id.toString(),
    username: m.username,
    avatarId: m.avatarId,
    email: m.email,
  }));

  const serializedExpenses = expenses.map((e: any) => ({
    _id: e._id.toString(),
    amount: e.amount,
    description: e.description,
    category: e.category || 'Misc',
    isPersonal: Boolean(e.isPersonal || e.splitType === 'personal'),
    splitType: e.splitType || 'equal',
    splitDetails: (e.splitDetails || []).map((sd: any) => ({
      userId: sd.userId?._id ? sd.userId._id.toString() : sd.userId?.toString() || '',
      amountOwed: sd.amountOwed || 0,
    })),
    receiptImage: e.receiptImage || undefined,
    paidBy: {
      _id: e.paidBy?._id ? e.paidBy._id.toString() : e.paidBy?.toString(),
      username: e.paidBy?.username || 'Member',
      avatarId: e.paidBy?.avatarId || 'avatar-fox.svg',
    },
    includedMembers: (e.includedMembers || []).map((m: any) => m.toString()),
    timestamp: e.timestamp ? e.timestamp.toISOString() : new Date().toISOString(),
  }));

  // Fetch or initialize trip budget with guesses
  const budget = await Budget.findOne({ tripId: id })
    .populate('items.guesses.userId', 'username avatarId')
    .populate('acknowledgments', 'username avatarId')
    .lean();

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

  // User's multi-device persisted personal budget from MongoDB
  const userBudgetEntry = (budget as any)?.memberBudgets?.find(
    (mb: any) => (mb.userId?._id?.toString() || mb.userId?.toString()) === session.user.id
  );
  const initialPersonalBudget = typeof userBudgetEntry?.amount === 'number' ? userBudgetEntry.amount : null;
  const isCreator = trip.creatorId?.toString() === session.user.id;

  return (
    <MoneyClient
      tripId={id}
      currentUserId={session.user.id}
      isCreator={isCreator}
      members={serializedMembers}
      initialExpenses={serializedExpenses}
      initialCurrency={trip.currency || 'INR'}
      initialPersonalBudget={initialPersonalBudget}
      initialView={initialView}
      initialMode={initialMode}
    />
  );
}

export default function MoneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string; tab?: string; mode?: string }>;
}) {
  return (
    <Suspense fallback={<MoneySkeleton />}>
      <MoneyContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
