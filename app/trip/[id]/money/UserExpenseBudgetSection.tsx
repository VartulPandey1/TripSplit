'use client';

import { useState, useEffect } from 'react';
import { formatMoney } from '@/lib/utils/currency';
import { getAvatarEmoji } from '@/lib/constants/avatars';
import { Transaction } from '@/lib/utils/settleUp';

interface Member {
  _id: string;
  username: string;
  avatarId?: string;
  email?: string;
}

interface ExpenseItem {
  _id: string;
  amount: number;
  description: string;
  splitType: string;
  paidBy: {
    _id: string;
    username: string;
    avatarId?: string;
  };
  includedMembers: string[];
  timestamp: string;
}

interface UserExpenseBudgetSectionProps {
  tripId: string;
  currentUserId: string;
  members: Member[];
  expenses: ExpenseItem[];
  currency: string;
  tripBudgetTotal?: number;
  settlements: Transaction[];
  onAddExpense?: () => void;
  onViewAllSettlements?: () => void;
  onViewLedger?: () => void;
}

export default function UserExpenseBudgetSection({
  tripId,
  currentUserId,
  members,
  expenses,
  currency,
  tripBudgetTotal = 0,
  settlements,
  onAddExpense,
  onViewAllSettlements,
  onViewLedger,
}: UserExpenseBudgetSectionProps) {
  const memberMap = new Map<string, Member>();
  members.forEach((m) => memberMap.set(m._id, m));

  // Default calculated budget share (equal split of trip budget, or 0)
  const defaultBudgetShare =
    tripBudgetTotal > 0 && members.length > 0
      ? Math.round(tripBudgetTotal / members.length)
      : 0;

  const storageKey = `tripsplit_user_budget_${tripId}_${currentUserId}`;
  const [personalBudget, setPersonalBudget] = useState<number>(defaultBudgetShare);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  // Load persisted custom budget from MongoDB (with localStorage cache)
  useEffect(() => {
    let isMounted = true;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 0) {
          setPersonalBudget(parsed);
        }
      }
    } catch {
      // localStorage may be unavailable
    }

    // Always fetch latest from MongoDB for multi-device continuity
    fetch(`/api/budget/personal?tripId=${tripId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && typeof data.amount === 'number' && data.amount > 0) {
          setPersonalBudget(data.amount);
          try {
            localStorage.setItem(storageKey, String(data.amount));
          } catch {}
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [tripId, currentUserId, storageKey]);

  function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(budgetInput);
    if (!isNaN(val) && val >= 0) {
      setPersonalBudget(val);
      try {
        localStorage.setItem(storageKey, String(val));
      } catch {
        // ignore storage errors
      }

      // Persist to MongoDB for multi-device continuity
      fetch('/api/budget/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, amount: val }),
      }).catch((err) => {
        console.warn('Failed to sync personal budget to database', err);
      });

      setIsEditingBudget(false);
    }
  }

  // Filter only transactions where current user has a financial stake / has to pay
  const userTransactions = expenses
    .map((exp) => {
      const participatingCount =
        exp.includedMembers && exp.includedMembers.length > 0
          ? exp.includedMembers.length
          : members.length;
      const isIncluded =
        exp.includedMembers && exp.includedMembers.length > 0
          ? exp.includedMembers.some((m: any) => String(m?._id || m) === String(currentUserId))
          : true;
      const payerId = exp.paidBy?._id ? String(exp.paidBy._id) : String(exp.paidBy || '');
      const isPayer = payerId === String(currentUserId);

      // User's individual split share to pay
      const userShare = isIncluded ? exp.amount / participatingCount : 0;

      return {
        ...exp,
        isIncluded,
        isPayer,
        payerId,
        participatingCount,
        userShare,
      };
    })
    .filter((item) => item.isIncluded || item.isPayer);

  // Total amount the user has to pay / their share of trip expenses
  const totalUserExpenseShare = userTransactions.reduce((acc, t) => acc + t.userShare, 0);

  // Direct debts that user has to pay in Settle Up
  const myDebtsToPay = settlements.filter((tx) => tx.from === currentUserId);
  const totalDebtsToPay = myDebtsToPay.reduce((acc, tx) => acc + tx.amount, 0);

  // Net calculation at the bottom: Budget (Green) - User's Expense Share (Red)
  const netRemaining = personalBudget - totalUserExpenseShare;
  const isOverBudget = netRemaining < 0;
  const percentUsed =
    personalBudget > 0
      ? Math.min(100, Math.round((totalUserExpenseShare / personalBudget) * 100))
      : 100;

  return (
    <div className="rounded-3xl p-5 sm:p-6 mb-6 bg-white border border-black/[0.05]">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#f1f4f1]">
        <div>
          <h2
            className="text-base sm:text-lg font-semibold flex items-center gap-2"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-charcoal)' }}
          >
            <span>👤</span>
            <span>Your Personal Transactions & Budget</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Breakdown of your personal share of expenses deducted from your trip budget
          </p>
        </div>

        {/* Edit Budget Button */}
        {!isEditingBudget && (
          <button
            type="button"
            onClick={() => {
              setBudgetInput(String(personalBudget));
              setIsEditingBudget(true);
            }}
            className="min-h-[44px] text-xs font-semibold px-3.5 py-2 rounded-xl border border-gray-200 text-[#4a6454] hover:bg-[#f7faf6] transition-all cursor-pointer self-start sm:self-auto inline-flex items-center gap-1.5"
          >
            <span>✏️</span>
            <span>Set Budget</span>
          </button>
        )}
      </div>

      {/* Edit Budget Form */}
      {isEditingBudget && (
        <form onSubmit={handleSaveBudget} className="mb-4 p-3.5 rounded-2xl bg-[#f7faf6] flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 w-full">
            <label className="text-[0.6875rem] font-medium text-gray-600 block mb-1">
              Personal trip budget
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="e.g. 5000"
              required
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-sm font-mono outline-none focus:border-[#4a6454]"
            />
          </div>
          <div className="flex items-center gap-2 mt-1 sm:mt-5 self-end sm:self-auto">
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#4a6454] hover:bg-[#324c3d] transition-all cursor-pointer inline-flex items-center justify-center"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditingBudget(false)}
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200 transition-all cursor-pointer inline-flex items-center justify-center"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* 1. THE BUDGET IN GREEN */}
      <div
        className="rounded-2xl p-4 mb-4 flex items-center justify-between flex-wrap gap-3"
        style={{
          backgroundColor: '#edf6ef',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#ccead5] flex items-center justify-center text-lg shrink-0">
            🎯
          </div>
          <div>
            <span className="text-xs font-semibold text-[#183124] block">
              Trip budget
            </span>
            <p className="text-xs text-[#324c3d]">
              Target spending allowance for your trip
            </p>
          </div>
        </div>
        <div className="text-right">
          <span
            className="text-xl sm:text-2xl font-bold font-mono tracking-tight"
            style={{ color: '#183124' }}
          >
            +{formatMoney(personalBudget, currency)}
          </span>
          <span className="block text-[0.6875rem] font-semibold text-[#4a6454]">
            (Starting budget)
          </span>
        </div>
      </div>

      {/* 2. THE TRANSACTIONS YOU HAVE TO PAY IN RED */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-medium text-gray-700">
            Your expenses & obligations ({userTransactions.length})
          </span>
          {onViewLedger && expenses.length > userTransactions.length && (
            <button
              type="button"
              onClick={onViewLedger}
              className="text-xs text-[#4a6454] hover:underline cursor-pointer font-medium"
            >
              View all {expenses.length} group expenses →
            </button>
          )}
        </div>

        {userTransactions.length === 0 ? (
          <div className="py-6 text-center rounded-2xl bg-[#f7faf6] border border-dashed border-gray-200">
            <p className="text-xl mb-1">🏖️</p>
            <p className="text-xs font-medium text-gray-600">
              No transactions recorded for you yet
            </p>
            <p className="text-[0.6875rem] text-gray-400 mt-0.5">
              When expenses are added where you participate, your share will show here.
            </p>
            {onAddExpense && (
              <button
                type="button"
                onClick={onAddExpense}
                className="mt-3 text-xs font-medium px-3.5 py-1.5 rounded-xl bg-[#4a6454] text-white hover:bg-[#3d5446] transition-all cursor-pointer"
              >
                + Log an Expense
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 rounded-2xl overflow-hidden bg-[#fafbfa]">
            {userTransactions.map((tx) => {
              const date = new Date(tx.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={tx._id}
                  className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-white transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-sm shrink-0">
                      {getAvatarEmoji(tx.paidBy?.avatarId)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1a1e1c] truncate">
                        {tx.description}
                      </p>
                      <p className="text-[0.6875rem] text-gray-500 truncate">
                        {tx.isPayer ? (
                          <span className="text-[#4a6454] font-medium">You paid total {formatMoney(tx.amount, currency)}</span>
                        ) : (
                          <span>Paid by <span className="font-medium text-gray-700">{tx.paidBy?.username || memberMap.get(tx.payerId)?.username || 'Member'}</span></span>
                        )}
                        {' • '}Your share (1 of {tx.participatingCount}) • {date}
                      </p>
                    </div>
                  </div>

                  {/* Red deduction amount */}
                  <div className="text-right shrink-0">
                    <span
                      className="text-sm sm:text-base font-bold font-mono text-red-600 block"
                      style={{ color: '#ba1a1a' }}
                    >
                      -{formatMoney(tx.userShare, currency)}
                    </span>
                    <span className="text-[0.625rem] text-red-500 font-medium">
                      you pay
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2b. SETTLE UP DEBTS YOU HAVE TO PAY (IF ANY) */}
      {myDebtsToPay.length > 0 && (
        <div className="mb-4 p-3.5 rounded-2xl bg-[#fff5f4] border border-[#ffdad6]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#ba1a1a]">
              ⚠️ Outstanding Debts You Must Pay (Settle Up):
            </span>
            {onViewAllSettlements && (
              <button
                type="button"
                onClick={onViewAllSettlements}
                className="text-xs font-semibold text-[#ba1a1a] hover:underline cursor-pointer"
              >
                View Settle Up →
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {myDebtsToPay.map((debt, i) => {
              const creditor = memberMap.get(debt.to);
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 flex items-center gap-1.5">
                    <span>{getAvatarEmoji(creditor?.avatarId)}</span>
                    <span>Pay to <span className="font-semibold">{creditor?.username || 'Member'}</span></span>
                  </span>
                  <span className="font-bold font-mono text-[#ba1a1a]">
                    -{formatMoney(debt.amount, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. NET AT THE BOTTOM */}
      <div
        className="rounded-2xl p-4 sm:p-5 mt-4"
        style={{
          backgroundColor: isOverBudget ? '#fff5f4' : '#f4f7f4',
        }}
      >
        <div className="flex flex-col gap-2.5">
          {/* Subtotal calculation rows */}
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Starting budget:</span>
            <span className="font-mono font-semibold text-[#183124]">
              +{formatMoney(personalBudget, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Total to pay (expenses):</span>
            <span className="font-mono font-semibold text-[#ba1a1a]">
              -{formatMoney(totalUserExpenseShare, currency)}
            </span>
          </div>

          {/* Divider line */}
          <div className="h-px bg-gray-100 my-1" />

          {/* NET AT BOTTOM */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className="text-xs sm:text-sm font-semibold text-gray-700 block">
                Net remaining budget
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: isOverBudget ? '#ba1a1a' : '#4a6454' }}
              >
                {isOverBudget
                  ? `⚠️ Over budget by ${formatMoney(Math.abs(netRemaining), currency)}`
                  : `✨ ${percentUsed}% of personal budget used`}
              </span>
            </div>

            <div className="text-right">
              <span
                className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight block"
                style={{ color: isOverBudget ? '#ba1a1a' : '#183124' }}
              >
                {formatMoney(netRemaining, currency)}
              </span>
              <span
                className="inline-block text-[0.6875rem] font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: isOverBudget ? '#ffdad6' : '#ccead5',
                  color: isOverBudget ? '#ba1a1a' : '#183124',
                }}
              >
                {isOverBudget ? 'Budget Exceeded' : 'Under Budget'}
              </span>
            </div>
          </div>

          {/* Visual Budget Meter */}
          {personalBudget > 0 && (
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${percentUsed}%`,
                  backgroundColor: isOverBudget ? '#ba1a1a' : percentUsed > 80 ? '#e69500' : '#4a6454',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
