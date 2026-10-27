'use client';

import { useState, useMemo } from 'react';
import { formatMoney } from '@/lib/utils/currency';
import { getAvatarEmoji } from '@/lib/constants/avatars';
import { BUDGET_CATEGORIES, detectExpenseCategory } from '@/lib/utils/categorizeExpense';
import { SerializedBudget } from './BudgetGuessingHub';

interface Member {
  _id: string;
  username: string;
  avatarId?: string;
}

interface ExpenseItem {
  _id: string;
  amount: number;
  description: string;
  category?: string;
  paidBy: {
    _id: string;
    username: string;
    avatarId?: string;
  };
  includedMembers: string[];
  timestamp: string;
}

interface BudgetSpendingAnalyticsProps {
  budget: SerializedBudget | null;
  expenses: ExpenseItem[];
  members: Member[];
  currency?: string;
  totalActualSpend: number;
}

type TabType = 'daily' | 'categories' | 'distribution' | 'travelers';

const CATEGORY_ICONS: Record<string, string> = {
  Stay: '🏡',
  Transport: '✈️',
  'Food & Dining': '🍽️',
  Activities: '🏄',
  Shopping: '🛍️',
  Misc: '📦',
};

export default function BudgetSpendingAnalytics({
  budget,
  expenses,
  members,
  currency = 'INR',
  totalActualSpend: propTotalActualSpend,
}: BudgetSpendingAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Exclude debt settlements from analytics so peer-to-peer reimbursements do not corrupt spending or inflate budget
  const actualExpenses = useMemo(() => {
    return expenses.filter(
      (e) => e.category !== 'Settlement' && detectExpenseCategory(e.description, e.category) !== 'Settlement'
    );
  }, [expenses]);

  const effectiveActualSpend = useMemo(() => {
    return actualExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [actualExpenses]);

  const targetBudget = budget?.totalEstimated || 0;
  const remainingBudget = targetBudget - effectiveActualSpend;
  const percentSpent = targetBudget > 0 ? Math.round((effectiveActualSpend / targetBudget) * 100) : 0;
  const perPersonTarget = members.length > 0 ? targetBudget / members.length : targetBudget;
  const perPersonSpend = members.length > 0 ? effectiveActualSpend / members.length : effectiveActualSpend;

  // Health status
  const isOverBudget = remainingBudget < 0;
  const isNearBudget = percentSpent >= 80 && !isOverBudget;
  const healthColor = isOverBudget ? '#ba1a1a' : isNearBudget ? '#d97706' : '#4a6454';
  const healthBg = isOverBudget ? '#ffdad6' : isNearBudget ? '#fef3c7' : '#ccead5';
  const healthLabel = isOverBudget ? 'Over Budget' : isNearBudget ? 'Near Limit (80%+)' : 'Healthy';

  // 1. Daily spending calculation (excluding settlements)
  const dailyStats = useMemo(() => {
    const map = new Map<
      string,
      { key: string; date: string; fullDate: string; total: number; count: number; items: ExpenseItem[] }
    >();

    const sorted = [...actualExpenses].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sorted.forEach((e) => {
      const d = new Date(e.timestamp);
      if (isNaN(d.getTime())) return;

      // Group by user's local day to align with local formatting
      const localYear = d.getFullYear();
      const localMonth = String(d.getMonth() + 1).padStart(2, '0');
      const localDay = String(d.getDate()).padStart(2, '0');
      const key = `${localYear}-${localMonth}-${localDay}`;

      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDate = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      if (!map.has(key)) {
        map.set(key, { key, date: dateLabel, fullDate, total: 0, count: 0, items: [] });
      }
      const entry = map.get(key)!;
      entry.total += e.amount || 0;
      entry.count += 1;
      entry.items.push(e);
    });

    const days = Array.from(map.values());
    const maxDaySpend = days.length > 0 ? Math.max(...days.map((d) => d.total)) : 0;
    const avgDaySpend = days.length > 0 ? Math.round(effectiveActualSpend / days.length) : 0;
    const peakDay =
      days.length > 0
        ? days.reduce((prev, curr) => (curr.total > prev.total ? curr : prev), days[0])
        : null;

    return { days, maxDaySpend, avgDaySpend, peakDay };
  }, [actualExpenses, effectiveActualSpend]);

  // 2. Category data aggregation (excluding settlements)
  const categoryStats = useMemo(() => {
    return BUDGET_CATEGORIES.map((cat) => {
      const plannedItems = (budget?.items || []).filter((i) => i.category === cat);
      const plannedTotal = plannedItems.reduce(
        (sum, i) => sum + (i.isLocked && i.agreedCost != null ? i.agreedCost : i.consensusCost || 0),
        0
      );

      const catExpenses = actualExpenses.filter(
        (e) => detectExpenseCategory(e.description, e.category) === cat
      );
      const actualTotal = catExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      const catRemaining = plannedTotal - actualTotal;
      const catPercent = plannedTotal > 0 ? Math.round((actualTotal / plannedTotal) * 100) : 0;

      return {
        category: cat,
        icon: CATEGORY_ICONS[cat] || '•',
        plannedTotal,
        actualTotal,
        remaining: catRemaining,
        percent: catPercent,
        expenseCount: catExpenses.length,
        itemCount: plannedItems.length,
      };
    });
  }, [budget, actualExpenses]);

  // 3. Traveler spending aggregation (excluding settlements)
  const travelerStats = useMemo(() => {
    return members.map((m) => {
      const memberIdStr = String(m._id);
      const totalPaid = actualExpenses
        .filter((e) => {
          const payerId = e.paidBy?._id ? String(e.paidBy._id) : String(e.paidBy || '');
          return payerId === memberIdStr;
        })
        .reduce((sum, e) => sum + e.amount, 0);

      let totalShare = 0;
      actualExpenses.forEach((e) => {
        const included =
          e.includedMembers && e.includedMembers.length > 0 ? e.includedMembers : members.map((mem) => mem._id);
        const includedStrs = included.map((uid: any) => String(uid?._id || uid));
        if (includedStrs.includes(memberIdStr)) {
          totalShare += e.amount / Math.max(1, includedStrs.length);
        }
      });

      const netBalance = totalPaid - totalShare;

      return {
        member: m,
        totalPaid,
        totalShare,
        netBalance,
        percentOfTotalPaid: effectiveActualSpend > 0 ? Math.round((totalPaid / effectiveActualSpend) * 100) : 0,
      };
    });
  }, [members, actualExpenses, effectiveActualSpend]);

  // Donut Gauge SVG calculation
  const donutRadius = 46;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutStrokeDashoffset =
    donutCircumference - (Math.min(100, Math.max(0, percentSpent)) / 100) * donutCircumference;

  const tabs: { id: TabType; icon: string; label: string }[] = [
    { id: 'daily', icon: '📅', label: 'Daily Spend' },
    { id: 'categories', icon: '📊', label: 'Categories' },
    { id: 'distribution', icon: '🔘', label: 'Breakdown' },
    { id: 'travelers', icon: '👥', label: 'Travelers' },
  ];

  return (
    <div className="space-y-3">
      {/* Fixed Segmented Tabs (Zero Layout Shift) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-[#ecefeb] p-0.5 rounded-xl gap-0.5 select-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-1.5 px-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                isActive
                  ? 'bg-white text-[#1a1e1c] shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 bg-transparent'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: DAILY SPENDING TRACKER (Day-by-Day Burn Rate)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'daily' && (
        <div
          className="rounded-2xl p-3.5 sm:p-5 bg-white"
          style={{
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3
                className="text-base sm:text-lg font-semibold text-[#1a1e1c]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Daily Spending & Burn Rate
              </h3>
              <p className="text-xs text-gray-500">
                Shows exact expense totals for each day to identify peak spending moments.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-[#f1f4f1] text-[#183124] font-medium font-mono">
                Avg: {formatMoney(dailyStats.avgDaySpend, currency)} / day
              </span>
            </div>
          </div>

          {dailyStats.days.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <span className="text-3xl block mb-2">📅</span>
              <p className="text-sm font-medium text-gray-600">No expenses recorded yet</p>
              <p className="text-xs mt-1">Logged expenses will populate your daily spending timeline.</p>
            </div>
          ) : (
            <div>
              {/* SVG Daily Bar Graph */}
              <div className="w-full overflow-x-auto pb-2">
                <svg viewBox="0 0 600 200" className="w-full h-auto min-w-[460px] select-none">
                  {/* Grid Lines */}
                  {[0, 0.5, 1].map((ratio) => {
                    const y = 30 + 120 * (1 - ratio);
                    const val = ratio * dailyStats.maxDaySpend;
                    return (
                      <g key={ratio}>
                        <line
                          x1="50"
                          y1={y}
                          x2="580"
                          y2={y}
                          stroke="#f1f4f1"
                          strokeWidth="1"
                        />
                        <text
                          x="42"
                          y={y + 3.5}
                          textAnchor="end"
                          fontSize="9"
                          fill="#9ca3af"
                          fontFamily="monospace"
                        >
                          {formatMoney(val, currency)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Average Daily Line */}
                  {dailyStats.avgDaySpend > 0 && dailyStats.maxDaySpend > 0 && (
                    <line
                      x1="50"
                      y1={150 - (dailyStats.avgDaySpend / dailyStats.maxDaySpend) * 120}
                      x2="580"
                      y2={150 - (dailyStats.avgDaySpend / dailyStats.maxDaySpend) * 120}
                      stroke="#b0cdba"
                      strokeWidth="1.5"
                      strokeDasharray="4,4"
                    />
                  )}

                  {/* Day Bars */}
                  {dailyStats.days.map((day, idx) => {
                    const barCount = dailyStats.days.length;
                    const colWidth = Math.min(80, 500 / barCount);
                    const startX = 65 + idx * colWidth;
                    const barW = Math.max(16, colWidth * 0.5);

                    const barH =
                      dailyStats.maxDaySpend > 0
                        ? Math.max(4, (day.total / dailyStats.maxDaySpend) * 120)
                        : 4;
                    const baseY = 150;
                    const isPeak = dailyStats.peakDay?.date === day.date && dailyStats.days.length > 1;

                    return (
                      <g key={day.key || `${day.date}-${idx}`} className="cursor-pointer">
                        {/* The Bar */}
                        <rect
                          x={startX}
                          y={baseY - barH}
                          width={barW}
                          height={barH}
                          rx="4"
                          fill={isPeak ? '#324c3d' : '#4a6454'}
                          className="transition-all hover:opacity-80"
                        />

                        {/* Amount on top of bar */}
                        <text
                          x={startX + barW / 2}
                          y={baseY - barH - 6}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="600"
                          fill="#1a1e1c"
                          fontFamily="monospace"
                        >
                          {formatMoney(day.total, currency)}
                        </text>

                        {/* Date label */}
                        <text
                          x={startX + barW / 2}
                          y={baseY + 16}
                          textAnchor="middle"
                          fontSize="9"
                          fill="#6b7280"
                          fontWeight="500"
                        >
                          {day.date}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Day-by-Day Cards */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Daily Breakdown & Receipts
                </p>
                {dailyStats.days.map((day, idx) => {
                  const dayId = day.key || `${day.date}-${idx}`;
                  const isExpanded = expandedDay === dayId;
                  const isPeak = dailyStats.peakDay?.date === day.date && dailyStats.days.length > 1;

                  return (
                    <div
                      key={dayId}
                      className="rounded-2xl border border-gray-100 bg-gray-50 p-3.5 transition-all"
                    >
                      <div
                        onClick={() => setExpandedDay(isExpanded ? null : dayId)}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {day.fullDate}
                          </span>
                          {isPeak && (
                            <span className="text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              ⭐ Peak Day
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            ({day.count} {day.count === 1 ? 'expense' : 'expenses'})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold font-mono text-[#4a6454]">
                            {formatMoney(day.total, currency)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {isExpanded ? '▴' : '▾'}
                          </span>
                        </div>
                      </div>

                      {/* Expanded receipts on this day */}
                      {isExpanded && (
                        <div className="mt-3 pt-2.5 border-t border-gray-200 space-y-1.5 animate-in fade-in">
                          {day.items.map((item) => (
                            <div
                              key={item._id}
                              className="flex items-center justify-between text-xs py-1"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span>{getAvatarEmoji(item.paidBy?.avatarId)}</span>
                                <span className="text-gray-700 truncate font-medium">
                                  {item.description}
                                </span>
                                <span className="text-gray-400 text-[0.6875rem]">
                                  • Paid by {item.paidBy?.username || 'Member'}
                                </span>
                              </div>
                              <span className="font-mono font-semibold text-gray-900 shrink-0 pl-2">
                                {formatMoney(item.amount, currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: CATEGORY BARS (Budget vs Actual Spend)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <div
          className="rounded-2xl p-3.5 sm:p-5 bg-white"
          style={{
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3
                className="text-base sm:text-lg font-semibold text-[#1a1e1c]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Category Comparison: Budget vs. Spend
              </h3>
              <p className="text-xs text-gray-500">
                Directly compares planned category estimates against recorded expenses.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#b0cdba]" />
                <span className="text-gray-600">Planned Budget</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#4a6454]" />
                <span className="text-gray-600">Actual Spend</span>
              </span>
            </div>
          </div>

          {/* List of Category Details */}
          <div className="space-y-2.5">
            {categoryStats.map((item) => {
              const maxScale = Math.max(item.plannedTotal, item.actualTotal, 1);
              const plannedWidth = Math.round((item.plannedTotal / maxScale) * 100);
              const actualWidth = Math.round((item.actualTotal / maxScale) * 100);
              const isCatOver = item.actualTotal > item.plannedTotal && item.plannedTotal > 0;

              return (
                <div
                  key={item.category}
                  className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                      <span>{item.icon}</span>
                      <span>{item.category}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-600">
                        {formatMoney(item.actualTotal, currency)} / {formatMoney(item.plannedTotal, currency)}
                      </span>
                      {item.plannedTotal > 0 && (
                        <span
                          className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded-md ${
                            isCatOver ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.percent}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Paired Bars */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[0.625rem] text-gray-400">
                      <span className="w-10">Planned</span>
                      <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#b0cdba]"
                          style={{ width: `${plannedWidth}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[0.625rem] text-gray-400">
                      <span className="w-10">Spent</span>
                      <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${actualWidth}%`,
                            backgroundColor: isCatOver ? '#ba1a1a' : '#4a6454',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Delta note */}
                  <div className="flex items-center justify-between text-[0.6875rem] text-gray-400 pt-1.5 border-t border-gray-200">
                    <span>
                      {item.itemCount} budget items • {item.expenseCount} logged receipts
                    </span>
                    {item.plannedTotal > 0 && (
                      <span className={isCatOver ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>
                        {isCatOver
                          ? `Over budget by ${formatMoney(Math.abs(item.remaining), currency)}`
                          : `${formatMoney(item.remaining, currency)} buffer remaining`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: BREAKDOWN & HEALTH (Donut Gauge & Category Share)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'distribution' && (
        <div
          className="rounded-2xl p-3.5 sm:p-5 bg-white"
          style={{
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3
                className="text-base sm:text-lg font-semibold text-[#1a1e1c]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Budget Health & Category Distribution
              </h3>
              <p className="text-xs text-gray-500">
                Visual ratio of total budget consumption and expenditure split.
              </p>
            </div>
            <span
              className="text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
              style={{ backgroundColor: healthBg, color: healthColor }}
            >
              ● {healthLabel}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 py-4">
            {/* SVG Donut Ring */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r={donutRadius}
                  fill="none"
                  stroke="#ecefeb"
                  strokeWidth="10"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={donutRadius}
                  fill="none"
                  stroke={healthColor}
                  strokeWidth="10"
                  strokeDasharray={donutCircumference}
                  strokeDashoffset={donutStrokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                <span className="text-2xl font-bold font-mono text-[#1a1e1c]">
                  {percentSpent}%
                </span>
                <span className="text-[0.625rem] uppercase tracking-wider text-gray-400 font-medium">
                  {isOverBudget ? 'Over Target' : 'Consumed'}
                </span>
              </div>
            </div>

            {/* Financial Metrics */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <p className="text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">
                  Target Budget
                </p>
                <p className="text-base font-bold font-mono text-[#4a6454] mt-0.5">
                  {formatMoney(targetBudget, currency)}
                </p>
                <p className="text-[0.6875rem] text-gray-400 mt-0.5">
                  ≈ {formatMoney(perPersonTarget, currency)} / person
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <p className="text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">
                  Actual Spend
                </p>
                <p className="text-base font-bold font-mono text-[#1a1e1c] mt-0.5">
                  {formatMoney(effectiveActualSpend, currency)}
                </p>
                <p className="text-[0.6875rem] text-gray-400 mt-0.5">
                  {actualExpenses.length} receipts logged
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <p className="text-[0.6875rem] font-medium text-gray-500 uppercase tracking-wider">
                  {isOverBudget ? 'Over Budget' : 'Buffer Left'}
                </p>
                <p
                  className="text-base font-bold font-mono mt-0.5"
                  style={{ color: isOverBudget ? '#ba1a1a' : '#324c3d' }}
                >
                  {isOverBudget ? '-' : '+'}{formatMoney(Math.abs(remainingBudget), currency)}
                </p>
                <p className="text-[0.6875rem] text-gray-400 mt-0.5">
                  {isOverBudget ? 'Exceeded' : 'Remaining capacity'}
                </p>
              </div>
            </div>
          </div>

          {/* Category Share Breakdown */}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-600 mb-2">Category Spending Distribution</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {categoryStats.map((cat) => {
                const percentOfTotal =
                  effectiveActualSpend > 0 ? Math.round((cat.actualTotal / effectiveActualSpend) * 100) : 0;
                return (
                  <div
                    key={cat.category}
                    className="p-2.5 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{cat.icon}</span>
                      <span className="font-medium text-gray-700 truncate">{cat.category}</span>
                    </div>
                    <span className="font-mono font-bold text-gray-900 shrink-0 pl-1">
                      {percentOfTotal}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: TRAVELER CONTRIBUTIONS & SPLIT
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'travelers' && (
        <div
          className="rounded-2xl p-3.5 sm:p-5 bg-white"
          style={{
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3
                className="text-base sm:text-lg font-semibold text-[#1a1e1c]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Traveler Contribution Breakdown
              </h3>
              <p className="text-xs text-gray-500">
                Shows who paid for expenses vs each traveler&apos;s fair share.
              </p>
            </div>
            <span className="text-xs font-mono text-gray-500">
              Fair share: {formatMoney(perPersonSpend, currency)}
            </span>
          </div>

          <div className="space-y-3">
            {travelerStats.map((item) => {
              const maxPaid = Math.max(...travelerStats.map((t) => t.totalPaid), 1);
              const barWidth = Math.round((item.totalPaid / maxPaid) * 100);
              const isCreditor = item.netBalance > 0.01;
              const isDebtor = item.netBalance < -0.01;

              return (
                <div
                  key={item.member._id}
                  className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100"
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{getAvatarEmoji(item.member.avatarId)}</span>
                      <span className="font-semibold text-gray-800 text-sm">
                        {item.member.username}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-800">
                        Paid: {formatMoney(item.totalPaid, currency)}
                      </span>
                      <span
                        className={`text-[0.6875rem] font-bold px-2 py-0.5 rounded-md ${
                          isCreditor
                            ? 'bg-emerald-100 text-emerald-800'
                            : isDebtor
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {isCreditor
                          ? `+${formatMoney(item.netBalance, currency)} (owed)`
                          : isDebtor
                          ? `-${formatMoney(Math.abs(item.netBalance), currency)} (owes)`
                          : 'Settled'}
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 bg-[#4a6454]"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[0.6875rem] text-gray-400 mt-1.5">
                    <span>{item.percentOfTotalPaid}% of total trip spending</span>
                    <span>Share owed: {formatMoney(item.totalShare, currency)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
