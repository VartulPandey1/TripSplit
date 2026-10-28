'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatMoney, getCurrencySymbol } from '@/lib/utils/currency';
import { getAvatarEmoji } from '@/lib/constants/avatars';
import { calculateSettlements, calculatePairwiseSettlements } from '@/lib/utils/settleUp';
import { detectExpenseCategory } from '@/lib/utils/categorizeExpense';

export interface ExpenseItem {
  _id: string;
  amount: number;
  description: string;
  category?: string;
  isPersonal?: boolean;
  splitType?: string;
  splitDetails?: Array<{ userId: string; amountOwed: number }>;
  receiptImage?: string;
  paidBy: {
    _id: string;
    username: string;
    avatarId?: string;
  };
  includedMembers: string[];
  timestamp: string;
}

export interface Member {
  _id: string;
  username: string;
  avatarId?: string;
  email?: string;
}

interface MoneyClientProps {
  tripId: string;
  currentUserId: string;
  isCreator?: boolean;
  members: Member[];
  initialExpenses: ExpenseItem[];
  initialCurrency?: string;
  initialPersonalBudget?: number | null;
  initialView?: 'hub' | 'transactions' | 'settle' | 'private';
  initialMode?: 'mine' | 'group';
}

const CATEGORY_ICON_MAP: Record<string, string> = {
  'Food & Dining': '🍽️',
  'Food & Drinks': '🍽️',
  'Fuel & Cab': '⛽',
  'Hotel / Camp': '🏨',
  Activities: '🎟️',
  Groceries: '🛒',
  'Coffee & Snacks': '☕',
  Stay: '🏨',
  'Stay & Hotel': '🏨',
  Transport: '⛽',
  'Transport / Fuel': '⛽',
  Shopping: '🛍️',
  Settlement: '🤝',
  Misc: '📦',
  'General / Misc': '📦',
  Others: '📦',
  Other: '📦',
  Solo: '🛍️',
};

