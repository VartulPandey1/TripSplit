'use client';

import { useState } from 'react';
import { formatMoney, getCurrencySymbol } from '@/lib/utils/currency';

export interface SerializedGuess {
  userId: {
    _id: string;
    username: string;
    avatarId?: string;
  };
  amount: number;
  notes?: string;
  updatedAt?: string;
}

export interface SerializedBudgetItem {
  _id: string;
  title: string;
  category: 'Stay' | 'Transport' | 'Food & Dining' | 'Activities' | 'Shopping' | 'Misc';
  addedBy: string;
  guesses: SerializedGuess[];
  consensusCost: number;
  agreedCost: number | null;
  isLocked: boolean;
  createdAt?: string;
}

export interface SerializedBudget {
  _id: string;
  tripId: string;
  items: SerializedBudgetItem[];
  totalEstimated: number;
  acknowledgments: string[];
  updatedAt?: string;
}

interface Member {
  _id: string;
  username: string;
  avatarId?: string;
}

interface BudgetGuessingHubProps {
  tripId: string;
  currentUserId: string;
  isCreator?: boolean;
  members: Member[];
  initialBudget: SerializedBudget | null;
  totalActualSpend: number;
  currency?: string;
  personalBudget?: number;
  myPersonalSpend?: number;
  myActualExpenseShare?: number;
  onUpdatePersonalBudget?: (amount: number) => void;
  onBudgetUpdated?: (budget: SerializedBudget) => void;
  showAddModal?: boolean;
  onCloseAddModal?: () => void;
}

const CATEGORIES: Array<SerializedBudgetItem['category']> = [
  'Stay',
  'Food & Dining',
  'Transport',
  'Activities',
  'Shopping',
  'Misc',
];

const CATEGORY_META: Record<
  SerializedBudgetItem['category'],
  { label: string; icon: string; defaultSubtitle: string; bg: string; text: string }
> = {
  Stay: {
    label: 'Accommodation',
    icon: '🏨',
    defaultSubtitle: 'Homestays & camps',
    bg: '#f1f4f1',
    text: '#4a6454',
  },
  'Food & Dining': {
    label: 'Food & Dining',
    icon: '🍽️',
    defaultSubtitle: 'Cafes & dhabas',
    bg: '#f1f4f1',
    text: '#4a6454',
  },
  Transport: {
    label: 'Transport & Fuel',
    icon: '⛽',
    defaultSubtitle: '4x4 diesel, rentals & toll',
    bg: '#f1f4f1',
    text: '#4a6454',
  },
  Activities: {
    label: 'Activities & Permits',
    icon: '🎟️',
    defaultSubtitle: 'Monasteries & sanctuary entry',
    bg: '#f1f4f1',
    text: '#4a6454',
  },
  Shopping: {
    label: 'Shopping & Gear',
    icon: '🛍️',
    defaultSubtitle: 'Local souvenirs & supplies',
    bg: '#f1f4f1',
    text: '#4a6454',
  },
  Misc: {
    label: 'Miscellaneous & Buffer',
    icon: '📦',
    defaultSubtitle: 'Contingency emergency buffer',
    bg: '#f1f4f1',
    text: '#4a6454',
  },
};

