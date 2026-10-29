import { Suspense } from 'react';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db/mongoose';
import Trip from '@/lib/db/models/Trip';
import Expense from '@/lib/db/models/Expense';
import Task from '@/lib/db/models/Task';
import Budget from '@/lib/db/models/Budget';
import { getAvatarEmoji } from '@/lib/constants/avatars';
import { formatMoney } from '@/lib/utils/currency';
import Link from 'next/link';
import TripHeaderCard from './TripHeaderCard';
import OverviewTasksCard from './OverviewTasksCard';
import OverviewAnalyticsCard from './OverviewAnalyticsCard';
import OverviewSkeleton from './OverviewSkeleton';

export const instant = false;

async function OverviewContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  await connectDB();
  const trip = await Trip.findById(id).populate('members', 'username avatarId email').lean();

  if (!trip) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <p className="text-xl font-semibold mb-2" style={{ color: 'var(--color-charcoal)' }}>
          Trip Not Found
        </p>
        <p className="text-sm" style={{ color: 'rgba(26,30,28,0.5)' }}>
          This trip may have been removed or you may not have access.
        </p>
      </div>
    );
  }

  const currency = trip.currency || 'INR';
  const members: any[] = (trip.members as any[]) || [];

  // 1. Fetch real expenses and calculate total shared spend & my share
  const expenses = await Expense.find({ tripId: id }).populate('paidBy', 'username avatarId').lean();
  
  // Strictly exclude personal/private expenses and settlements from the group shared spend
  const sharedExpenses = expenses.filter(
    (e: any) => !e.isPersonal && e.splitType !== 'personal' && e.category !== 'Settlement'
  );
  const totalTripSpend = sharedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  let myTotalPaid = 0;
  let myShareOwed = 0;

  sharedExpenses.forEach((e: any) => {
    const payerId = e.paidBy?._id ? e.paidBy._id.toString() : e.paidBy?.toString();
    const isPayer = payerId === session.user.id;
    const included = e.includedMembers && e.includedMembers.length > 0 ? e.includedMembers : trip.members;
    const isIncluded = included.some((m: any) => (m?._id ? m._id.toString() : m.toString()) === session.user.id);

    let userOwed = 0;
    if ((e.splitType === 'exact' || e.splitType === 'percentage') && e.splitDetails && e.splitDetails.length > 0) {
      const detail = e.splitDetails.find(
        (d: any) => (d.userId?._id ? d.userId._id.toString() : d.userId?.toString()) === session.user.id
      );
      if (detail) userOwed = detail.amountOwed || 0;
    } else if (isIncluded) {
      userOwed = (e.amount || 0) / Math.max(1, included.length);
    }

    if (isPayer) {
      myTotalPaid += e.amount || 0;
    }
    if (userOwed > 0) {
      myShareOwed += userOwed;
    }
  });

  const myNetBalance = myTotalPaid - myShareOwed;

  // 2. Fetch upcoming milestone
  const nextMilestone = await Task.findOne({
    tripId: id,
    type: 'milestone',
    isCompleted: false,
  })
    .populate('createdBy', 'username avatarId')
    .sort({ targetDate: 1, _id: 1 })
    .lean();

  // 3. Fetch checklist items (both Errands and Gear)
  const checklistItems = await Task.find({
    tripId: id,
    type: { $in: ['errand', 'gear'] },
    isCompleted: false,
  })
    .populate('assignedTo', 'username avatarId')
    .populate('createdBy', 'username avatarId')
    .sort({ _id: -1 })
    .lean();

  // Rule 5: Only show items claimed by SELF or UNCLAIMED (completely exclude items claimed by others)
  const myClaimedItems = checklistItems.filter(
    (t: any) => t.assignedTo && t.assignedTo._id?.toString() === session.user.id
  );
  const unclaimedItems = checklistItems.filter((t: any) => !t.assignedTo);

  // 4. Fetch Budget target
  const budget = await Budget.findOne({ tripId: id })
    .populate('items.guesses.userId', 'username avatarId')
    .populate('acknowledgments', 'username avatarId')
    .lean();
  const budgetItems = (budget as any)?.items || [];

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

  const serializedSharedExpenses = sharedExpenses.map((e: any) => ({
    _id: e._id.toString(),
    amount: e.amount || 0,
    description: e.description || '',
    category: e.category || 'Misc',
    paidBy: {
      _id: e.paidBy?._id ? e.paidBy._id.toString() : e.paidBy?.toString() || '',
      username: e.paidBy?.username || 'Unknown',
      avatarId: e.paidBy?.avatarId || 'avatar-fox.svg',
    },
    includedMembers: (e.includedMembers || []).map((m: any) => (m?._id ? m._id.toString() : m.toString())),
    timestamp: e.timestamp
      ? (e.timestamp instanceof Date ? e.timestamp.toISOString() : new Date(e.timestamp).toISOString())
      : new Date().toISOString(),
  }));

  const creatorId = (trip.creatorId as any)?._id
    ? (trip.creatorId as any)._id.toString()
    : trip.creatorId?.toString() || '';
  const isCreator = creatorId === session.user.id;

  const serializedMembers = members.map((m: any) => ({
    _id: m._id ? m._id.toString() : m.toString(),
    username: m.username || 'Member',
    avatarId: m.avatarId,
  }));

  const serializedMyClaimed = myClaimedItems.map((item: any) => ({
    _id: item._id.toString(),
    type: item.type,
    title: item.title,
    quantity: item.quantity || 1,
    createdBy: item.createdBy
      ? {
          _id: item.createdBy._id?.toString() || '',
          username: item.createdBy.username || 'Member',
          avatarId: item.createdBy.avatarId,
        }
      : undefined,
  }));

  const serializedUnclaimed = unclaimedItems.map((item: any) => ({
    _id: item._id.toString(),
    type: item.type,
    title: item.title,
    quantity: item.quantity || 1,
    createdBy: item.createdBy
      ? {
          _id: item.createdBy._id?.toString() || '',
          username: item.createdBy.username || 'Member',
          avatarId: item.createdBy.avatarId,
        }
      : undefined,
  }));

  const headerTripData = {
    _id: trip._id.toString(),
    name: trip.name,
    destinationQuery: trip.destinationQuery,
    startDate: trip.startDate ? new Date(trip.startDate).toISOString() : undefined,
    endDate: trip.endDate ? new Date(trip.endDate).toISOString() : undefined,
    status: trip.status || 'active',
    currency: trip.currency || 'INR',
    roomCode: trip.roomCode,
    creatorId: creatorId,
  };

  // Zero state detection: Brand new trip with no expenses, stops, gear, or budget
  const isZeroState =
    sharedExpenses.length === 0 &&
    !nextMilestone &&
    checklistItems.length === 0 &&
    budgetItems.length === 0;

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      {/* 1. Trip Hero Header with Destination, Dates, Avatars, Invite Crew, and ⋯ Menu */}
      <TripHeaderCard
        trip={headerTripData}
        members={serializedMembers}
        isCreator={isCreator}
      />

      {isZeroState ? (
        /* Brand New Trip (Zero State): No empty charts or ₹0 cards. Fits on one screen with zero scrolling */
        <div className="mt-3 sm:mt-4 space-y-2.5">
          <p className="text-xs font-semibold text-gray-500 px-1">
            Get started
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
            {/* Starter Prompt 1: Plan */}
            <Link
              href={`/trip/${id}/plan`}
              className="p-4 rounded-2xl bg-white shadow-xs hover:shadow-sm transition-all group flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-3 active:scale-[0.99]"
            >
              <div className="w-10 h-10 rounded-xl bg-[#eef4f0] text-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                🗺️
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#4a6454] transition-colors">
                  Plan your first stop
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add places, sights, and dates
                </p>
              </div>
              <span className="text-xs font-bold text-[#4a6454] group-hover:translate-x-1 transition-transform sm:mt-2">
                Plan →
              </span>
            </Link>

            {/* Starter Prompt 2: Money */}
            <Link
              href={`/trip/${id}/money?add=true`}
              className="p-4 rounded-2xl bg-white shadow-xs hover:shadow-sm transition-all group flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-3 active:scale-[0.99]"
            >
              <div className="w-10 h-10 rounded-xl bg-[#eef4f0] text-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                🧾
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#4a6454] transition-colors">
                  Log first expense
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Split bills &amp; track receipts
                </p>
              </div>
              <span className="text-xs font-bold text-[#4a6454] group-hover:translate-x-1 transition-transform sm:mt-2">
                Add →
              </span>
            </Link>

            {/* Starter Prompt 3: Tasks & Packing */}
            <Link
              href={`/trip/${id}/tasks`}
              className="p-4 rounded-2xl bg-white shadow-xs hover:shadow-sm transition-all group flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-3 active:scale-[0.99]"
            >
              <div className="w-10 h-10 rounded-xl bg-[#eef4f0] text-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                🎒
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#4a6454] transition-colors">
                  Add packing gear
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Checklists &amp; shared gear
                </p>
              </div>
              <span className="text-xs font-bold text-[#4a6454] group-hover:translate-x-1 transition-transform sm:mt-2">
                Gear →
              </span>
            </Link>
          </div>
        </div>
      ) : (
        /* Active Trip: Sleek 3-Card Glance View */
        <div className="space-y-3 sm:space-y-4 mt-1">
          {/* 1. 1-Line Net Balance Glance */}
          <Link
            href={`/trip/${id}/money`}
            className="block rounded-2xl p-3.5 sm:p-4 bg-white shadow-xs hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="text-base sm:text-lg">💳</span>
                <span className="text-gray-500 font-medium">Spent:</span>
                <span className="font-bold font-mono text-[#1a1e1c]">
                  {formatMoney(totalTripSpend, currency)}
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500 font-medium">Your share:</span>
                <span
                  className="font-bold font-mono"
                  style={{
                    color: myNetBalance > 0.01 ? '#2e7d32' : myNetBalance < -0.01 ? '#ba1a1a' : '#5f6368',
                  }}
                >
                  {myNetBalance > 0.01 ? `+${formatMoney(myNetBalance, currency)}` : formatMoney(myNetBalance, currency)}
                </span>
              </div>
              <span className="text-xs font-semibold text-[#4a6454] group-hover:translate-x-0.5 transition-transform flex items-center gap-1 shrink-0 ml-2">
                <span className="hidden sm:inline">Details</span>
                <span>→</span>
              </span>
            </div>
          </Link>

          {/* 2. Today's Plan & Upcoming Stop Card */}
          <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">📍</span>
                <h2
                  className="text-xs sm:text-sm font-semibold text-gray-700"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  Today&apos;s plan &amp; stops
                </h2>
              </div>
              <Link
                href={`/trip/${id}/plan`}
                className="text-xs font-semibold text-[#4a6454] hover:underline"
              >
                Full Plan →
              </Link>
            </div>

            {nextMilestone ? (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f7faf6] border border-black/[0.04] gap-2 mt-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1a1e1c] truncate">{nextMilestone.title}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    {nextMilestone.targetDate && (
                      <span>Target: {new Date(nextMilestone.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    )}
                    {Boolean(nextMilestone.createdBy) && (
                      <span className="hidden sm:inline">• Added by {getAvatarEmoji((nextMilestone.createdBy as any)?.avatarId)} {(nextMilestone.createdBy as any)?.username}</span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/trip/${id}/plan`}
                  className="text-xs font-semibold text-[#4a6454] px-3 py-1.5 rounded-xl bg-white border border-black/[0.08] hover:bg-gray-50 transition-all shrink-0"
                >
                  View Stop →
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f7faf6] border border-black/[0.04] text-xs text-gray-500 mt-2">
                <span>No upcoming stops scheduled.</span>
                <Link
                  href={`/trip/${id}/plan`}
                  className="font-semibold text-[#4a6454] hover:underline shrink-0"
                >
                  + Add Stop
                </Link>
              </div>
            )}
          </div>

          {/* 3. Combined Trip Tasks & Gear (2-tab switch: My Tasks | Open Tasks; auto-hides if empty) */}
          <OverviewTasksCard
            tripId={id}
            myTasks={serializedMyClaimed}
            openTasks={serializedUnclaimed}
          />

          {/* 4. Spending Analytics & Insights Card (only shown when expenses exist) */}
          {serializedSharedExpenses.length > 0 && (
            <OverviewAnalyticsCard
              budget={serializedBudget}
              expenses={serializedSharedExpenses}
              members={serializedMembers}
              currency={currency}
              totalActualSpend={totalTripSpend}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewContent params={params} />
    </Suspense>
  );
}
