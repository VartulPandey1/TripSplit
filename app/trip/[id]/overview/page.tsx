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
import OverviewAnalyticsCard from './OverviewAnalyticsCard';
import TripHeaderCard from './TripHeaderCard';

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
  const budget = await Budget.findOne({ tripId: id }).lean();
  const targetBudget = (budget as any)?.totalEstimated || 0;
  const budgetItems = (budget as any)?.items || [];

  // Serialized data for OverviewAnalyticsCard (shared group pool only)
  const serializedExpenses = sharedExpenses.map((e: any) => ({
    _id: e._id.toString(),
    amount: Number(e.amount) || 0,
    description: e.description || '',
    category: e.category || 'Misc',
    paidBy: {
      _id: e.paidBy?._id ? e.paidBy._id.toString() : e.paidBy?.toString() || '',
      username: e.paidBy?.username || 'Member',
      avatarId: e.paidBy?.avatarId || undefined,
    },
    includedMembers: (e.includedMembers || []).map((m: any) => (m?._id ? m._id.toString() : m.toString())),
    timestamp: e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString(),
  }));

  const serializedMembers = members.map((m: any) => ({
    _id: m._id ? m._id.toString() : m.toString(),
    username: m.username || 'Member',
    avatarId: m.avatarId,
  }));

  const serializedBudget = budget ? JSON.parse(JSON.stringify(budget)) : null;

  const creatorId = (trip.creatorId as any)?._id
    ? (trip.creatorId as any)._id.toString()
    : trip.creatorId?.toString() || '';
  const isCreator = creatorId === session.user.id;

  const headerTripData = {
    _id: trip._id.toString(),
    name: trip.name,
    destinationQuery: trip.destinationQuery,
    startDate: trip.startDate ? new Date(trip.startDate).toISOString() : undefined,
    endDate: trip.endDate ? new Date(trip.endDate).toISOString() : undefined,
    status: trip.status || 'active',
    currency: trip.currency || 'INR',
    roomCode: trip.roomCode,
  };

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      {/* Trip Header Card with Dynamic Status, Edit Modal, & Status Toggle */}
      <TripHeaderCard
        trip={headerTripData}
        members={serializedMembers}
        isCreator={isCreator}
      />

      {/* KPI Cards: Currency formatted in Indian Rupees or Selected Currency */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Link
          href={`/trip/${id}/money?tab=expenses`}
          className="rounded-xl sm:rounded-2xl p-3.5 sm:p-5 block transition-all hover:translate-y-[-1px]"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
          }}
        >
          <p className="text-[11px] sm:text-xs font-medium mb-1" style={{ color: 'rgba(26,30,28,0.5)' }}>
            Total Group Spend
          </p>
          <p className="text-lg sm:text-2xl font-bold font-mono truncate" style={{ color: '#4a6454' }}>
            {formatMoney(totalTripSpend, currency)}
          </p>
          <p className="text-[0.6875rem] mt-1" style={{ color: 'rgba(26,30,28,0.45)' }}>
            {expenses.length} expenses logged →
          </p>
        </Link>

        <Link
          href={`/trip/${id}/money?tab=settle`}
          className="rounded-xl sm:rounded-2xl p-3.5 sm:p-5 block transition-all hover:translate-y-[-1px]"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
          }}
        >
          <p className="text-[11px] sm:text-xs font-medium mb-1" style={{ color: 'rgba(26,30,28,0.5)' }}>
            Your Net Balance
          </p>
          <p
            className="text-lg sm:text-2xl font-bold font-mono truncate"
            style={{
              color: myNetBalance > 0.01 ? '#4a6454' : myNetBalance < -0.01 ? '#ba1a1a' : '#7e9a88',
            }}
          >
            {formatMoney(myNetBalance, currency)}
          </p>
          <p className="text-[0.6875rem] mt-1" style={{ color: 'rgba(26,30,28,0.45)' }}>
            {myNetBalance > 0.01 ? 'You get back' : myNetBalance < -0.01 ? 'You owe money' : 'All balanced'}
          </p>
        </Link>
      </div>

      {/* Budget & Spending Card */}
      <div
        className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border)',
          boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🎯</span>
            <h2
              className="text-sm sm:text-base font-semibold"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-charcoal)' }}
            >
              Budget & Spending
            </h2>
          </div>
          <Link
            href={`/trip/${id}/money?tab=budget`}
            className="text-xs font-semibold text-[#4a6454] px-3 py-1.5 rounded-xl bg-[#eef1ee] hover:bg-[#e0e3e0] transition-colors"
          >
            {budgetItems.length > 0 ? 'View Budget →' : '+ Set Budget →'}
          </Link>
        </div>

        {budgetItems.length === 0 ? (
          <p className="text-xs text-gray-400">
            No budget items configured yet. Head to the Money tab to establish your trip budget limits.
          </p>
        ) : (
          <div>
            {/* Visual Budget Health Meter: Donut + Key Figures */}
            {(() => {
              const percent = targetBudget > 0 ? Math.round((totalTripSpend / targetBudget) * 100) : 0;
              const remaining = targetBudget - totalTripSpend;
              const isOver = remaining < 0;
              const isNear = percent >= 80 && !isOver;
              const color = isOver ? '#ba1a1a' : isNear ? '#d97706' : '#4a6454';
              const r = 26;
              const c = 2 * Math.PI * r;
              const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;

              return (
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3 sm:gap-4 p-3 rounded-2xl bg-[#f7faf6] border border-[#e4e5e0]">
                    {/* Compact SVG Donut */}
                    <div className="relative w-14 sm:w-16 h-14 sm:h-16 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r={r} fill="none" stroke="#ecefeb" strokeWidth="6" />
                        <circle
                          cx="32"
                          cy="32"
                          r={r}
                          fill="none"
                          stroke={color}
                          strokeWidth="6"
                          strokeDasharray={c}
                          strokeDashoffset={offset}
                          strokeLinecap="round"
                          className="transition-all duration-500"
                        />
                      </svg>
                      <span className="absolute text-[11px] sm:text-xs font-bold font-mono text-[#1a1e1c]">
                        {percent}%
                      </span>
                    </div>

                    {/* Clear Metrics Columns */}
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[0.6875rem] text-gray-400 block uppercase tracking-wider">Target</span>
                        <span className="font-bold font-mono text-gray-800 text-xs sm:text-sm">
                          {formatMoney(targetBudget, currency)}
                        </span>
                        <span className="text-[0.625rem] text-gray-400 block">
                          {formatMoney(members.length > 0 ? targetBudget / members.length : targetBudget, currency)}/ea
                        </span>
                      </div>

                      <div>
                        <span className="text-[0.6875rem] text-gray-400 block uppercase tracking-wider">Spent</span>
                        <span className="font-bold font-mono text-xs sm:text-sm" style={{ color }}>
                          {formatMoney(totalTripSpend, currency)}
                        </span>
                        <span className="text-[0.625rem] text-gray-400 block">
                          {expenses.length} logged
                        </span>
                      </div>

                      <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 pt-1 sm:pt-0 border-gray-200">
                        <span className="text-[0.6875rem] text-gray-400 block uppercase tracking-wider">
                          {isOver ? 'Over Limit' : 'Remaining'}
                        </span>
                        <span
                          className="font-bold font-mono text-xs sm:text-sm"
                          style={{ color: isOver ? '#ba1a1a' : '#324c3d' }}
                        >
                          {isOver ? '-' : '+'}{formatMoney(Math.abs(remaining), currency)}
                        </span>
                        <span className="text-[0.625rem] text-gray-400 block">
                          {isOver ? 'Exceeded' : 'Available'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* High-Clarity Visual Progress Track with Ticks */}
                  <div>
                    <div className="flex items-center justify-between text-[0.6875rem] text-gray-400 font-mono mb-1">
                      <span>$0</span>
                      <span>50%</span>
                      <span className="text-gray-600 font-semibold">100% Target</span>
                    </div>
                    <div className="relative w-full h-2 rounded-full bg-[#ecefeb] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, percent)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Next Milestone */}
      <div
        className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border)',
          boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
        }}
      >
        <p
          className="text-sm font-semibold mb-2 flex items-center gap-2"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-charcoal)' }}
        >
          <span>📍</span> Next Upcoming Milestone
        </p>
        {nextMilestone ? (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#f7faf6] border border-[#e4e5e0] gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1a1e1c] truncate">{nextMilestone.title}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                {nextMilestone.targetDate && (
                  <span>Target: {new Date(nextMilestone.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                )}
                {Boolean(nextMilestone.createdBy) && (
                  <span>• Added by {getAvatarEmoji((nextMilestone.createdBy as any)?.avatarId)} {(nextMilestone.createdBy as any)?.username}</span>
                )}
              </div>
            </div>
            <Link
              href={`/trip/${id}/plan`}
              className="text-xs font-semibold text-[#4a6454] px-3 py-1.5 rounded-xl bg-white border border-[#e4e5e0] hover:bg-gray-50 transition-all shrink-0"
            >
              Plan →
            </Link>
          </div>
        ) : (
          <p className="text-xs text-gray-400 py-1">
            No stops planned yet.{' '}
            <Link href={`/trip/${id}/plan`} className="text-[#4a6454] underline font-medium">
              Open Plan tab
            </Link>{' '}
            to add itinerary stops.
          </p>
        )}
      </div>

      {/* Section A: Your Responsibilities (Claimed by Self) - Only shown if there are items */}
      {myClaimedItems.length > 0 && (
        <div
          className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-sm sm:text-base font-semibold flex items-center gap-2"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-charcoal)' }}
            >
              <span>🎯</span>
              <span>Your Responsibilities (Taken by You)</span>
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#ccead5] text-[#183124]">
              {myClaimedItems.length}
            </span>
          </div>

          <div className="flex flex-col divide-y divide-[#f1f4f1]">
            {myClaimedItems.map((item: any) => (
              <div key={item._id.toString()} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{item.type === 'errand' ? '📋' : '🎒'}</span>
                    <span className="text-sm font-medium text-gray-800 truncate">{item.title}</span>
                  </div>
                  {item.createdBy && (
                    <p className="text-[0.7rem] text-gray-400 mt-0.5">
                      Added by {getAvatarEmoji(item.createdBy.avatarId)} {item.createdBy.username}
                    </p>
                  )}
                </div>
                <Link
                  href={`/trip/${id}/tasks`}
                  className="text-xs text-[#4a6454] font-semibold px-2.5 py-1 rounded-lg bg-[#eef1ee] hover:bg-[#e0e3e0] transition-colors shrink-0"
                >
                  Complete in Tasks →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section B: Needs a Volunteer (Unclaimed Items) - Only shown if there are items */}
      {unclaimedItems.length > 0 && (
        <div
          className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-sm sm:text-base font-semibold flex items-center gap-2"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-charcoal)' }}
            >
              <span>🙋</span>
              <span>Needs a Volunteer (Unclaimed Items)</span>
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {unclaimedItems.length} open
            </span>
          </div>

          <div className="flex flex-col divide-y divide-[#f1f4f1]">
            {unclaimedItems.map((item: any) => (
              <div key={item._id.toString()} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{item.type === 'errand' ? '📋' : '🎒'}</span>
                    <span className="text-sm font-medium text-gray-800 truncate">{item.title}</span>
                  </div>
                  {item.createdBy && (
                    <p className="text-[0.7rem] text-gray-400 mt-0.5">
                      Added by {getAvatarEmoji(item.createdBy.avatarId)} {item.createdBy.username}
                    </p>
                  )}
                </div>
                <Link
                  href={`/trip/${id}/tasks`}
                  className="text-xs font-semibold text-[#183124] px-2.5 py-1 rounded-full bg-[#ccead5] hover:bg-[#b0cdba] transition-colors shrink-0"
                >
                  Volunteer / Claim
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spending Analytics Glimpse Card (Opens full analytics modal with all tabs) */}
      <div className="mb-4 sm:mb-6">
        <OverviewAnalyticsCard
          budget={serializedBudget}
          expenses={serializedExpenses}
          members={serializedMembers}
          currency={currency}
          totalActualSpend={totalTripSpend}
        />
      </div>
    </div>
  );
}

export default function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-2xl mx-auto text-center py-20" style={{ color: 'rgba(26,30,28,0.45)' }}>
          Loading trip details…
        </div>
      }
    >
      <OverviewContent params={params} />
    </Suspense>
  );
}