const EXPENSE_CATEGORIES = [
  { id: 'Food & Dining', label: 'Food & Dining', icon: '🍽️' },
  { id: 'Transport', label: 'Transport', icon: '⛽' },
  { id: 'Stay', label: 'Stay & Hotel', icon: '🏨' },
  { id: 'Activities', label: 'Activities', icon: '🎟️' },
  { id: 'Shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'Misc', label: 'Others', icon: '📦' },
] as const;

export default function MoneyClient({
  tripId,
  currentUserId,
  isCreator = false,
  members,
  initialExpenses,
  initialCurrency = 'INR',
  initialPersonalBudget = null,
  initialView = 'hub',
  initialMode = 'mine',
}: MoneyClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation views: 'hub' | 'transactions' | 'settle' | 'private'
  const [view, setView] = useState<'hub' | 'transactions' | 'settle' | 'private'>(initialView);
  const [ledgerMode, setLedgerMode] = useState<'mine' | 'group'>(initialMode);
  const [isSimplified, setIsSimplified] = useState(true);

  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);

  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);
  const [currency] = useState(initialCurrency || 'INR');
  const currSymbol = getCurrencySymbol(currency);

  // Search & filter for full transactions view
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<ExpenseItem | null>(null);
  const [activeReceiptModalUrl, setActiveReceiptModalUrl] = useState<string | null>(null);
  const [showPastSettlements, setShowPastSettlements] = useState(false);

  // Settlement loading states
  const [settlingInProgress, setSettlingInProgress] = useState(false);
  const [settleSuccessMsg, setSettleSuccessMsg] = useState('');

  // Personal budget limit state
  const storageKey = `tripsplit_user_budget_${tripId}_${currentUserId}`;
  const [personalBudget, setPersonalBudget] = useState<number>(() => {
    if (typeof initialPersonalBudget === 'number' && initialPersonalBudget >= 0) return initialPersonalBudget;
    return 0;
  });
  const [isEditingPersonalBudget, setIsEditingPersonalBudget] = useState(false);
  const [personalBudgetInput, setPersonalBudgetInput] = useState('');

  // Form states for Add / Edit Expense
  const [expenseType, setExpenseType] = useState<'shared' | 'personal'>('shared');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Food & Dining');
  const [hasUserSelectedCategory, setHasUserSelectedCategory] = useState(false);
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [includedMembers, setIncludedMembers] = useState<string[]>(() => members.map((m) => m._id));
  const [exactSplits, setExactSplits] = useState<Record<string, string>>({});
  const [percentageSplits, setPercentageSplits] = useState<Record<string, string>>({});
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const memberMap = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((m) => map.set(m._id, m));
    return map;
  }, [members]);

  // Sync with URL parameters & browser back button
  useEffect(() => {
    const urlView = searchParams?.get('view');
    const urlTab = searchParams?.get('tab');
    const urlMode = searchParams?.get('mode');

    if (urlView === 'settle' || urlTab === 'settle') setView('settle');
    else if (urlView === 'transactions' || urlTab === 'expenses') setView('transactions');
    else if (urlView === 'private') setView('private');
    else if (!urlView && !urlTab) setView('hub');

    if (urlMode === 'group') setLedgerMode('group');
    else if (urlMode === 'mine') setLedgerMode('mine');

    if (searchParams?.get('add') === 'true' || searchParams?.get('openAdd') === 'true') {
      setShowAddModal(true);
    }
  }, [searchParams]);

  function navigateTo(nextView: 'hub' | 'transactions' | 'settle' | 'private', mode?: 'mine' | 'group') {
    setView(nextView);
    if (mode) setLedgerMode(mode);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (nextView === 'hub') {
        url.searchParams.delete('view');
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('view', nextView);
      }
      if (mode) url.searchParams.set('mode', mode);
      window.history.pushState(null, '', url.toString());
    }
  }

  // Handle browser popstate
  useEffect(() => {
    const handlePop = () => {
      const url = new URL(window.location.href);
      const v = url.searchParams.get('view');
      const t = url.searchParams.get('tab');
      if (v === 'settle' || t === 'settle') setView('settle');
      else if (v === 'transactions') setView('transactions');
      else if (v === 'private') setView('private');
      else setView('hub');
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Fetch private budget on mount
  useEffect(() => {
    if (typeof initialPersonalBudget === 'number' && initialPersonalBudget >= 0) {
      setPersonalBudget(initialPersonalBudget);
      return;
    }
    fetch(`/api/budget/personal?tripId=${tripId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.amount === 'number' && data.amount > 0) {
          setPersonalBudget(data.amount);
        }
      })
      .catch(() => {});
  }, [tripId, initialPersonalBudget]);

  async function handleSavePersonalBudget(val: number) {
    setPersonalBudget(val);
    setIsEditingPersonalBudget(false);
    try {
      await fetch('/api/budget/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, amount: val }),
      });
    } catch {}
  }

  // 1. Core Financial Filtering
  const sharedExpenses = useMemo(() => {
    return expenses.filter(
      (e) => !e.isPersonal && e.splitType !== 'personal' && e.category !== 'Settlement'
    );
  }, [expenses]);

  const myPersonalExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const isPers = Boolean(e.isPersonal || e.splitType === 'personal');
      if (!isPers) return false;
      const payerId = e.paidBy?._id ? String(e.paidBy._id) : (e.paidBy ? String(e.paidBy) : '');
      return !payerId || payerId === currentUserId;
    });
  }, [expenses, currentUserId]);

  const settlementRecords = useMemo(() => {
    return expenses.filter((e) => e.category === 'Settlement');
  }, [expenses]);

  const totalTripSpend = useMemo(() => {
    return sharedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [sharedExpenses]);

  const myPersonalSpendTotal = useMemo(() => {
    return myPersonalExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [myPersonalExpenses]);

  // 2. Exact Stake & Balance Calculation for Current User
  const myInvolvedExpenses = useMemo(() => {
    const involved: Array<{
      expense: ExpenseItem;
      userShare: number;
      isPayer: boolean;
      netEffect: number; // positive = get money back, negative = owe money
    }> = [];

    sharedExpenses.forEach((e) => {
      const payerId = e.paidBy?._id ? e.paidBy._id.toString() : e.paidBy?.toString();
      const isPayer = payerId === currentUserId;
      const inc = e.includedMembers && e.includedMembers.length > 0 ? e.includedMembers : members.map((m) => m._id);
      const isIncluded = inc.includes(currentUserId);

      let userOwed = 0;
      if (
        (e.splitType === 'exact' || e.splitType === 'percentage') &&
        e.splitDetails &&
        e.splitDetails.length > 0
      ) {
        const d = e.splitDetails.find((sd) => sd.userId === currentUserId);
        if (d) userOwed = d.amountOwed || 0;
      } else if (isIncluded) {
        userOwed = (e.amount || 0) / Math.max(1, inc.length);
      }

      if (isPayer || isIncluded) {
        const netEffect = (isPayer ? e.amount : 0) - userOwed;
        involved.push({
          expense: e,
          userShare: userOwed,
          isPayer,
          netEffect,
        });
      }
    });

    return involved;
  }, [sharedExpenses, currentUserId, members]);

  // 3. Settlement Calculation: Simplified vs Pairwise Debts
  const memberBalances = useMemo(() => {
    const bal: Record<string, number> = {};
    members.forEach((m) => (bal[m._id] = 0));

    // Regular shared expenses
    sharedExpenses.forEach((e) => {
      const payerId = e.paidBy?._id ? e.paidBy._id.toString() : e.paidBy?.toString();
      if (!payerId) return;

      const inc = e.includedMembers && e.includedMembers.length > 0 ? e.includedMembers : members.map((m) => m._id);

      if ((e.splitType === 'exact' || e.splitType === 'percentage') && e.splitDetails && e.splitDetails.length > 0) {
        bal[payerId] = (bal[payerId] || 0) + (e.amount || 0);
        e.splitDetails.forEach((sd) => {
          bal[sd.userId] = (bal[sd.userId] || 0) - (sd.amountOwed || 0);
        });
      } else {
        const share = (e.amount || 0) / Math.max(1, inc.length);
        bal[payerId] = (bal[payerId] || 0) + (e.amount || 0);
        inc.forEach((uId) => {
          bal[uId] = (bal[uId] || 0) - share;
        });
      }
    });

    // Factored settlements: debtor (payer) paid creditor (recipient)
    settlementRecords.forEach((s) => {
      const payerId = s.paidBy?._id ? String(s.paidBy._id) : (s.paidBy ? String(s.paidBy) : '');
      const rawRecipient: any = (Array.isArray(s.includedMembers) && s.includedMembers.length > 0)
        ? s.includedMembers[0]
        : (s.splitDetails?.[0]?.userId);
      const recipientId = rawRecipient?._id ? String(rawRecipient._id) : (rawRecipient ? String(rawRecipient) : '');

      if (payerId && recipientId) {
        bal[payerId] = (bal[payerId] || 0) + (s.amount || 0);
        bal[recipientId] = (bal[recipientId] || 0) - (s.amount || 0);
      }
    });

    return bal;
  }, [sharedExpenses, settlementRecords, members]);

  const myNetBalance = useMemo(() => {
    return memberBalances[currentUserId] || 0;
  }, [memberBalances, currentUserId]);

  const memberIds = useMemo(() => members.map((m) => m._id), [members]);

  const simplifiedSettlements = useMemo(() => {
    return calculateSettlements(memberBalances);
  }, [memberBalances]);

  const pairwiseSettlements = useMemo(() => {
    const relevant = expenses.filter((e) => !e.isPersonal && e.splitType !== 'personal');
    return calculatePairwiseSettlements(relevant, memberIds);
  }, [expenses, memberIds]);

  const activeSettlements = isSimplified ? simplifiedSettlements : pairwiseSettlements;

  // Single settlement action
  async function handleSettleSingle(tx: { from: string; to: string; amount: number }) {
    if (settlingInProgress) return;
    setSettlingInProgress(true);
    setSettleSuccessMsg('');

    try {
      const fromUser = memberMap.get(tx.from);
      const toUser = memberMap.get(tx.to);

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          amount: tx.amount,
          description: `Settlement: ${fromUser?.username || 'Member'} paid ${toUser?.username || 'Member'}`,
          category: 'Settlement',
          paidBy: tx.from,
          splitType: 'exact',
          includedMembers: [tx.to],
          splitDetails: [{ userId: tx.to, amountOwed: tx.amount }],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to record settlement');
      }

      const newExpense = await res.json();
      setExpenses((prev) => [newExpense, ...prev]);
      setSettleSuccessMsg(`Recorded payment of ${formatMoney(tx.amount, currency)} from ${fromUser?.username || 'Member'} to ${toUser?.username || 'Member'}!`);
      setTimeout(() => setSettleSuccessMsg(''), 4000);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Error recording settlement');
    } finally {
      setSettlingInProgress(false);
    }
  }

  function handlePayUPI(payeeName: string, amountVal: number) {
    const cleanPayee = encodeURIComponent(payeeName || 'TripMember');
    const note = encodeURIComponent(`TripSplit settlement`);
    const upiUrl = `upi://pay?pn=${cleanPayee}&am=${amountVal.toFixed(2)}&cu=INR&tn=${note}`;
    window.location.href = upiUrl;
  }

  function handleWhatsAppRemind(debtorName: string, creditorName: string, amountVal: number) {
    const formatted = formatMoney(amountVal, currency);
    const message = `Hey ${debtorName}! Just a friendly reminder from our trip on TripSplit ✈️\nPending balance to settle with ${creditorName}: ${formatted}.\nLet's settle up whenever convenient!`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  // Settle all action
  async function handleSettleAll() {
    if (settlingInProgress || activeSettlements.length === 0) return;
    if (!confirm(`Record all ${activeSettlements.length} settlement payments totaling ${formatMoney(activeSettlements.reduce((sum, t) => sum + t.amount, 0), currency)}?`)) return;

    setSettlingInProgress(true);
    try {
      const createdExpenses: ExpenseItem[] = [];
      for (const tx of activeSettlements) {
        const fromUser = memberMap.get(tx.from);
        const toUser = memberMap.get(tx.to);

        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId,
            amount: tx.amount,
            description: `Settlement: ${fromUser?.username || 'Member'} paid ${toUser?.username || 'Member'}`,
            category: 'Settlement',
            paidBy: tx.from,
            splitType: 'exact',
            includedMembers: [tx.to],
            splitDetails: [{ userId: tx.to, amountOwed: tx.amount }],
          }),
        });

        if (res.ok) {
          const newExp = await res.json();
          createdExpenses.push(newExp);
        }
      }
      if (createdExpenses.length > 0) {
        setExpenses((prev) => [...createdExpenses, ...prev]);
      }
      setSettleSuccessMsg('All debts have been successfully settled!');
      setTimeout(() => setSettleSuccessMsg(''), 4000);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to record all settlements');
    } finally {
      setSettlingInProgress(false);
    }
  }

  // Delete expense
  async function handleDeleteExpense(id: string) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete expense');
      }
      setExpenses((prev) => prev.filter((e) => e._id !== id));
      setSelectedExpenseDetail(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Error deleting expense');
    }
  }

  // Image upload
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert('Receipt photo must be smaller than 4MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Open add modal preset
  function openAddModal(type: 'shared' | 'personal' = 'shared') {
    setExpenseType(type);
    setAmount('');
    setDescription('');
    setCategory(type === 'personal' ? 'Shopping' : 'Food & Dining');
    setHasUserSelectedCategory(false);
    setPaidBy(currentUserId);
    setSplitType('equal');
    setIncludedMembers(members.map((m) => m._id));
    setExactSplits({});
    setPercentageSplits({});
    setReceiptBase64(null);
    setFormError('');
    setShowAddModal(true);
  }

  // Submit expense (Create)
  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid amount');
      return;
    }

    // Auto-resolve title from category if user left description blank
    const categoryObj = EXPENSE_CATEGORIES.find((c) => c.id === category);
    const defaultTitle = category === 'Misc' ? 'Others' : (categoryObj?.label || category);
    const resolvedDescription = description.trim() || defaultTitle;

    setFormLoading(true);
    setFormError('');

    try {
      const isPersonal = expenseType === 'personal';
      let finalSplitDetails: Array<{ userId: string; amountOwed: number }> | undefined = undefined;

      if (!isPersonal && (splitType === 'exact' || splitType === 'percentage')) {
        finalSplitDetails = includedMembers.map((uId) => {
          let owed = 0;
          if (splitType === 'exact') owed = parseFloat(exactSplits[uId] || '0') || 0;
          else owed = (numAmount * (parseFloat(percentageSplits[uId] || '0') || 0)) / 100;
          return { userId: uId, amountOwed: owed };
        });
      }

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          amount: numAmount,
          description: resolvedDescription,
          category,
          isPersonal,
          paidBy: isPersonal ? currentUserId : paidBy,
          splitType: isPersonal ? 'equal' : splitType,
          includedMembers: isPersonal ? [currentUserId] : includedMembers,
          splitDetails: isPersonal ? [] : finalSplitDetails,
          receiptImage: receiptBase64 || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save expense');
      }

      const saved = await res.json();
      const currentUserObj = members.find((m) => m._id === currentUserId);
      const normalizedSaved: ExpenseItem = {
        ...saved,
        _id: saved._id ? (typeof saved._id === 'object' ? saved._id.toString() : String(saved._id)) : String(Date.now()),
        amount: saved.amount || numAmount,
        description: saved.description || resolvedDescription,
        category: saved.category || category,
        isPersonal,
        splitType: isPersonal ? 'equal' : (saved.splitType || splitType),
        paidBy: typeof saved.paidBy === 'object' && saved.paidBy?._id
          ? {
              _id: String(saved.paidBy._id),
              username: saved.paidBy.username || (isPersonal ? 'You' : (currentUserObj?.username || 'Member')),
              avatarId: saved.paidBy.avatarId || currentUserObj?.avatarId || 'avatar-fox.svg',
            }
          : {
              _id: isPersonal ? currentUserId : paidBy,
              username: isPersonal ? 'You' : (members.find((m) => m._id === paidBy)?.username || 'Member'),
              avatarId: members.find((m) => m._id === (isPersonal ? currentUserId : paidBy))?.avatarId || 'avatar-fox.svg',
            },
        includedMembers: isPersonal ? [currentUserId] : (saved.includedMembers || includedMembers),
        timestamp: saved.timestamp ? new Date(saved.timestamp).toISOString() : new Date().toISOString(),
      };

      setExpenses((prev) => [normalizedSaved, ...prev]);
      setShowAddModal(false);
      setAmount('');
      setDescription('');
      setReceiptBase64(null);
      router.refresh();
    } catch (err: any) {
      setFormError(err.message || 'Error saving expense');
    } finally {
      setFormLoading(false);
    }
  }

  // Filtered lists for full transactions view
  const filteredMyInvolved = useMemo(() => {
    if (!searchQuery.trim()) return myInvolvedExpenses;
    const q = searchQuery.toLowerCase();
    return myInvolvedExpenses.filter((item) => {
      const titleMatch = item.expense.description.toLowerCase().includes(q);
      const payer = memberMap.get(item.expense.paidBy?._id || item.expense.paidBy?.toString() || '');
      const payerMatch = payer?.username.toLowerCase().includes(q);
      return titleMatch || payerMatch;
    });
  }, [myInvolvedExpenses, searchQuery, memberMap]);

  const filteredGroupExpenses = useMemo(() => {
    if (!searchQuery.trim()) return sharedExpenses;
    const q = searchQuery.toLowerCase();
    return sharedExpenses.filter((e) => {
      const titleMatch = e.description.toLowerCase().includes(q);
      const payer = memberMap.get(e.paidBy?._id || e.paidBy?.toString() || '');
      const payerMatch = payer?.username.toLowerCase().includes(q);
      return titleMatch || payerMatch;
    });
  }, [sharedExpenses, searchQuery, memberMap]);

  return (
    <div className="px-3.5 py-4 sm:px-6 sm:py-6 max-w-4xl mx-auto space-y-4">

      {/* ─────────────────────────────────────────────────────────────
          1. VIEW: 'hub' (THE CLEAN APPLE WALLET STYLE MONEY HUB)
         ───────────────────────────────────────────────────────────── */}
      {view === 'hub' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Bar: Clean Balance on Left + Private Pocket Pill on Right (No redundant 'Money' text) */}
          <div className="flex items-center justify-between pt-1 pb-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="text-2xl sm:text-3xl font-bold font-mono tracking-tight"
                style={{
                  color: myNetBalance > 0.01 ? '#226338' : myNetBalance < -0.01 ? '#ba1a1a' : '#5f6368',
                }}
              >
                {myNetBalance > 0.01 ? `+${formatMoney(myNetBalance, currency)}` : myNetBalance < -0.01 ? `-${formatMoney(Math.abs(myNetBalance), currency)}` : `${currSymbol}0`}
              </span>
              <span className="text-xs sm:text-sm font-medium text-gray-500">
                • {myNetBalance > 0.01 ? 'You are owed' : myNetBalance < -0.01 ? 'You owe' : 'All settled up ✓'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigateTo('private')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#ecefeb] hover:bg-[#d8dbd7] text-[#183124] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs shrink-0"
            >
              <span>🔒</span>
              <span>Private Pocket</span>
              {myPersonalExpenses.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#ccead5] text-[#183124] font-bold">
                  {myPersonalExpenses.length}
                </span>
              )}
            </button>
          </div>

          {/* Smart Action Buttons: EQUAL SIZED */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openAddModal('shared')}
              className="flex-1 py-3 px-4 rounded-2xl bg-[#4a6454] hover:bg-[#385041] text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99]"
            >
              <span className="text-base font-bold leading-none">+</span>
              <span>Log Expense</span>
            </button>

            {(Math.abs(myNetBalance) > 0.01 || activeSettlements.length > 0) && (
              <button
                type="button"
                onClick={() => navigateTo('settle')}
                className="flex-1 py-3 px-4 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-[#183124] text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99]"
              >
                <span>🤝</span>
                <span>Settle Up</span>
                {activeSettlements.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] font-bold">
                    {activeSettlements.length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Symmetrical Toggle: [ 👤 My Ledger | 👥 Group Ledger ] */}
          <div className="bg-[#ecefeb] p-1 rounded-2xl flex items-center gap-1 border border-[#d6ddd6] shadow-2xs select-none touch-manipulation">
            <button
              type="button"
              onClick={() => setLedgerMode('mine')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none touch-manipulation ${
                ledgerMode === 'mine'
                  ? 'bg-white text-[#183124] shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>👤</span>
              <span>My Ledger</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${ledgerMode === 'mine' ? 'bg-[#ccead5] text-[#183124]' : 'bg-[#dfe3df] text-gray-600'}`}>
                {myInvolvedExpenses.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLedgerMode('group')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none touch-manipulation ${
                ledgerMode === 'group'
                  ? 'bg-white text-[#183124] shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>👥</span>
              <span>Group Ledger</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${ledgerMode === 'group' ? 'bg-[#ccead5] text-[#183124]' : 'bg-[#dfe3df] text-gray-600'}`}>
                {sharedExpenses.length}
              </span>
            </button>
          </div>

          {/* RECENT TRANSACTIONS PREVIEW (Latest 3–4 items) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {ledgerMode === 'mine' ? 'Recent personal shares' : 'Recent group bills'}
              </span>
              <span className="text-[11px] text-gray-400">
                Latest {Math.min(4, ledgerMode === 'mine' ? myInvolvedExpenses.length : sharedExpenses.length)}
              </span>
            </div>

            {ledgerMode === 'mine' ? (
              myInvolvedExpenses.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white border border-gray-100 text-center text-xs text-gray-400">
                  No personal expenses logged yet. Tap + Log Expense to add a bill.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 shadow-xs overflow-hidden">
                  {myInvolvedExpenses.slice(0, 4).map((item) => {
                    const e = item.expense;
                    const payer = memberMap.get(e.paidBy?._id || e.paidBy?.toString() || '');
                    const isPositive = item.netEffect > 0.01;
                    const isNegative = item.netEffect < -0.01;

                    return (
                      <div
                        key={e._id}
                        onClick={() => setSelectedExpenseDetail(e)}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors cursor-pointer active:bg-gray-100"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {e.description}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.isPayer ? `You paid ${formatMoney(e.amount, currency)}` : `${payer?.username || 'Member'} paid ${formatMoney(e.amount, currency)}`}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className="text-sm font-bold font-mono block"
                            style={{
                              color: isPositive ? '#226338' : isNegative ? '#ba1a1a' : '#5f6368',
                            }}
                          >
                            {isPositive ? `+${formatMoney(item.netEffect, currency)}` : isNegative ? `-${formatMoney(Math.abs(item.netEffect), currency)}` : `${currSymbol}0`}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {item.isPayer ? 'You get back' : 'Your share'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              sharedExpenses.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white border border-gray-100 text-center text-xs text-gray-400">
                  No group expenses recorded yet. Tap + Log Expense to add a bill.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 shadow-xs overflow-hidden">
                  {sharedExpenses.slice(0, 4).map((e) => {
                    const payer = memberMap.get(e.paidBy?._id || e.paidBy?.toString() || '');
                    const isPayerMe = (e.paidBy?._id || e.paidBy?.toString()) === currentUserId;

                    return (
                      <div
                        key={e._id}
                        onClick={() => setSelectedExpenseDetail(e)}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors cursor-pointer active:bg-gray-100"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {e.description}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {isPayerMe ? 'You paid' : `Paid by ${payer?.username || 'Member'}`} • {e.includedMembers?.length || members.length} people
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold font-mono text-gray-900 block">
                            {formatMoney(e.amount, currency)}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {CATEGORY_ICON_MAP[e.category || 'Misc'] || '🧾'} {e.category || 'Misc'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* View All Transactions Link */}
            {((ledgerMode === 'mine' ? myInvolvedExpenses.length : sharedExpenses.length) > 0) && (
              <button
                type="button"
                onClick={() => navigateTo('transactions', ledgerMode)}
                className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-gray-50 border border-gray-100 text-xs font-semibold text-[#4a6454] shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <span>View all transactions ({ledgerMode === 'mine' ? myInvolvedExpenses.length : sharedExpenses.length})</span>
                <span>→</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. VIEW: 'transactions' (DEDICATED FULL TRANSACTIONS VIEW)
         ───────────────────────────────────────────────────────────── */}
      {view === 'transactions' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Header Bar */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => navigateTo('hub')}
              className="min-h-[44px] px-3.5 py-2 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 text-[#4a6454] border border-black/[0.06] shadow-2xs text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <span className="text-sm leading-none">←</span>
              <span>Back to Money</span>
            </button>

            <button
              type="button"
              onClick={() => openAddModal('shared')}
              className="min-h-[44px] text-xs font-semibold px-4 py-2 rounded-xl bg-[#4a6454] text-white hover:bg-[#385041] transition-all cursor-pointer shadow-xs flex items-center gap-1 active:scale-95"
            >
              + Log Expense
            </button>
          </div>

          <h2
            className="text-xl font-bold tracking-tight text-[#1a1e1c]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Trip Transactions
          </h2>

          {/* Symmetrical Toggle: [ 👤 My Ledger | 👥 Group Ledger ] */}
          <div className="bg-[#ecefeb] p-1 rounded-2xl flex items-center gap-1 border border-[#d6ddd6] shadow-2xs">
            <button
              type="button"
              onClick={() => setLedgerMode('mine')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                ledgerMode === 'mine'
                  ? 'bg-white text-[#183124] shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>👤</span>
              <span>My Ledger ({myInvolvedExpenses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setLedgerMode('group')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                ledgerMode === 'group'
                  ? 'bg-white text-[#183124] shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>👥</span>
              <span>Group Ledger ({sharedExpenses.length})</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by title or member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs sm:text-sm pl-9 pr-8 py-2.5 rounded-xl bg-white border border-gray-200 outline-none focus:border-[#4a6454] transition-colors"
            />
            <span className="absolute left-3 top-3 text-xs text-gray-400">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Full List */}
          {ledgerMode === 'mine' ? (
            filteredMyInvolved.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-gray-100 text-center text-xs text-gray-400">
                {searchQuery ? 'No matching personal transactions found.' : 'No personal transactions yet.'}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 shadow-xs overflow-hidden">
                {filteredMyInvolved.map((item) => {
                  const e = item.expense;
                  const payer = memberMap.get(e.paidBy?._id || e.paidBy?.toString() || '');
                  const isPositive = item.netEffect > 0.01;
                  const isNegative = item.netEffect < -0.01;

                  return (
                    <div
                      key={e._id}
                      onClick={() => setSelectedExpenseDetail(e)}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors cursor-pointer active:bg-gray-100"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {e.description}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.isPayer ? `You paid ${formatMoney(e.amount, currency)}` : `${payer?.username || 'Member'} paid ${formatMoney(e.amount, currency)}`} • {new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className="text-sm font-bold font-mono block"
                          style={{
                            color: isPositive ? '#226338' : isNegative ? '#ba1a1a' : '#5f6368',
                          }}
                        >
                          {isPositive ? `+${formatMoney(item.netEffect, currency)}` : isNegative ? `-${formatMoney(Math.abs(item.netEffect), currency)}` : `${currSymbol}0`}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {item.isPayer ? 'You get back' : 'Your share'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            filteredGroupExpenses.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-gray-100 text-center text-xs text-gray-400">
                {searchQuery ? 'No matching group transactions found.' : 'No group transactions yet.'}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 shadow-xs overflow-hidden">
                {filteredGroupExpenses.map((e) => {
                  const payer = memberMap.get(e.paidBy?._id || e.paidBy?.toString() || '');
                  const isPayerMe = (e.paidBy?._id || e.paidBy?.toString()) === currentUserId;

                  return (
                    <div
                      key={e._id}
                      onClick={() => setSelectedExpenseDetail(e)}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors cursor-pointer active:bg-gray-100"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {e.description}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {isPayerMe ? 'You paid' : `Paid by ${payer?.username || 'Member'}`} • {e.includedMembers?.length || members.length} people • {new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold font-mono text-gray-900 block">
                          {formatMoney(e.amount, currency)}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {CATEGORY_ICON_MAP[e.category || 'Misc'] || '🧾'} {e.category || 'Misc'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. VIEW: 'settle' (DEDICATED SETTLE UP SCREEN)
         ───────────────────────────────────────────────────────────── */}
      {view === 'settle' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Header Bar */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => navigateTo('hub')}
              className="min-h-[44px] px-3.5 py-2 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 text-[#4a6454] border border-black/[0.06] shadow-2xs text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <span className="text-sm leading-none">←</span>
              <span>Back to Money</span>
            </button>

            {activeSettlements.length > 0 && (
              <button
                type="button"
                onClick={handleSettleAll}
                disabled={settlingInProgress}
                className="min-h-[44px] text-xs font-semibold px-4 py-2 rounded-xl bg-[#4a6454] text-white hover:bg-[#385041] transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1 active:scale-95"
              >
                {settlingInProgress ? 'Settling…' : 'Settle All'}
              </button>
            )}
          </div>

          <div>
            <h2
              className="text-xl font-bold tracking-tight text-[#1a1e1c]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              🤝 Settle Up
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Clear outstanding group balances with minimum friction
            </p>
          </div>

          {/* Success Banner */}
          {settleSuccessMsg && (
            <div className="p-3 rounded-xl bg-[#eef1ee] border border-[#ccead5] text-[#183124] text-xs font-semibold flex items-center gap-2">
              <span>✓</span>
              <span>{settleSuccessMsg}</span>
            </div>
          )}

          {/* The Debt Simplification Toggle: Clear Plain English */}
          <div className="p-3.5 rounded-2xl bg-white border border-gray-100 shadow-xs flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-gray-900 block">
                {isSimplified ? 'Simplified Payments' : 'Direct Payments'}
              </span>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                {isSimplified
                  ? 'Combines debts across the group so everyone makes the minimum number of transfers.'
                  : 'Pay back the exact person who paid for your bill, without combining.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsSimplified((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                isSimplified
                  ? 'bg-[#ccead5] text-[#183124] border border-[#b0cdba]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              {isSimplified ? '✓ Simplified' : 'Direct'}
            </button>
          </div>

          {/* Settlements List: 2-Tier Mobile Friendly Cards */}
          {activeSettlements.length === 0 ? (
            <div className="py-12 px-4 rounded-2xl bg-white border border-gray-100 text-center space-y-2">
              <span className="text-3xl block">🎉</span>
              <p className="text-sm font-semibold text-[#1a1e1c]">All balances are settled!</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                No outstanding transfers needed. Everyone in the crew is completely squared up.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeSettlements.map((tx, idx) => {
                const debtor = memberMap.get(tx.from);
                const creditor = memberMap.get(tx.to);
                const isMyDebt = tx.from === currentUserId;
                const isOwedToMe = tx.to === currentUserId;

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-2.5"
                    style={{
                      borderLeft: isMyDebt ? '3.5px solid #ba1a1a' : isOwedToMe ? '3.5px solid #226338' : '1px solid #f1f4f1',
                    }}
                  >
                    {/* Line 1: Who pays whom */}
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-800 flex-wrap">
                      <span className="text-base">{getAvatarEmoji(debtor?.avatarId)}</span>
                      <span>{debtor?.username || 'Member'}</span>
                      {isMyDebt && <span className="text-[10px] text-red-600 font-bold">(You)</span>}
                      <span className="text-gray-400 font-normal">pays →</span>
                      <span className="text-base">{getAvatarEmoji(creditor?.avatarId)}</span>
                      <span>{creditor?.username || 'Member'}</span>
                      {isOwedToMe && <span className="text-[10px] text-green-700 font-bold">(You)</span>}
                    </div>

                    {/* Line 2: Amount on left, Action buttons on right */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-gray-50 flex-wrap gap-2">
                      <span
                        className="text-base font-bold font-mono"
                        style={{ color: isMyDebt ? '#ba1a1a' : isOwedToMe ? '#226338' : '#1a1e1c' }}
                      >
                        {formatMoney(tx.amount, currency)}
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 1-Tap UPI pay button (when viewing debt I owe) */}
                        {isMyDebt && (
                          <button
                            type="button"
                            onClick={() => handlePayUPI(creditor?.username || 'Member', tx.amount)}
                            className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#eef4f0] hover:bg-[#dce8dc] text-[#183124] transition-all cursor-pointer border border-[#ccead5] flex items-center gap-1 active:scale-95 shadow-2xs"
                            title="Open Google Pay / PhonePe / Paytm"
                          >
                            <span>⚡</span>
                            <span>Pay UPI</span>
                          </button>
                        )}

                        {/* 1-Tap WhatsApp remind button (when money is owed to me or peer reminder) */}
                        {!isMyDebt && (
                          <button
                            type="button"
                            onClick={() => handleWhatsAppRemind(debtor?.username || 'Member', creditor?.username || 'Member', tx.amount)}
                            className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] transition-all cursor-pointer border border-[#25D366]/25 flex items-center gap-1 active:scale-95 shadow-2xs"
                            title="Send friendly WhatsApp reminder"
                          >
                            <span>💬</span>
                            <span>Remind</span>
                          </button>
                        )}

                        {/* Settle in Database button */}
                        <button
                          type="button"
                          onClick={() => handleSettleSingle(tx)}
                          disabled={settlingInProgress}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#4a6454] hover:bg-[#385041] text-white transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                        >
                          Settle ✓
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Past Settlements History Accordion */}
          {settlementRecords.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowPastSettlements((prev) => !prev)}
                className="w-full py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>Past settled transfers ({settlementRecords.length})</span>
                <span>{showPastSettlements ? '▴' : '▾'}</span>
              </button>

              {showPastSettlements && (
                <div className="mt-2 space-y-1.5 animate-in fade-in duration-150">
                  {settlementRecords.map((s) => (
                    <div key={s._id} className="p-2.5 rounded-xl bg-white border border-gray-100 text-xs flex items-center justify-between text-gray-500">
                      <span className="truncate pr-2">{s.description}</span>
                      <span className="font-mono font-semibold text-gray-800 shrink-0">{formatMoney(s.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. VIEW: 'private' (DEDICATED PRIVATE POCKET SCREEN)
         ───────────────────────────────────────────────────────────── */}
      {view === 'private' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Header Bar */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => navigateTo('hub')}
              className="min-h-[44px] px-3.5 py-2 rounded-full bg-white hover:bg-gray-50 active:bg-gray-100 text-[#4a6454] border border-black/[0.06] shadow-2xs text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <span className="text-sm leading-none">←</span>
              <span>Back to Money</span>
            </button>
          </div>

          <div>
            <h2
              className="text-xl font-bold tracking-tight text-[#1a1e1c]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              🔒 My Private Pocket
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Personal shopping & solo spends. 100% invisible to other trip members.
            </p>
          </div>

          {/* Personal Spending Limit Card */}
          <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Private Spending Limit</span>
              <button
                type="button"
                onClick={() => {
                  setPersonalBudgetInput(personalBudget > 0 ? String(personalBudget) : '');
                  setIsEditingPersonalBudget((prev) => !prev);
                }}
                className="text-xs font-semibold text-[#4a6454] hover:underline cursor-pointer"
              >
                {personalBudget > 0 ? (isEditingPersonalBudget ? 'Cancel' : 'Edit limit') : '+ Set limit'}
              </button>
            </div>

            {isEditingPersonalBudget ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = parseFloat(personalBudgetInput);
                  handleSavePersonalBudget(!isNaN(val) && val >= 0 ? val : 0);
                }}
                className="flex items-center gap-2 pt-1"
              >
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 10000"
                  value={personalBudgetInput}
                  onChange={(e) => setPersonalBudgetInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:border-[#4a6454]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#4a6454] text-white text-xs font-semibold cursor-pointer"
                >
                  Save
                </button>
              </form>
            ) : (
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold font-mono text-gray-900">
                    {formatMoney(myPersonalSpendTotal, currency)}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    {personalBudget > 0 ? `Limit: ${formatMoney(personalBudget, currency)}` : 'No limit set'}
                  </span>
                </div>

                {personalBudget > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.round((myPersonalSpendTotal / personalBudget) * 100))}%`,
                          backgroundColor: myPersonalSpendTotal > personalBudget ? '#ba1a1a' : '#4a6454',
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                      <span>{Math.round((myPersonalSpendTotal / personalBudget) * 100)}% used</span>
                      <span>
                        {personalBudget - myPersonalSpendTotal >= 0
                          ? `${formatMoney(personalBudget - myPersonalSpendTotal, currency)} left`
                          : `${formatMoney(Math.abs(personalBudget - myPersonalSpendTotal), currency)} over`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={() => openAddModal('personal')}
            className="w-full py-3 px-4 rounded-2xl bg-[#4a6454] hover:bg-[#385041] text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99]"
          >
            <span className="text-base font-bold leading-none">+</span>
            <span>Record Private Spend</span>
          </button>

          {/* Private Spends List: ONLY rendered when spends exist! Zero empty box if empty! */}
          {myPersonalExpenses.length > 0 && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-150">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                Private Log ({myPersonalExpenses.length})
              </span>

              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 shadow-xs overflow-hidden">
                {myPersonalExpenses.map((e) => (
                  <div
                    key={e._id}
                    onClick={() => setSelectedExpenseDetail(e)}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors cursor-pointer active:bg-gray-100"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {e.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {CATEGORY_ICON_MAP[e.category || 'Misc'] || '🛍️'} {e.category || 'Solo'} • {new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold font-mono text-gray-900 block">
                        {formatMoney(e.amount, currency)}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">Personal</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. ADD EXPENSE MODAL (WITH PROMINENT TABS FOR PRIVATE SPENDS)
         ───────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#eef4f0] text-base flex items-center justify-center">
                  {expenseType === 'personal' ? '🔒' : '🧾'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">
                    {expenseType === 'personal' ? 'Record Private Spend' : 'Log Group Expense'}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {expenseType === 'personal'
                      ? 'Private to your pocket • Not shared with the crew'
                      : 'Shared expense • Split with your crew'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateExpense} className="space-y-4">

              {/* Amount Input */}
              <div className="bg-[#f7faf6] rounded-2xl p-4 text-center border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-400 block mb-1">
                  Amount ({currSymbol})
                </span>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-2xl font-bold font-mono text-gray-400">{currSymbol}</span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    autoFocus
                    className="w-40 text-center text-3xl font-bold font-mono text-gray-900 bg-transparent outline-none"
                  />
                </div>
              </div>

              {/* Category Selector (FIRST!) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700">Category *</label>
                  <span className="text-[11px] text-gray-400">Select to auto-label</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategory(cat.id);
                        setHasUserSelectedCategory(true);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        category === cat.id
                          ? 'border-[#4a6454] bg-[#eef4f0] text-[#183124] font-bold ring-1 ring-[#4a6454] shadow-2xs'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="truncate">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Description / Note */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Description / Note <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    category === 'Misc'
                      ? 'e.g. Medicine, SIM card, permit fee (optional)'
                      : `e.g. ${category === 'Food & Dining' ? 'Dinner, café, snacks' : category === 'Transport' ? 'Cab, fuel, tickets' : category === 'Stay' ? 'Homestay, hotel room' : category === 'Shopping' ? 'Souvenirs, clothing' : 'Tours, guide, tickets'} (optional)`
                  }
                  value={description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDescription(val);
                    if (!hasUserSelectedCategory) {
                      if (val.trim()) {
                        const detected = detectExpenseCategory(val);
                        if (detected !== 'Settlement' && detected !== 'Misc') {
                          setCategory(detected);
                        }
                      } else {
                        setCategory(expenseType === 'personal' ? 'Shopping' : 'Food & Dining');
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-[#4a6454]"
                />
              </div>

              {/* Group Settings: Who paid and split */}
              {expenseType === 'shared' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Who paid?</label>
                    <select
                      value={paidBy}
                      onChange={(e) => setPaidBy(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl outline-none"
                    >
                      {members.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.username} {m._id === currentUserId ? '(You)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Split between</label>
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((m) => {
                        const isInc = includedMembers.includes(m._id);
                        return (
                          <button
                            key={m._id}
                            type="button"
                            onClick={() => {
                              if (isInc && includedMembers.length === 1) return;
                              setIncludedMembers((prev) =>
                                isInc ? prev.filter((id) => id !== m._id) : [...prev, m._id]
                              );
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                              isInc
                                ? 'bg-[#ccead5] text-[#183124] border-[#b0cdba] font-semibold'
                                : 'bg-gray-50 text-gray-400 border-gray-200'
                            }`}
                          >
                            {m.username} {isInc ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Optional Receipt Photo */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Receipt Photo <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#ecefeb] file:text-[#183124] cursor-pointer"
                />
                {receiptBase64 && (
                  <div className="mt-2 relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
                    <img src={receiptBase64} alt="Receipt preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setReceiptBase64(null)}
                      className="absolute top-0 right-0 bg-black/60 text-white text-[10px] p-0.5"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-3 px-4 rounded-xl bg-[#4a6454] hover:bg-[#385041] text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-50"
                >
                  {formLoading
                    ? 'Saving…'
                    : expenseType === 'personal'
                    ? 'Record Private Spend'
                    : 'Log Group Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. EXPENSE DETAILS BOTTOM SHEET
         ───────────────────────────────────────────────────────────── */}
      {selectedExpenseDetail && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in"
          onClick={() => setSelectedExpenseDetail(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {selectedExpenseDetail.isPersonal ? 'Private Spend' : 'Group Expense'}
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                  {selectedExpenseDetail.description}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExpenseDetail(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#f7faf6] p-4 rounded-2xl border border-gray-100 flex items-baseline justify-between">
              <span className="text-xs text-gray-500 font-medium">Total Bill</span>
              <span className="text-2xl font-bold font-mono text-gray-900">
                {formatMoney(selectedExpenseDetail.amount, currency)}
              </span>
            </div>

            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Paid by</span>
                <span className="font-semibold text-gray-900">
                  {memberMap.get(selectedExpenseDetail.paidBy?._id || selectedExpenseDetail.paidBy?.toString() || '')?.username || 'Member'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Date</span>
                <span className="font-semibold text-gray-900">
                  {new Date(selectedExpenseDetail.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">Category</span>
                <span className="font-semibold text-gray-900">{selectedExpenseDetail.category || 'Misc'}</span>
              </div>
            </div>

            {/* Receipt Photo */}
            {selectedExpenseDetail.receiptImage && (
              <div>
                <span className="text-xs font-semibold text-gray-700 block mb-1">Receipt Attachment</span>
                <div
                  onClick={() => setActiveReceiptModalUrl(selectedExpenseDetail.receiptImage!)}
                  className="w-full h-36 rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <img src={selectedExpenseDetail.receiptImage} alt="Receipt" className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {/* Actions: Delete button */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteExpense(selectedExpenseDetail._id)}
                className="text-xs font-semibold text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Delete Expense
              </button>

              <button
                type="button"
                onClick={() => setSelectedExpenseDetail(null)}
                className="text-xs font-semibold text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. FULLSCREEN RECEIPT LIGHTBOX
         ───────────────────────────────────────────────────────────── */}
      {activeReceiptModalUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setActiveReceiptModalUrl(null)}
        >
          <div className="max-w-xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img src={activeReceiptModalUrl} alt="Receipt Full" className="max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
            <button
              type="button"
              onClick={() => setActiveReceiptModalUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-gray-800 font-bold flex items-center justify-center shadow-lg cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