export default function BudgetGuessingHub({
  tripId,
  currentUserId,
  isCreator = false,
  members,
  initialBudget,
  totalActualSpend,
  currency = 'INR',
  personalBudget = 0,
  myPersonalSpend = 0,
  myActualExpenseShare = 0,
  onUpdatePersonalBudget,
  onBudgetUpdated,
  showAddModal = false,
  onCloseAddModal,
}: BudgetGuessingHubProps) {
  const [budget, setBudget] = useState<SerializedBudget | null>(initialBudget);
  const [isDrawerOpen, setIsDrawerOpen] = useState(showAddModal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Personal budget edit state
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [personalInput, setPersonalInput] = useState(personalBudget > 0 ? String(personalBudget) : '');

  // Add / Edit Category Modal state
  const [editingItem, setEditingItem] = useState<SerializedBudgetItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formCategory, setFormCategory] = useState<SerializedBudgetItem['category']>('Stay');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const items = budget?.items || [];
  const totalBudget = budget?.totalEstimated || 0;
  const remainingBudget = Math.max(0, totalBudget - totalActualSpend);
  const spentPercent = totalBudget > 0 ? Math.min(100, Math.round((totalActualSpend / totalBudget) * 100)) : 0;
  const availablePercent = Math.max(0, 100 - spentPercent);

  const memberCount = Math.max(1, members.length);
  const perMemberBudget = Math.round(totalBudget / memberCount);

  // Personal budget is reduced ONLY when paid by personal
  const personalSpent = myPersonalSpend !== undefined ? myPersonalSpend : myActualExpenseShare;
  const myPersonalRemaining = personalBudget - personalSpent;
  const myUtilizedPercent =
    personalBudget > 0 ? Math.min(100, Math.round((personalSpent / personalBudget) * 100)) : 0;
  const isOnTrack = personalBudget > 0 ? myPersonalRemaining >= 0 : true;

  const currSymbol = getCurrencySymbol(currency);

  function openAddModal() {
    setEditingItem(null);
    setFormCategory('Stay');
    setFormTitle('');
    setFormAmount('');
    setFormNotes('');
    setError('');
    setIsFormOpen(true);
  }

  function openEditModal(item: SerializedBudgetItem) {
    if (item.isLocked && !isCreator) {
      alert('This agreed budget cost is locked by the trip creator and cannot be edited.');
      return;
    }
    setEditingItem(item);
    setFormCategory(item.category);
    setFormTitle(item.title);
    const amountVal = item.agreedCost != null ? item.agreedCost : item.consensusCost || 0;
    setFormAmount(amountVal > 0 ? String(amountVal) : '');
    setFormNotes(item.guesses?.[0]?.notes || '');
    setError('');
    setIsFormOpen(true);
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!formAmount || isNaN(Number(formAmount)) || Number(formAmount) <= 0) {
      setError('Please provide a valid estimated cost greater than 0.');
      return;
    }

    setLoading(true);
    setError('');

    const resolvedTitle = formTitle.trim() || CATEGORY_META[formCategory].label;

    try {
      if (editingItem) {
        // UPDATE existing category budget item
        const res = await fetch('/api/budget', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId,
            itemId: editingItem._id,
            title: resolvedTitle,
            category: formCategory,
            amount: parseFloat(formAmount),
            notes: formNotes.trim(),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update category budget');
        }

        const updated: SerializedBudget = await res.json();
        setBudget(updated);
        onBudgetUpdated?.(updated);
      } else {
        // CREATE new category budget item
        const res = await fetch('/api/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId,
            title: resolvedTitle,
            category: formCategory,
            initialGuess: parseFloat(formAmount),
            notes: formNotes.trim(),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to add category budget');
        }

        const updated: SerializedBudget = await res.json();
        setBudget(updated);
        onBudgetUpdated?.(updated);
      }

      setIsFormOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      setError(err.message || 'Error saving budget item');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleLock(item: SerializedBudgetItem) {
    if (!isCreator) return;
    setLoading(true);
    try {
      const nextLocked = !item.isLocked;
      const amount = item.agreedCost != null ? item.agreedCost : item.consensusCost;
      const res = await fetch('/api/budget/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          itemId: item._id,
          isLocked: nextLocked,
          agreedCost: amount,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update lock status');
      }

      const updated: SerializedBudget = await res.json();
      setBudget(updated);
      onBudgetUpdated?.(updated);
    } catch (err: any) {
      alert(err.message || 'Error updating budget lock');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteItem(item: SerializedBudgetItem) {
    if (item.isLocked && !isCreator) {
      alert('This agreed budget cost is locked by the trip creator and cannot be removed.');
      return;
    }
    if (!confirm('Are you sure you want to remove this category budget?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/budget?tripId=${tripId}&itemId=${item._id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete category');
      }
      const updated: SerializedBudget = await res.json();
      setBudget(updated);
      onBudgetUpdated?.(updated);
    } catch (err: any) {
      alert(err.message || 'Error deleting category');
    } finally {
      setLoading(false);
    }
  }

  function handleSavePersonalBudget(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(personalInput);
    if (!isNaN(val) && val >= 0) {
      onUpdatePersonalBudget?.(val);
      setIsEditingPersonal(false);
    }
  }

  return (
    <div className="w-full flex flex-col space-y-4 sm:space-y-6">
      {/* 1. SHARED TRIP BUDGET CARD (Click to open Category Drawer) */}
      <section
        id="trip-budget-card"
        onClick={() => setIsDrawerOpen(true)}
        className="w-full bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs border border-[#e4e5e0] flex flex-col space-y-3.5 cursor-pointer transition-all duration-200 hover:border-[#7e9a88] hover:shadow-xs active:scale-[0.99] group"
      >
        {/* Header Block */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ecefeb] flex items-center justify-center text-[#4a6454] group-hover:bg-[#ccead5] transition-colors">
              <span className="text-base">👥</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <h2
                  className="text-sm sm:text-base font-semibold text-[#181c1a]"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  Trip budget
                </h2>
                <span className="text-[10px] text-[#4a6454] font-medium group-hover:translate-y-[-1px] transition-transform">
                  ▲
                </span>
              </div>
              <span className="text-[11px] text-[#424843]">
                Shared · {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#ecefeb] text-[#424843]">
              Pool
            </span>
          </div>
        </div>

        {/* Group Budget Allocation */}
        <div className="flex flex-col space-y-0.5">
          <div className="flex items-baseline justify-between">
            <span
              className="text-lg sm:text-2xl font-bold font-mono text-[#181c1a]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {formatMoney(totalBudget, currency)}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#424843]">
              Total Pool
            </span>
          </div>
          <p className="text-[11px] text-[#424843] flex items-center gap-1">
            <span className="text-[#4a6454] font-bold">✓</span>
            <span>{formatMoney(perMemberBudget, currency)} allocated per member</span>
          </p>
        </div>

        {/* Utilization Progress Bar */}
        <div className="w-full space-y-1">
          <div className="h-1.5 w-full bg-[#ecefeb] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-[#b4898b] rounded-full transition-all duration-500"
              style={{ width: `${spentPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-semibold text-[#424843]">
            <span>{spentPercent}% spent</span>
            <span>{availablePercent}% available</span>
          </div>
        </div>

        {/* Metrics Row: Spent vs Remaining */}
        <div className="bg-[#f7faf6] rounded-xl p-2.5 sm:p-3 grid grid-cols-2 gap-2 border border-[#f1f4f1]">
          <div className="flex flex-col">
            <span className="text-[10px] sm:text-[11px] font-medium text-[#424843]">Spent</span>
            <span className="text-sm sm:text-base font-bold font-mono text-[#7a5557] mt-0.5">
              {formatMoney(totalActualSpend, currency)}
            </span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] sm:text-[11px] font-medium text-[#424843]">Remaining</span>
            <span className="text-sm sm:text-base font-bold font-mono text-[#4a6454] mt-0.5">
              {formatMoney(remainingBudget, currency)}
            </span>
          </div>
        </div>

        {/* Tap Affordance Hint */}
        <div className="pt-0.5 flex items-center justify-between text-[11px] text-[#7e9a88] font-medium">
          <span>{items.length} category {items.length === 1 ? 'target' : 'targets'} planned</span>
          <span className="group-hover:underline">View & Edit Cost Breakdown →</span>
        </div>
      </section>

      {/* 2. PRIVATE SPENDS CARD */}
      <section className="w-full bg-[#f1f4f1]/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs border border-[#e4e5e0] flex flex-col space-y-3.5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#4a6454] shadow-2xs">
              <span className="text-base">💳</span>
            </div>
            <div className="flex flex-col">
              <h2
                className="text-sm sm:text-base font-semibold text-[#181c1a]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Private Spends & Budget
              </h2>
              <span className="text-[11px] text-[#424843]">Private to you • Not shared with the group</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditingPersonal(!isEditingPersonal)}
            aria-label="Edit private spending limit"
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#424843] hover:text-[#181c1a] hover:bg-white transition-colors cursor-pointer"
            title="Edit target limit"
          >
            <span className="text-sm">⚙️</span>
          </button>
        </div>

        {/* Inline Edit Form for Personal Target */}
        {isEditingPersonal && (
          <form
            onSubmit={handleSavePersonalBudget}
            className="p-3 bg-white rounded-xl border border-gray-200 flex flex-col sm:flex-row gap-2 items-center animate-in fade-in"
          >
            <div className="relative flex-1 w-full">
              <span className="absolute left-3 top-2 text-xs text-gray-500 font-bold">{currSymbol}</span>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Enter private spending limit e.g. 15000"
                value={personalInput}
                onChange={(e) => setPersonalInput(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-[#4a6454]"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#4a6454] rounded-lg hover:bg-[#3d5345] cursor-pointer"
              >
                Save
              </button>
              {personalBudget > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdatePersonalBudget?.(0);
                    setPersonalInput('');
                    setIsEditingPersonal(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditingPersonal(false)}
                className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Personal Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 bg-white rounded-xl p-2.5 text-center border border-[#e4e5e0]">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-medium text-[#424843]">My limit</span>
            <span className="text-xs sm:text-sm font-bold font-mono text-[#181c1a] mt-0.5">
              {personalBudget > 0 ? formatMoney(personalBudget, currency) : 'Not set'}
            </span>
          </div>
          <div className="flex flex-col items-center border-x border-[#f1f4f1]">
            <span className="text-[10px] font-medium text-[#424843]">Spent</span>
            <span className="text-xs sm:text-sm font-bold font-mono text-[#7a5557] mt-0.5">
              {formatMoney(personalSpent, currency)}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-medium text-[#424843]">Remaining</span>
            <span
              className={`text-xs sm:text-sm font-bold font-mono mt-0.5 ${
                isOnTrack ? 'text-[#4a6454]' : 'text-red-600'
              }`}
            >
              {personalBudget > 0 ? formatMoney(myPersonalRemaining, currency) : '—'}
            </span>
          </div>
        </div>

        {/* Mini Progress Tracker */}
        <div className="space-y-0.5">
          <div className="h-1.5 w-full bg-[#ecefeb] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOnTrack ? 'bg-[#4a6454]' : 'bg-red-500'
              }`}
              style={{ width: `${myUtilizedPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-[#424843] text-right font-medium">
            {personalBudget > 0
              ? `${myUtilizedPercent}% utilized · ${isOnTrack ? 'On track' : 'Over limit'}`
              : 'Tap ⚙️ above to set your personal limit'}
          </p>
        </div>
      </section>

      {/* 3. SLIDING DRAWER / BOTTOM SHEET: ESTIMATED TRIP COST (Screen 695d) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-3xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 border border-[#e4e5e0]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

            {/* Sheet Header */}
            <div className="p-3.5 sm:p-5 pb-2.5 flex items-center justify-between border-b border-[#f1f4f1] shrink-0">
              <div className="flex flex-col">
                <h3
                  className="text-base sm:text-lg font-bold text-[#181c1a]"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  Estimated trip cost
                </h3>
                <span className="text-[11px] text-[#424843] font-medium">
                  {formatMoney(totalBudget, currency)} allocated across {items.length}{' '}
                  {items.length === 1 ? 'category' : 'categories'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onCloseAddModal?.();
                }}
                className="w-7 h-7 rounded-full bg-[#ecefeb] flex items-center justify-center text-xs text-[#424843] hover:text-[#181c1a] hover:bg-[#e0e3e0] transition-colors cursor-pointer"
                aria-label="Close breakdown"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Category List */}
            <div className="p-3.5 sm:p-5 overflow-y-auto space-y-2 flex-1">
              {items.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center justify-center space-y-1.5 text-[#424843]">
                  <span className="text-2xl">🎯</span>
                  <p className="text-xs sm:text-sm font-semibold text-[#181c1a]">No budget estimates yet</p>
                  <p className="text-[11px] max-w-xs text-gray-500">
                    Start by adding anticipated categories like Accommodation, Food, or Transport.
                  </p>
                </div>
              ) : (
                items.map((item) => {
                  const meta = CATEGORY_META[item.category] || CATEGORY_META['Misc'];
                  const amount = item.agreedCost != null ? item.agreedCost : item.consensusCost || 0;
                  const subtitle = item.guesses?.[0]?.notes || meta.defaultSubtitle;

                  return (
                    <div
                      key={item._id}
                      className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-[#f7faf6] hover:bg-[#f1f4f1] border border-[#e4e5e0] transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-sm shadow-2xs shrink-0">
                          {meta.icon}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs sm:text-sm font-semibold text-[#181c1a] truncate">
                            {item.title}
                          </span>
                          <span className="text-[10px] sm:text-[11px] text-[#424843] truncate">
                            {subtitle}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Lock / Unlock Toggle for Creator or Locked Badge for Member */}
                        {isCreator ? (
                          <button
                            type="button"
                            onClick={() => handleToggleLock(item)}
                            disabled={loading}
                            className={`px-2 py-0.5 text-[10px] rounded-lg font-medium border flex items-center gap-1 transition-all cursor-pointer ${
                              item.isLocked
                                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                            }`}
                            title={
                              item.isLocked
                                ? 'Agreed cost locked by you (Click to unlock)'
                                : 'Click to lock in agreed cost as trip creator'
                            }
                          >
                            <span>{item.isLocked ? '🔒 Agreed' : '🔓 Estimate'}</span>
                          </button>
                        ) : item.isLocked ? (
                          <span
                            className="px-2 py-0.5 text-[10px] rounded-lg font-medium bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1"
                            title="Agreed cost locked by trip creator"
                          >
                            🔒 Agreed
                          </span>
                        ) : null}

                        <span className="text-xs sm:text-sm font-bold font-mono text-[#181c1a]">
                          {formatMoney(amount, currency)}
                        </span>

                        {(!item.isLocked || isCreator) && (
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-gray-400 hover:text-[#4a6454] hover:bg-white transition-colors cursor-pointer"
                            title="Edit category amount"
                          >
                            ✏️
                          </button>
                        )}

                        {(!item.isLocked || isCreator) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete category"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Sheet Action Bar (Side by Side Buttons) */}
            <div className="p-3 sm:p-4 border-t border-[#f1f4f1] bg-[#f7faf6] flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={openAddModal}
                className="flex-1 py-2.5 px-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-[#181c1a] flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
              >
                <span>+</span>
                <span>Add Category</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onCloseAddModal?.();
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
              >
                <span>✓</span>
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL: ADD / EDIT CATEGORY BUDGET FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl border border-gray-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
              <h4
                className="text-sm sm:text-base font-bold text-[#181c1a]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {editingItem ? 'Edit Category Budget' : 'Add Category Budget'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingItem(null);
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="flex flex-col space-y-4">
              {/* Category Selector */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  CATEGORY
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const isSelected = formCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setFormCategory(cat);
                          if (!formTitle.trim()) {
                            setFormTitle(meta.label);
                          }
                        }}
                        className={`p-2 rounded-xl border text-left flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#4a6454] bg-[#ccead5]/30 text-[#183124] font-semibold ring-1 ring-[#4a6454]'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="text-lg">{meta.icon}</span>
                        <span className="text-[10px] text-center leading-tight truncate w-full">
                          {cat}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title / Description */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  ITEM TITLE / LABEL (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder={CATEGORY_META[formCategory].label}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-[#4a6454]"
                />
              </div>

              {/* Target Amount */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  ESTIMATED TARGET COST ({currSymbol}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-gray-500 font-bold">
                    {currSymbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="e.g. 12000"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    autoFocus
                    className="w-full pl-8 pr-3.5 py-2.5 text-sm sm:text-base font-mono rounded-xl border border-gray-200 outline-none focus:border-[#4a6454]"
                  />
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  NOTES / CONTEXT (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Homestays & camps in Kaza"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-gray-200 outline-none focus:border-[#4a6454]"
                />
              </div>

              {error && (
                <p className="text-xs p-2.5 rounded-xl bg-red-50 text-red-700 font-medium">
                  {error}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#4a6454] rounded-xl hover:bg-[#3d5345] disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {loading ? 'Saving…' : editingItem ? 'Update Target' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
