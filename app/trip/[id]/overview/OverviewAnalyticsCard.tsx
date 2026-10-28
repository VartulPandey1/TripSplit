'use client';

import { useState } from 'react';
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

  return (
    <>
      {/* 1. SLEEK 1-LINE ACTION BAR AT BOTTOM OF OVERVIEW */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-[#f7faf6] active:bg-[#eef4f0] shadow-xs hover:shadow-sm transition-all flex items-center justify-between text-xs sm:text-sm cursor-pointer group text-left"
      >
        <div className="flex items-center gap-2 text-[#181c1a] min-w-0">
          <span className="text-base sm:text-lg shrink-0">📊</span>
          <span className="font-semibold shrink-0">Spending Analytics</span>
          <span className="text-gray-300 shrink-0">•</span>
          <span className="text-gray-500 font-normal hidden sm:inline truncate">
            Tap to view charts &amp; breakdown
          </span>
          <span className="text-gray-500 font-normal sm:hidden truncate">
            Tap to view charts ↗
          </span>
        </div>
        <span className="text-xs font-semibold text-[#4a6454] group-hover:translate-x-0.5 transition-transform flex items-center gap-1 shrink-0 ml-2">
          <span className="hidden sm:inline">View charts</span>
          <span>→</span>
        </span>
      </button>

      {/* 2. FULL INTERACTIVE ANALYTICS SLIDE-UP BOTTOM SHEET */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle for Mobile */}
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-3 mb-1 sm:hidden shrink-0 cursor-grab" />

            {/* Modal Header */}
            <div className="p-4 sm:p-5 pb-3 flex items-center justify-between border-b border-black/[0.04] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <div>
                  <h3
                    className="text-base sm:text-lg font-bold text-[#181c1a]"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    Trip spending analytics
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Comprehensive expense tracking &amp; distribution
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#ecefeb] flex items-center justify-center text-sm font-semibold text-[#424843] hover:text-[#181c1a] hover:bg-[#e0e3e0] transition-colors cursor-pointer shrink-0"
                aria-label="Close analytics"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Renders all 4 tabs of BudgetSpendingAnalytics */}
            <div className="p-3.5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 overflow-y-auto flex-1">
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
