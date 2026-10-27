'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/utils/currency';
import BudgetSpendingAnalytics from '../money/BudgetSpendingAnalytics';
import { SerializedBudget } from '../money/BudgetGuessingHub';

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

interface OverviewAnalyticsCardProps {
  budget: SerializedBudget | null;
  expenses: ExpenseItem[];
  members: Member[];
  currency?: string;
  totalActualSpend: number;
}

export default function OverviewAnalyticsCard({
  budget,
  expenses,
  members,
  currency = 'INR',
  totalActualSpend,
}: OverviewAnalyticsCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Calculate quick glimpse figures
  // 1. Top category
  const catTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    const c = e.category || 'Misc';
    catTotals[c] = (catTotals[c] || 0) + (e.amount || 0);
  });
  let topCategory = 'None';
  let topCategoryAmount = 0;
  Object.entries(catTotals).forEach(([cat, sum]) => {
    if (sum > topCategoryAmount) {
      topCategory = cat;
      topCategoryAmount = sum;
    }
  });

  // 2. Daily average
  const uniqueDays = new Set(
    expenses.map((e) => new Date(e.timestamp).toDateString())
  ).size;
  const avgDaily = uniqueDays > 0 ? totalActualSpend / uniqueDays : totalActualSpend;

  return (
    <>
      {/* 1. GLIMPSE CARD AT END OF OVERVIEW */}
      <div
        onClick={() => setIsOpen(true)}
        className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white border border-[#e4e5e0] shadow-2xs hover:border-[#7e9a88] transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <div>
              <h2
                className="text-sm sm:text-base font-semibold text-[#1a1e1c]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Spending Analytics & Insights
              </h2>
              <p className="text-[11px] text-gray-500">
                Daily burn rates, category breakdowns & traveler shares
              </p>
            </div>
          </div>
          <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f1f4f1] text-[#4a6454] group-hover:bg-[#ccead5] group-hover:text-[#183124] transition-colors">
            View Analytics →
          </span>
        </div>

        {/* 2-Column Quick Stats Preview */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 bg-[#f7faf6] rounded-xl sm:rounded-2xl p-3 border border-[#e4e5e0]">
          <div>
            <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold">
              Daily Burn Rate
            </span>
            <span className="font-bold font-mono text-sm sm:text-base text-[#181c1a] mt-0.5 block">
              {formatMoney(avgDaily, currency)}
              <span className="text-[10px] font-normal text-gray-400 ml-1">/ day</span>
            </span>
          </div>

          <div>
            <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold truncate">
              Top Category
            </span>
            <span className="font-bold text-xs sm:text-sm text-[#4a6454] mt-0.5 block truncate">
              {topCategory !== 'None' ? `${topCategory} (${formatMoney(topCategoryAmount, currency)})` : 'None logged'}
            </span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-400 group-hover:text-[#4a6454] font-medium transition-colors">
          <span>Tap to open comprehensive charts & member splits</span>
          <span className="text-xs">↗</span>
        </div>
      </div>

      {/* 2. FULL INTERACTIVE ANALYTICS MODAL / BOTTOM SHEET */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 border border-[#e4e5e0]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle for Mobile */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="p-4 sm:p-5 pb-3 flex items-center justify-between border-b border-[#f1f4f1] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <div>
                  <h3
                    className="text-base sm:text-lg font-bold text-[#181c1a]"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    Trip Spending Analytics
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Comprehensive expense tracking & distribution
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-[#ecefeb] flex items-center justify-center text-xs text-[#424843] hover:text-[#181c1a] hover:bg-[#e0e3e0] transition-colors cursor-pointer"
                aria-label="Close analytics"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Renders all tabs of BudgetSpendingAnalytics */}
            <div className="p-3.5 sm:p-6 overflow-y-auto flex-1">
              <BudgetSpendingAnalytics
                budget={budget}
                expenses={expenses}
                members={members}
                currency={currency}
                totalActualSpend={totalActualSpend}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
