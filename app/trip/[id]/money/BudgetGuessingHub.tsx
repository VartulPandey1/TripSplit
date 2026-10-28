'use client';

import { useState, useEffect } from 'react';
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
  personalDailyBurnRate?: number;
  personalSpendDays?: number;
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
  personalDailyBurnRate = 0,
  personalSpendDays = 0,
  onUpdatePersonalBudget,
  onBudgetUpdated,
  showAddModal = false,
  onCloseAddModal,
}: BudgetGuessingHubProps) {
  const [budget, setBudget] = useState<SerializedBudget | null>(initialBudget);
  const [isDrawerOpen, setIsDrawerOpen] = useState(showAddModal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Add / Edit Category Modal state
  const [editingItem, setEditingItem] = useState<SerializedBudgetItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formCategory, setFormCategory] = useState<SerializedBudgetItem['category']>('Stay');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const items = budget?.items || [];
  const totalBudget = budget?.totalEstimated || 0;
  const hasBudgetTarget = items.length > 0 || totalBudget > 0;
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

  useEffect(() => {
    if (showAddModal) {
      openAddModal();
      onCloseAddModal?.();
    }
  }, [showAddModal]);

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

  return (
    <div className="w-full flex flex-col space-y-3 sm:space-y-4">
      {!hasBudgetTarget ? (
        /* Zero-State: When no budget target is set */
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-center shadow-xs border border-gray-100 my-2">
          <span className="text-4xl mb-3 block select-none">🎯</span>
          <h3
            className="text-base sm:text-lg font-bold text-[#181c1a] mb-1.5"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            No budget targets set yet
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mb-6 max-w-sm mx-auto leading-relaxed">
            Add shared cost estimates for accommodation, transport, food, and activities to plan ahead together.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="bg-[#4a6454] hover:bg-[#385041] text-white text-xs sm:text-sm font-semibold rounded-2xl px-5 py-3 shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <span className="font-bold text-base leading-none">+</span>
            <span>Add First Budget Target</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-150">
          {/* 1. Sleek Budget Summary Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-3">
            {/* Top row: Total pool on left, Add Target button on right */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span
                  className="text-2xl sm:text-3xl font-bold font-mono text-[#181c1a] tracking-tight leading-none"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {formatMoney(totalBudget, currency)}
                </span>
                <span className="text-xs font-medium text-gray-500 mt-1 truncate">
                  {formatMoney(perMemberBudget, currency)} / traveler ({memberCount})
                </span>
              </div>

              <button
                type="button"
                onClick={openAddModal}
                className="px-3.5 py-2 rounded-xl bg-[#4a6454] hover:bg-[#385041] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shrink-0"
              >
                <span className="font-bold text-sm leading-none">+</span>
                <span>Add Target</span>
              </button>
            </div>

            {/* Spending Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="w-full h-2 rounded-full bg-[#ecefeb] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, spentPercent)}%`,
                    backgroundColor: spentPercent > 100 ? '#ba1a1a' : '#4a6454',
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
                <span>
                  Spent: <strong className="text-gray-800 font-mono">{formatMoney(totalActualSpend, currency)}</strong> ({spentPercent}%)
                </span>
                <span>
                  {spentPercent > 100 ? (
                    <span className="text-[#ba1a1a] font-semibold">
                      Over by <strong className="font-mono">{formatMoney(totalActualSpend - totalBudget, currency)}</strong>
                    </span>
                  ) : (
                    <span>
                      Remaining: <strong className="text-[#4a6454] font-mono">{formatMoney(remainingBudget, currency)}</strong>
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Category Targets List (Clean & Direct) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Planned Categories ({items.length})
              </span>
              <span className="text-[11px] text-gray-400 hidden sm:inline">
                Tap row to edit
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 shadow-xs overflow-hidden">
              {items.map((item) => {
                const meta = CATEGORY_META[item.category] || CATEGORY_META['Misc'];
                const amount = item.agreedCost != null ? item.agreedCost : item.consensusCost || 0;
                const note = item.guesses?.[0]?.notes;

                return (
                  <div
                    key={item._id}
                    onClick={() => openEditModal(item)}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 active:bg-gray-100/70 transition-colors cursor-pointer group"
                  >
                    {/* Left: Icon + Title & Note */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-[#f7faf6] border border-black/[0.04] flex items-center justify-center text-lg shrink-0">
                        {meta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {note || meta.defaultSubtitle}
                        </p>
                      </div>
                    </div>

                    {/* Right: Amount + Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold font-mono text-gray-900">
                        {formatMoney(amount, currency)}
                      </span>

                      <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-xs px-0.5">
                        ›
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-xs"
                        title="Delete target"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL: ADD / EDIT CATEGORY TARGET */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in"
          onClick={() => setIsFormOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-base font-bold text-gray-900">
                {editingItem ? 'Edit Category Target' : 'Add Category Target'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* Category Selector */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  Category
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
                          const isAutoFilled =
                            !formTitle.trim() ||
                            CATEGORIES.some((c) => c.toLowerCase() === formTitle.trim().toLowerCase()) ||
                            Object.values(CATEGORY_META).some(
                              (m) => m.label.toLowerCase() === formTitle.trim().toLowerCase()
                            );
                          if (isAutoFilled) {
                            setFormTitle(meta.label);
                          }
                        }}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#4a6454] bg-[#eef4f0] text-[#183124] font-bold ring-1 ring-[#4a6454] shadow-2xs'
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

              {/* Title / Label */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Target Label
                </label>
                <input
                  type="text"
                  placeholder={CATEGORY_META[formCategory].label}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-xl border border-gray-200 outline-none focus:border-[#4a6454]"
                />
              </div>

              {/* Estimated Amount */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Estimated Target ({currSymbol}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-gray-500 font-bold font-mono">
                    {currSymbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="10000"
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
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Notes / Context <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Homestays & camps in Kaza"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-[#4a6454]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-2">
                {editingItem ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingItem) {
                        handleDeleteItem(editingItem);
                        setIsFormOpen(false);
                      }
                    }}
                    className="px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>🗑️</span>
                    <span>Delete Target</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-[#4a6454] rounded-xl hover:bg-[#385041] disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {loading ? 'Saving…' : editingItem ? 'Update Target' : 'Add Target'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
