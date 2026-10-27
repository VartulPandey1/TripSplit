'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { calculateSettlements, Transaction } from '@/lib/utils/settleUp';
import { getAvatarEmoji } from '@/lib/constants/avatars';
import { CURRENCIES, formatMoney, getCurrencySymbol, getExchangeRate } from '@/lib/utils/currency';
import BudgetGuessingHub, { SerializedBudget } from './BudgetGuessingHub';

interface Member {
  _id: string;
  username: string;
  avatarId?: string;
  email?: string;
}

interface SplitDetail {
  userId: string;
  amountOwed: number;
}

interface ExpenseItem {
  _id: string;
  amount: number;
  description: string;
  category?: string;
  isPersonal?: boolean;
  splitType: string;
  splitDetails?: SplitDetail[];
  receiptImage?: string;
  paidBy: {
    _id: string;
    username: string;
    avatarId?: string;
  };
  includedMembers: string[];
  timestamp: string;
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 900;
        const MAX_HEIGHT = 900;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getExpenseUserOwed(exp: ExpenseItem, userId: string, totalMembers: number = 1): number {
  if (exp.isPersonal || exp.splitType === 'personal') {
    const payerId = exp.paidBy?._id ? String(exp.paidBy._id) : String(exp.paidBy || '');
    return payerId === userId ? exp.amount : 0;
  }

  if (
    (exp.splitType === 'exact' || exp.splitType === 'percentage') &&
    exp.splitDetails &&
    exp.splitDetails.length > 0
  ) {
    const detail = exp.splitDetails.find((d) => String(d.userId) === String(userId));
    if (detail !== undefined) {
      return detail.amountOwed;
    }
  }

  // Fallback equal split among included members
  const included =
    exp.includedMembers && exp.includedMembers.length > 0
      ? exp.includedMembers.map(String)
      : [];

  if (included.length === 0 || included.includes(String(userId))) {
    const count = included.length > 0 ? included.length : totalMembers;
    return exp.amount / Math.max(1, count);
  }

  return 0;
}

interface MoneyClientProps {
  tripId: string;
  currentUserId: string;
  isCreator?: boolean;
  members: Member[];
  initialExpenses: ExpenseItem[];
  initialCurrency?: string;
  initialBudget?: SerializedBudget | null;
  initialPersonalBudget?: number | null;
  initialTab?: 'budget' | 'expenses' | 'settle';
}

const EXPENSE_CATEGORIES = [
  { id: 'Food & Dining', label: 'Food & Dining', icon: '🍽️' },
  { id: 'Fuel & Cab', label: 'Fuel & Cab', icon: '⛽' },
  { id: 'Hotel / Camp', label: 'Hotel / Camp', icon: '🏨' },
  { id: 'Activities', label: 'Activities', icon: '🎟️' },
  { id: 'Groceries', label: 'Groceries', icon: '🛒' },
  { id: 'Coffee & Snacks', label: 'Coffee & Snacks', icon: '☕' },
] as const;

const CATEGORY_ICON_MAP: Record<string, string> = {
  'Food & Dining': '🍽️',
  'Fuel & Cab': '⛽',
  'Hotel / Camp': '🏨',
  Activities: '🎟️',
  Groceries: '🛒',
  'Coffee & Snacks': '☕',
  Stay: '🏨',
  Transport: '⛽',
  Shopping: '🛍️',
  Settlement: '🤝',
  Misc: '🧾',
};

interface GroupedExpenses {
  dateKey: string;
  dateLabel: string;
  totalForDay: number;
  items: ExpenseItem[];
}

function groupExpensesByDate(list: ExpenseItem[]): GroupedExpenses[] {
  const groups: Record<string, GroupedExpenses> = {};
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  list.forEach((exp) => {
    const d = new Date(exp.timestamp);
    let dateKey = 'unknown';
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateKey = `${y}-${m}-${day}`;
    }
    const dStr = !isNaN(d.getTime()) ? d.toDateString() : '';

    let label = '';
    if (dStr === todayStr) {
      label = `TODAY, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`;
    } else if (dStr === yesterdayStr) {
      label = `YESTERDAY, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`;
    } else {
      label = !isNaN(d.getTime())
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
        : 'OTHER';
    }

    if (!groups[dateKey]) {
      groups[dateKey] = {
        dateKey,
        dateLabel: label,
        totalForDay: 0,
        items: [],
      };
    }
    groups[dateKey].items.push(exp);
    groups[dateKey].totalForDay += exp.amount || 0;
  });

  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map((k) => groups[k]);
}

export default function MoneyClient({
  tripId,
  currentUserId,
  isCreator = false,
  members,
  initialExpenses,
  initialCurrency = 'INR',
  initialBudget = null,
  initialPersonalBudget = null,
  initialTab = 'expenses',
}: MoneyClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<'budget' | 'expenses' | 'settle'>(initialTab);

  // Sync tab if URL query changes
  const queryTab = searchParams?.get('tab');
  useEffect(() => {
    if (queryTab === 'budget' || queryTab === 'expenses' || queryTab === 'settle') {
      setActiveView(queryTab);
    }
  }, [queryTab]);

  // Expenses subview:
  // 'personal': User's Personal Share & Receivables (DEFAULT)
  // 'ledger': Shared Group Expense Ledger
  // 'private-spends': User's Solo Pocket Spends (Separate from Group)
  const [expenseSubView, setExpenseSubView] = useState<'personal' | 'ledger' | 'private-spends'>('personal');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedPayerFilter, setSelectedPayerFilter] = useState<string>('all');
  const [budget, setBudget] = useState<SerializedBudget | null>(initialBudget);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [currency, setCurrency] = useState(initialCurrency || 'INR');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddBudgetModal, setShowAddBudgetModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected expense detail modal
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<ExpenseItem | null>(null);

  // Personal budget limit (Private Spends) - Multi-Device Continuity via MongoDB
  const storageKey = `tripsplit_user_budget_${tripId}_${currentUserId}`;
  const [personalBudget, setPersonalBudget] = useState<number>(() => {
    if (typeof initialPersonalBudget === 'number' && initialPersonalBudget >= 0) {
      return initialPersonalBudget;
    }
    return 0;
  });

  useEffect(() => {
    if (typeof initialPersonalBudget === 'number' && initialPersonalBudget >= 0) {
      setPersonalBudget(initialPersonalBudget);
      try {
        localStorage.setItem(storageKey, String(initialPersonalBudget));
      } catch {}
      return;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 0) {
          setPersonalBudget(parsed);
          return;
        }
      }
    } catch {}

    // Multi-device continuity fetch from MongoDB
    fetch(`/api/budget/personal?tripId=${tripId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.amount === 'number' && data.amount > 0) {
          setPersonalBudget(data.amount);
          try {
            localStorage.setItem(storageKey, String(data.amount));
          } catch {}
        }
      })
      .catch(() => {});
  }, [storageKey, initialPersonalBudget, tripId]);

  async function handleUpdatePersonalBudget(val: number) {
    setPersonalBudget(val);
    try {
      if (val > 0) {
        localStorage.setItem(storageKey, String(val));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {}

    // Persist to MongoDB for multi-device continuity
    try {
      await fetch('/api/budget/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, amount: val }),
      });
    } catch (e) {
      console.warn('Failed to sync personal budget to database', e);
    }
  }

  // 1. COMPLETELY SEPARATE SHARED AND PERSONAL EXPENSES
  const sharedExpenses = expenses.filter((e) => !e.isPersonal && e.splitType !== 'personal');
  const personalExpenses = expenses.filter((e) => Boolean(e.isPersonal || e.splitType === 'personal'));

  // Personal expenses logged by current user (Private Spends)
  const myPersonalExpenses = personalExpenses.filter(
    (e) => (e.paidBy?._id ? String(e.paidBy._id) : String(e.paidBy)) === String(currentUserId)
  );
  const myPersonalSpend = myPersonalExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Total Shared Spend across the trip pool (excluding settlements which are transfers)
  const totalSharedSpend = sharedExpenses
    .filter((e) => e.category !== 'Settlement')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Past recorded settlements
  const pastSettlements = sharedExpenses.filter((e) => e.category === 'Settlement');

  // Member map for quick lookup
  const memberMap = new Map<string, Member>();
  members.forEach((m) => memberMap.set(String(m._id), m));

  // 2. PERSONAL LEDGER CALCULATIONS (Transactions related to ME from SHARED fund)
  interface MyLedgerTransaction {
    expense: ExpenseItem;
    isPayer: boolean;
    payerName: string;
    payerId: string;
    myShare: number;
    getBack: number;
    netImpact: number;
    otherMembers: string[];
  }

  const myLedgerTransactions: MyLedgerTransaction[] = [];
  let totalToPay = 0;
  let totalToGet = 0;
  let myTotalSharedShare = 0;
  let myTotalSharedPaid = 0;

  sharedExpenses.forEach((exp) => {
    if (exp.category === 'Settlement') return;
    const payerId = exp.paidBy?._id ? String(exp.paidBy._id) : String(exp.paidBy || '');
    const isPayer = payerId === String(currentUserId);
    const splitMembers = exp.includedMembers?.length > 0 ? exp.includedMembers.map(String) : members.map((m) => String(m._id));
    const isIncluded = splitMembers.includes(String(currentUserId));

    const myShare = isIncluded ? getExpenseUserOwed(exp, String(currentUserId), members.length) : 0;
    if (!isPayer && myShare <= 0) return;

    const payerName = isPayer ? 'You' : (exp.paidBy?.username || memberMap.get(payerId)?.username || 'Member');

    if (isPayer) {
      myTotalSharedPaid += exp.amount;
    }
    if (isIncluded) {
      myTotalSharedShare += myShare;
    }

    if (isPayer) {
      const getBack = Math.max(0, exp.amount - myShare);
      if (getBack > 0 || myShare === exp.amount) {
        if (getBack > 0) totalToGet += getBack;
        const otherMembers = splitMembers
          .filter((id) => id !== String(currentUserId))
          .map((id) => memberMap.get(id)?.username || 'Member');

        myLedgerTransactions.push({
          expense: exp,
          isPayer: true,
          payerName,
          payerId,
          myShare,
          getBack,
          netImpact: getBack,
          otherMembers,
        });
      }
    } else {
      if (myShare > 0) {
        totalToPay += myShare;
        myLedgerTransactions.push({
          expense: exp,
          isPayer: false,
          payerName,
          payerId,
          myShare,
          getBack: 0,
          netImpact: -myShare,
          otherMembers: [],
        });
      }
    }
  });

  const netSharedPosition = myTotalSharedPaid - myTotalSharedShare;

  // Group balances & settlements strictly on SHARED expenses
  const balances: Record<string, number> = {};
  members.forEach((m) => {
    balances[m._id] = 0;
  });

  sharedExpenses.forEach((exp) => {
    const payerId = exp.paidBy?._id ? String(exp.paidBy._id) : String(exp.paidBy || currentUserId);
    balances[payerId] = (balances[payerId] || 0) + exp.amount;

    members.forEach((m) => {
      const owed = getExpenseUserOwed(exp, m._id, members.length);
      balances[m._id] = (balances[m._id] || 0) - owed;
    });
  });

  const settlements: Transaction[] = calculateSettlements(balances);
  const totalTripSpend = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const myNetBalance = balances[currentUserId] || 0;
  const currSymbol = getCurrencySymbol(currency);

  // New Expense form state
  const [expenseType, setExpenseType] = useState<'shared' | 'personal'>('shared');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Food & Dining');
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [includedMembers, setIncludedMembers] = useState<string[]>(members.map((m) => m._id));
  const [splitMode, setSplitMode] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [exactSplits, setExactSplits] = useState<Record<string, string>>({});
  const [percentageSplits, setPercentageSplits] = useState<Record<string, string>>({});
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [compressingReceipt, setCompressingReceipt] = useState(false);

  // Edit Expense modal state
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState<string>('Food & Dining');
  const [editIsPersonal, setEditIsPersonal] = useState(false);
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editIncludedMembers, setEditIncludedMembers] = useState<string[]>([]);
  const [editSplitMode, setEditSplitMode] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [editExactSplits, setEditExactSplits] = useState<Record<string, string>>({});
  const [editPercentageSplits, setEditPercentageSplits] = useState<Record<string, string>>({});
  const [editReceiptImage, setEditReceiptImage] = useState<string | null>(null);
  const [editCompressingReceipt, setEditCompressingReceipt] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Receipt image full viewer modal
  const [activeReceiptModalUrl, setActiveReceiptModalUrl] = useState<string | null>(null);

  function handleExportReport() {
    const dateStr = new Date().toISOString().split('T')[0];
    const escapeCsv = (str: string | number | undefined | null) => {
      if (str === undefined || str === null) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const lines: string[] = [];
    lines.push(escapeCsv(`TripSplit Expense & Settle-Up Report`));
    lines.push(escapeCsv(`Generated on: ${new Date().toLocaleString('en-US')}`));
    lines.push(escapeCsv(`Currency: ${currency} (${currSymbol})`));
    lines.push(escapeCsv(`Total Shared Trip Spend: ${formatMoney(totalSharedSpend, currency)}`));
    lines.push(escapeCsv(`Total Private Spend: ${formatMoney(myPersonalSpend, currency)}`));
    lines.push('');

    // Section 1: Member Net Balances
    lines.push(escapeCsv(`--- MEMBER BALANCES & SETTLEMENT STATUS ---`));
    lines.push([escapeCsv('Member'), escapeCsv('Net Balance'), escapeCsv('Status')].join(','));
    members.forEach((m) => {
      const bal = balances[m._id] || 0;
      const status = bal > 0.01 ? 'Owed' : bal < -0.01 ? 'Owes' : 'Settled';
      lines.push([
        escapeCsv(m.username + (m._id === currentUserId ? ' (You)' : '')),
        escapeCsv(formatMoney(bal, currency)),
        escapeCsv(status),
      ].join(','));
    });
    lines.push('');

    // Section 2: Shared Expenses
    lines.push(escapeCsv(`--- SHARED EXPENSES LEDGER ---`));
    lines.push([
      escapeCsv('Date'),
      escapeCsv('Description'),
      escapeCsv('Category'),
      escapeCsv('Paid By'),
      escapeCsv('Split Type'),
      escapeCsv('Amount'),
      escapeCsv('Included Participants'),
      escapeCsv('Receipt Attached'),
    ].join(','));

    sharedExpenses.forEach((exp) => {
      const d = new Date(exp.timestamp).toLocaleDateString('en-US');
      const payer = exp.paidBy?.username || memberMap.get(String(exp.paidBy?._id || exp.paidBy))?.username || 'Member';
      const incMembers = (exp.includedMembers && exp.includedMembers.length > 0 ? exp.includedMembers : members.map((m) => m._id))
        .map((uid) => memberMap.get(String(uid))?.username || 'Member')
        .join('; ');

      lines.push([
        escapeCsv(d),
        escapeCsv(exp.description),
        escapeCsv(exp.category || 'Misc'),
        escapeCsv(payer),
        escapeCsv(exp.splitType || 'equal'),
        escapeCsv(exp.amount),
        escapeCsv(incMembers),
        escapeCsv(exp.receiptImage ? 'Yes' : 'No'),
      ].join(','));
    });
    lines.push('');

    // Section 3: Past Settlements
    if (pastSettlements.length > 0) {
      lines.push(escapeCsv(`--- RECORDED SETTLEMENT TRANSFERS ---`));
      lines.push([escapeCsv('Date'), escapeCsv('Description'), escapeCsv('Amount')].join(','));
      pastSettlements.forEach((s) => {
        const d = new Date(s.timestamp).toLocaleDateString('en-US');
        lines.push([escapeCsv(d), escapeCsv(s.description), escapeCsv(s.amount)].join(','));
      });
      lines.push('');
    }

    // Section 4: Recommended Settlements
    if (settlements.length > 0) {
      lines.push(escapeCsv(`--- PENDING SETTLEMENT TRANSFERS ---`));
      lines.push([escapeCsv('From'), escapeCsv('To'), escapeCsv('Amount')].join(','));
      settlements.forEach((tx) => {
        const fromName = memberMap.get(String(tx.from))?.username || 'Member';
        const toName = memberMap.get(String(tx.to))?.username || 'Member';
        lines.push([escapeCsv(fromName), escapeCsv(toName), escapeCsv(tx.amount)].join(','));
      });
    }

    const csvContent = lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TripSplit_Expense_Report_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Extract unique categories and payers present in shared expenses for filter chips
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    sharedExpenses.forEach((e) => {
      if (e.category && e.category !== 'Settlement') cats.add(e.category);
    });
    return Array.from(cats);
  }, [sharedExpenses]);

  const availablePayers = useMemo(() => {
    const payerMap = new Map<string, { id: string; name: string; avatarId?: string }>();
    sharedExpenses.forEach((e) => {
      const pId = e.paidBy?._id ? String(e.paidBy._id) : String(e.paidBy);
      if (pId && !payerMap.has(pId)) {
        payerMap.set(pId, {
          id: pId,
          name: e.paidBy?.username || 'Member',
          avatarId: e.paidBy?.avatarId,
        });
      }
    });
    return Array.from(payerMap.values());
  }, [sharedExpenses]);

  // Search and chip filtered lists
  const filteredSharedExpenses = sharedExpenses.filter((e) => {
    // 1. Text search
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      const matches =
        e.description.toLowerCase().includes(q) ||
        (e.category && e.category.toLowerCase().includes(q)) ||
        (e.paidBy?.username && e.paidBy.username.toLowerCase().includes(q));
      if (!matches) return false;
    }
    // 2. Category chip filter
    if (selectedCategoryFilter !== 'all') {
      if (e.category !== selectedCategoryFilter) return false;
    }
    // 3. Payer chip filter
    if (selectedPayerFilter !== 'all') {
      const pId = e.paidBy?._id ? String(e.paidBy._id) : String(e.paidBy);
      if (pId !== selectedPayerFilter) return false;
    }
    return true;
  });

  const filteredPersonalExpenses = ledgerSearch.trim()
    ? myPersonalExpenses.filter((e) => {
        const q = ledgerSearch.toLowerCase();
        return (
          e.description.toLowerCase().includes(q) ||
          (e.category && e.category.toLowerCase().includes(q))
        );
      })
    : myPersonalExpenses;

  const filteredMyLedgerTransactions = ledgerSearch.trim()
    ? myLedgerTransactions.filter((tx) => {
        const q = ledgerSearch.toLowerCase();
        return (
          tx.expense.description.toLowerCase().includes(q) ||
          (tx.expense.category && tx.expense.category.toLowerCase().includes(q)) ||
          tx.payerName.toLowerCase().includes(q) ||
          tx.otherMembers.some((m) => m.toLowerCase().includes(q))
        );
      })
    : myLedgerTransactions;

  const groupedSharedExpenses = groupExpensesByDate(filteredSharedExpenses);
  const groupedPersonalExpenses = groupExpensesByDate(filteredPersonalExpenses);

  async function handleCurrencyChange(newCurrency: string) {
    if (newCurrency === currency) return;

    if (expenses.length > 0) {
      const rate = getExchangeRate(currency, newCurrency);
      const shouldConvert = confirm(
        `Convert ${expenses.length} recorded expense(s) and budget from ${currency} to ${newCurrency}?\n\n` +
        `• Click OK to convert values at current exchange rate (1 ${currency} ≈ ${rate} ${newCurrency}).\n` +
        `• Click Cancel to change the currency symbol only without converting amounts.`
      );

      setCurrency(newCurrency);
      await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: newCurrency,
          convertExisting: shouldConvert,
          exchangeRate: rate,
        }),
      });

      if (shouldConvert) {
        setExpenses((prev) =>
          prev.map((e) => ({
            ...e,
            amount: Math.round(e.amount * rate * 100) / 100,
          }))
        );
      }
    } else {
      setCurrency(newCurrency);
      await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: newCurrency }),
      });
    }

    router.refresh();
  }

  function toggleMember(memberId: string) {
    if (includedMembers.includes(memberId)) {
      if (includedMembers.length === 1) return;
      setIncludedMembers(includedMembers.filter((id) => id !== memberId));
    } else {
      setIncludedMembers([...includedMembers, memberId]);
    }
  }

  function toggleEditMember(memberId: string) {
    if (editIncludedMembers.includes(memberId)) {
      if (editIncludedMembers.length === 1) return;
      setEditIncludedMembers(editIncludedMembers.filter((id) => id !== memberId));
    } else {
      setEditIncludedMembers([...editIncludedMembers, memberId]);
    }
  }

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !amount || Number(amount) <= 0) return;

    setLoading(true);
    setError('');

    const numAmount = parseFloat(amount);
    const isPersonalSelected = expenseType === 'personal';

    let finalSplitType: 'equal' | 'exact' | 'percentage' | 'personal' = isPersonalSelected
      ? 'personal'
      : splitMode;
    let finalSplitDetails: { userId: string; amountOwed: number }[] = [];
    let finalIncluded = isPersonalSelected ? [currentUserId] : includedMembers;

    if (!isPersonalSelected) {
      if (splitMode === 'exact') {
        const exactSum = Object.values(exactSplits).reduce(
          (sum, v) => sum + (parseFloat(v) || 0),
          0
        );
        if (Math.abs(exactSum - numAmount) > 0.05) {
          setError(
            `Exact splits sum (${formatMoney(exactSum, currency)}) does not match total expense amount (${formatMoney(numAmount, currency)}).`
          );
          setLoading(false);
          return;
        }
        finalSplitDetails = Object.entries(exactSplits)
          .map(([uid, val]) => ({ userId: uid, amountOwed: parseFloat(val) || 0 }))
          .filter((d) => d.amountOwed > 0);
        finalIncluded = finalSplitDetails.map((d) => d.userId);
        if (finalIncluded.length === 0) {
          setError('At least one member must have an allocated amount.');
          setLoading(false);
          return;
        }
      } else if (splitMode === 'percentage') {
        const percentSum = Object.values(percentageSplits).reduce(
          (sum, v) => sum + (parseFloat(v) || 0),
          0
        );
        if (Math.abs(percentSum - 100) > 0.1) {
          setError(`Percentages sum (${percentSum.toFixed(1)}%) must equal 100%.`);
          setLoading(false);
          return;
        }
        finalSplitDetails = Object.entries(percentageSplits)
          .map(([uid, val]) => {
            const pct = parseFloat(val) || 0;
            return {
              userId: uid,
              amountOwed: Math.round((pct / 100) * numAmount * 100) / 100,
            };
          })
          .filter((d) => d.amountOwed > 0);
        finalIncluded = finalSplitDetails.map((d) => d.userId);
        if (finalIncluded.length === 0) {
          setError('At least one member must have an allocated percentage.');
          setLoading(false);
          return;
        }
      }
    }

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          description: description.trim(),
          amount: numAmount,
          category,
          isPersonal: isPersonalSelected,
          paidBy: isPersonalSelected ? currentUserId : paidBy,
          includedMembers: finalIncluded,
          splitType: finalSplitType,
          splitDetails: finalSplitDetails,
          receiptImage: receiptImage || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add expense');
      }

      const raw = await res.json();
      const newExpense: ExpenseItem = {
        ...raw,
        _id: String(raw._id),
        isPersonal: Boolean(raw.isPersonal || raw.splitType === 'personal'),
        splitType: raw.splitType || 'equal',
        splitDetails: (raw.splitDetails || []).map((sd: any) => ({
          userId: sd.userId?._id ? String(sd.userId._id) : String(sd.userId || ''),
          amountOwed: sd.amountOwed || 0,
        })),
        receiptImage: raw.receiptImage || undefined,
        paidBy: {
          _id: raw.paidBy?._id ? String(raw.paidBy._id) : String(raw.paidBy || currentUserId),
          username: raw.paidBy?.username || (String(raw.paidBy) === String(currentUserId) ? 'You' : 'Member'),
          avatarId: raw.paidBy?.avatarId || 'avatar-fox.svg',
        },
      };

      setExpenses([newExpense, ...expenses]);
      setDescription('');
      setAmount('');
      setExactSplits({});
      setPercentageSplits({});
      setReceiptImage(null);
      setShowAddModal(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Error creating expense');
    } finally {
      setLoading(false);
    }
  }

  function openEditModal(expense: ExpenseItem) {
    if (expense.category === 'Settlement') {
      alert('Debt settlements cannot be edited. If this transfer was recorded in error, please delete it.');
      return;
    }
    setEditingExpense(expense);
    setEditDescription(expense.description);
    setEditAmount(String(expense.amount));
    setEditCategory(expense.category || 'Food & Dining');
    const isPersonal = Boolean(expense.isPersonal || expense.splitType === 'personal');
    setEditIsPersonal(isPersonal);
    setEditPaidBy(expense.paidBy?._id ? String(expense.paidBy._id) : currentUserId);
    setEditIncludedMembers(
      expense.includedMembers && expense.includedMembers.length > 0
        ? expense.includedMembers.map(String)
        : members.map((m) => String(m._id))
    );

    const sMode =
      expense.splitType === 'exact' || expense.splitType === 'percentage'
        ? expense.splitType
        : 'equal';
    setEditSplitMode(sMode);

    const initialExact: Record<string, string> = {};
    const initialPercent: Record<string, string> = {};

    if (expense.splitDetails && expense.splitDetails.length > 0) {
      expense.splitDetails.forEach((sd) => {
        initialExact[sd.userId] = String(sd.amountOwed);
        if (expense.amount > 0) {
          initialPercent[sd.userId] = String(
            Math.round((sd.amountOwed / expense.amount) * 1000) / 10
          );
        }
      });
    }
    setEditExactSplits(initialExact);
    setEditPercentageSplits(initialPercent);
    setEditReceiptImage(expense.receiptImage || null);
    setEditError('');
  }

  async function handleUpdateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!editingExpense || !editDescription.trim() || !editAmount || Number(editAmount) <= 0) return;

    setEditLoading(true);
    setEditError('');

    const numAmount = parseFloat(editAmount);
    let finalSplitType: 'equal' | 'exact' | 'percentage' | 'personal' = editIsPersonal
      ? 'personal'
      : editSplitMode;
    let finalSplitDetails: { userId: string; amountOwed: number }[] = [];
    let finalIncluded = editIsPersonal ? [currentUserId] : editIncludedMembers;

    if (!editIsPersonal) {
      if (editSplitMode === 'exact') {
        const exactSum = Object.values(editExactSplits).reduce(
          (sum, v) => sum + (parseFloat(v) || 0),
          0
        );
        if (Math.abs(exactSum - numAmount) > 0.05) {
          setEditError(
            `Exact splits sum (${formatMoney(exactSum, currency)}) does not match total expense amount (${formatMoney(numAmount, currency)}).`
          );
          setEditLoading(false);
          return;
        }
        finalSplitDetails = Object.entries(editExactSplits)
          .map(([uid, val]) => ({ userId: uid, amountOwed: parseFloat(val) || 0 }))
          .filter((d) => d.amountOwed > 0);
        finalIncluded = finalSplitDetails.map((d) => d.userId);
        if (finalIncluded.length === 0) {
          setEditError('At least one member must have an allocated amount.');
          setEditLoading(false);
          return;
        }
      } else if (editSplitMode === 'percentage') {
        const percentSum = Object.values(editPercentageSplits).reduce(
          (sum, v) => sum + (parseFloat(v) || 0),
          0
        );
        if (Math.abs(percentSum - 100) > 0.1) {
          setEditError(`Percentages sum (${percentSum.toFixed(1)}%) must equal 100%.`);
          setEditLoading(false);
          return;
        }
        finalSplitDetails = Object.entries(editPercentageSplits)
          .map(([uid, val]) => {
            const pct = parseFloat(val) || 0;
            return {
              userId: uid,
              amountOwed: Math.round((pct / 100) * numAmount * 100) / 100,
            };
          })
          .filter((d) => d.amountOwed > 0);
        finalIncluded = finalSplitDetails.map((d) => d.userId);
        if (finalIncluded.length === 0) {
          setEditError('At least one member must have an allocated percentage.');
          setEditLoading(false);
          return;
        }
      }
    }

    try {
      const res = await fetch(`/api/expenses/${editingExpense._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editDescription.trim(),
          amount: numAmount,
          category: editCategory,
          isPersonal: editIsPersonal,
          splitType: finalSplitType,
          splitDetails: finalSplitDetails,
          paidBy: editIsPersonal ? currentUserId : editPaidBy,
          includedMembers: finalIncluded,
          receiptImage: editReceiptImage || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update expense');
      }

      const raw = await res.json();
      const updated: ExpenseItem = {
        ...raw,
        _id: String(raw._id),
        isPersonal: Boolean(raw.isPersonal || raw.splitType === 'personal'),
        splitType: raw.splitType || 'equal',
        splitDetails: (raw.splitDetails || []).map((sd: any) => ({
          userId: sd.userId?._id ? String(sd.userId._id) : String(sd.userId || ''),
          amountOwed: sd.amountOwed || 0,
        })),
        receiptImage: raw.receiptImage || undefined,
        paidBy: {
          _id: raw.paidBy?._id ? String(raw.paidBy._id) : String(raw.paidBy || currentUserId),
          username: raw.paidBy?.username || 'Member',
          avatarId: raw.paidBy?.avatarId || 'avatar-fox.svg',
        },
      };

      setExpenses(expenses.map((e) => (e._id === updated._id ? updated : e)));
      setEditingExpense(null);
      if (selectedExpenseDetail && selectedExpenseDetail._id === updated._id) {
        setSelectedExpenseDetail(updated);
      }
      router.refresh();
    } catch (err: any) {
      setEditError(err.message || 'Error updating expense');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!confirm('Are you sure you want to remove this expense?')) return;

    try {
      const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
      if (res.ok) {
        setExpenses(expenses.filter((e) => e._id !== expenseId));
        if (editingExpense && editingExpense._id === expenseId) {
          setEditingExpense(null);
        }
        if (selectedExpenseDetail && selectedExpenseDetail._id === expenseId) {
          setSelectedExpenseDetail(null);
        }
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete expense');
      }
    } catch {
      alert('Failed to delete expense');
    }
  }

  const [settlingInProgress, setSettlingInProgress] = useState(false);
  const [settleSuccessMsg, setSettleSuccessMsg] = useState('');

  async function handleSettleSingle(tx: Transaction) {
    if (settlingInProgress) return;
    const debtor = memberMap.get(String(tx.from));
    const creditor = memberMap.get(String(tx.to));
    const debtorName = debtor?.username || 'Member';
    const creditorName = creditor?.username || 'Member';

    if (!confirm(`Confirm settlement: ${debtorName} pays ${formatMoney(tx.amount, currency)} to ${creditorName}?`)) {
      return;
    }

    setSettlingInProgress(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          description: `Settlement: ${debtorName} paid ${creditorName}`,
          amount: tx.amount,
          category: 'Settlement',
          paidBy: tx.from,
          includedMembers: [tx.to],
          splitType: 'equal',
          isPersonal: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to record settlement');
      }

      const created = await res.json();
      const newExp: ExpenseItem = {
        ...created,
        _id: String(created._id),
        isPersonal: false,
        category: 'Settlement',
        paidBy: {
          _id: String(tx.from),
          username: debtorName,
          avatarId: debtor?.avatarId || 'avatar-fox.svg',
        },
      };

      setExpenses((prev) => [newExp, ...prev]);
      setSettleSuccessMsg(`Settled ${formatMoney(tx.amount, currency)} between ${debtorName} and ${creditorName}!`);
      setTimeout(() => setSettleSuccessMsg(''), 4000);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Error recording settlement');
    } finally {
      setSettlingInProgress(false);
    }
  }

  async function handleSettleAll() {
    if (settlingInProgress || settlements.length === 0) return;

    const totalSettlementAmount = settlements.reduce((sum, tx) => sum + tx.amount, 0);
    if (
      !confirm(
        `Are you sure you want to settle all ${settlements.length} transactions (${formatMoney(
          totalSettlementAmount,
          currency
        )} total)? This will balance everyone in the trip.`
      )
    ) {
      return;
    }

    setSettlingInProgress(true);
    try {
      const newExpenses: ExpenseItem[] = [];

      for (const tx of settlements) {
        const debtor = memberMap.get(String(tx.from));
        const creditor = memberMap.get(String(tx.to));
        const debtorName = debtor?.username || 'Member';
        const creditorName = creditor?.username || 'Member';

        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId,
            description: `Settlement: ${debtorName} paid ${creditorName}`,
            amount: tx.amount,
            category: 'Settlement',
            paidBy: tx.from,
            includedMembers: [tx.to],
            splitType: 'equal',
            isPersonal: false,
          }),
        });

        if (res.ok) {
          const created = await res.json();
          newExpenses.push({
            ...created,
            _id: String(created._id),
            isPersonal: false,
            category: 'Settlement',
            paidBy: {
              _id: String(tx.from),
              username: debtorName,
              avatarId: debtor?.avatarId || 'avatar-fox.svg',
            },
          });
        }
      }

      if (newExpenses.length > 0) {
        setExpenses((prev) => [...newExpenses, ...prev]);
        setSettleSuccessMsg(`🎉 All ${newExpenses.length} transactions settled successfully!`);
        setTimeout(() => setSettleSuccessMsg(''), 5000);
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Error settling group balances');
    } finally {
      setSettlingInProgress(false);
    }
  }

  const payerMember = memberMap.get(String(paidBy));

  return (
    <div className="px-3 py-3 sm:px-6 sm:py-6 max-w-4xl mx-auto pb-24">
      {/* 1. Header with Currency & Dynamic Action Button */}
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <h1
            className="text-xl sm:text-3xl font-bold text-[#181c1a] tracking-tight truncate"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Money
          </h1>

          {/* Compact Currency Selector */}
          <select
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="text-xs font-semibold px-2.5 py-1 rounded-xl border border-gray-200 bg-white text-[#4a6454] shadow-2xs cursor-pointer outline-none shrink-0"
            title="Change trip currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>

          {/* Export Report Button */}
          <button
            type="button"
            onClick={handleExportReport}
            title="Download itemized CSV summary of expenses and settlements"
            className="px-2 sm:px-2.5 py-1 rounded-xl border border-gray-200 bg-white text-[#4a6454] hover:bg-[#f7faf6] text-xs font-semibold shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <span>📥</span>
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>

        {/* Dynamic Top Action Button */}
        {activeView === 'budget' ? (
          <button
            type="button"
            onClick={() => setShowAddBudgetModal(true)}
            className="bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs sm:text-sm font-semibold rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <span className="font-bold">+</span>
            <span>Add Budget</span>
          </button>
        ) : activeView === 'settle' ? (
          settlements.length > 0 && (
            <button
              type="button"
              onClick={handleSettleAll}
              disabled={settlingInProgress}
              className="bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs sm:text-sm font-semibold rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
            >
              <span>🤝 Settle All</span>
            </button>
          )
        ) : activeView === 'expenses' && expenseSubView === 'private-spends' ? (
          <button
            type="button"
            onClick={() => {
              setExpenseType('personal');
              setShowAddModal(true);
            }}
            className="bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs sm:text-sm font-semibold rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <span className="font-bold">+</span>
            <span>Add Private</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setExpenseType('shared');
              setShowAddModal(true);
            }}
            className="bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs sm:text-sm font-semibold rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <span className="font-bold">+</span>
            <span>Add Expense</span>
          </button>
        )}
      </div>

      {/* 2. Main View Switcher: Budget, Expenses, Settle Up */}
      <div className="grid grid-cols-3 bg-[#ecefeb] p-1 rounded-2xl mb-5 text-xs sm:text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveView('budget')}
          className={`py-2 px-1 text-center font-semibold rounded-xl transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer ${
            activeView === 'budget'
              ? 'bg-white text-[#181c1a] shadow-xs font-bold'
              : 'text-[#424843] hover:text-[#181c1a]'
          }`}
        >
          <span>🎯</span>
          <span>Budget</span>
          {budget?.items && budget.items.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#ccead5] text-[#183124]">
              {budget.items.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveView('expenses')}
          className={`py-2 px-1 text-center font-semibold rounded-xl transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer ${
            activeView === 'expenses'
              ? 'bg-white text-[#181c1a] shadow-xs font-bold'
              : 'text-[#424843] hover:text-[#181c1a]'
          }`}
        >
          <span>🧾</span>
          <span>Expenses</span>
          {expenses.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#ccead5] text-[#183124]">
              {expenses.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveView('settle')}
          className={`py-2 px-1 text-center font-semibold rounded-xl transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer ${
            activeView === 'settle'
              ? 'bg-white text-[#181c1a] shadow-xs font-bold'
              : 'text-[#424843] hover:text-[#181c1a]'
          }`}
        >
          <span>⚖️</span>
          <span>Settle Up</span>
          {settlements.length > 0 ? (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#ffdad6] text-[#ba1a1a]">
              {settlements.length}
            </span>
          ) : (
            <span className="text-[10px] text-emerald-600 font-bold">✓</span>
          )}
        </button>
      </div>

      {/* VIEW 1: Budget Hub */}
      {activeView === 'budget' && (
        <BudgetGuessingHub
          tripId={tripId}
          currentUserId={currentUserId}
          isCreator={isCreator}
          members={members}
          initialBudget={budget}
          totalActualSpend={totalTripSpend}
          currency={currency}
          personalBudget={personalBudget}
          myPersonalSpend={myPersonalSpend}
          onUpdatePersonalBudget={handleUpdatePersonalBudget}
          onBudgetUpdated={(updated) => setBudget(updated)}
          showAddModal={showAddBudgetModal}
          onCloseAddModal={() => setShowAddBudgetModal(false)}
        />
      )}

      {/* VIEW 2: Expenses View */}
      {activeView === 'expenses' && (
        <>
          {/* KPI Cards: Total Expenses & Your Net Position (Interactive quick jump) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
            <button
              type="button"
              onClick={() => setExpenseSubView('ledger')}
              className="text-left rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all cursor-pointer hover:border-[#4a6454]"
              style={{
                backgroundColor: '#ffffff',
                border: expenseSubView === 'ledger' ? '1.5px solid #4a6454' : '1px solid var(--color-border)',
                boxShadow: expenseSubView === 'ledger' ? '0 4px 16px -2px rgba(74,100,84,0.15)' : '0 4px 20px -2px rgba(26,30,28,0.04)',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium" style={{ color: 'rgba(26,30,28,0.5)' }}>
                  Total Expenses
                </p>
                <span className="text-[10px] font-semibold text-[#4a6454]">📜 Ledger</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold font-mono" style={{ color: '#1a1e1c' }}>
                {formatMoney(totalSharedSpend, currency)}
              </p>
              <p className="text-[0.6875rem] mt-1" style={{ color: 'rgba(26,30,28,0.45)' }}>
                {sharedExpenses.length} logged • Click to view
              </p>
            </button>

            <button
              type="button"
              onClick={() => setExpenseSubView('personal')}
              className="text-left rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all cursor-pointer hover:border-[#4a6454]"
              style={{
                backgroundColor: '#ffffff',
                border: expenseSubView === 'personal' ? '1.5px solid #4a6454' : '1px solid var(--color-border)',
                boxShadow: expenseSubView === 'personal' ? '0 4px 16px -2px rgba(74,100,84,0.15)' : '0 4px 20px -2px rgba(26,30,28,0.04)',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium" style={{ color: 'rgba(26,30,28,0.5)' }}>
                  Your Net Balance
                </p>
                <span className="text-[10px] font-semibold text-[#4a6454]">👤 You</span>
              </div>
              <p
                className="text-xl sm:text-2xl font-bold font-mono"
                style={{
                  color: netSharedPosition > 0.01 ? '#15803d' : netSharedPosition < -0.01 ? '#ba1a1a' : '#7e9a88',
                }}
              >
                {netSharedPosition > 0.01
                  ? `+${formatMoney(netSharedPosition, currency)}`
                  : netSharedPosition < -0.01
                  ? `-${formatMoney(Math.abs(netSharedPosition), currency)}`
                  : `${getCurrencySymbol(currency)}0`}
              </p>
              <p className="text-[0.6875rem] mt-1" style={{ color: 'rgba(26,30,28,0.45)' }}>
                {netSharedPosition > 0.01 ? 'You are owed' : netSharedPosition < -0.01 ? 'You owe money' : 'All squared up'} • Click to view
              </p>
            </button>
          </div>

          {/* Subview Navigation Pills inside Expenses: Personal Expense (Default) vs Group Ledger vs Private Spends */}
          <div className="flex bg-[#e8ece9] p-1 rounded-2xl mb-5 text-xs sm:text-sm font-semibold">
            <button
              type="button"
              onClick={() => setExpenseSubView('personal')}
              className="flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: expenseSubView === 'personal' ? '#ffffff' : 'transparent',
                color: expenseSubView === 'personal' ? '#183124' : 'rgba(26,30,28,0.6)',
                boxShadow: expenseSubView === 'personal' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <span>👤</span>
              <span>Personal Expense</span>
              {myLedgerTransactions.length > 0 && (
                <span className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full bg-[#ccead5] text-[#183124]">
                  {myLedgerTransactions.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setExpenseSubView('ledger')}
              className="flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: expenseSubView === 'ledger' ? '#ffffff' : 'transparent',
                color: expenseSubView === 'ledger' ? '#183124' : 'rgba(26,30,28,0.6)',
                boxShadow: expenseSubView === 'ledger' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <span>📜</span>
              <span>Group Ledger</span>
              {sharedExpenses.length > 0 && (
                <span className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full bg-[#ccead5] text-[#183124]">
                  {sharedExpenses.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setExpenseSubView('private-spends')}
              className="flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: expenseSubView === 'private-spends' ? '#ffffff' : 'transparent',
                color: expenseSubView === 'private-spends' ? '#183124' : 'rgba(26,30,28,0.6)',
                boxShadow: expenseSubView === 'private-spends' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <span>🔒</span>
              <span>Private Spends</span>
              {myPersonalExpenses.length > 0 && (
                <span className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full bg-[#ccead5] text-[#183124]">
                  {myPersonalExpenses.length}
                </span>
              )}
            </button>
          </div>

          {/* SUBVIEW 1: PERSONAL EXPENSE (User's Personal Share & Receivables) -> DEFAULT! */}
          {expenseSubView === 'personal' && (
            <div
              className="rounded-3xl p-4 sm:p-6 mb-6"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#f1f4f1]">
                <div>
                  <h2
                    className="text-base font-semibold flex items-center gap-2"
                    style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-charcoal)' }}
                  >
                    <span>👤</span>
                    <span>Personal Expense Share</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Your personal share of group expenses — what you owe in red, what you get back in green
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f1f4f1] text-gray-600">
                    {myLedgerTransactions.length} {myLedgerTransactions.length === 1 ? 'item' : 'items'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseType('shared');
                      setShowAddModal(true);
                    }}
                    className="bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs font-semibold rounded-xl px-3 py-1.5 shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <span>+</span>
                    <span>Add Expense</span>
                  </button>
                </div>
              </div>

              {/* Quick Search if more than 3 transactions */}
              {myLedgerTransactions.length > 3 && (
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      placeholder="Search personal expenses by title or member..."
                      className="w-full text-xs pl-8 pr-8 py-2 rounded-xl bg-[#f7faf6] border border-gray-200 outline-none focus:border-[#4a6454] transition-colors"
                    />
                    <span className="absolute left-2.5 top-2 text-xs text-gray-400">🔍</span>
                    {ledgerSearch && (
                      <button
                        type="button"
                        onClick={() => setLedgerSearch('')}
                        className="absolute right-2.5 top-2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}

              {filteredMyLedgerTransactions.length === 0 ? (
                <div className="py-8 text-center text-[#424843]">
                  <p className="text-3xl mb-2">{ledgerSearch ? '🔍' : '🏖️'}</p>
                  <p className="text-sm font-semibold text-[#181c1a]">
                    {ledgerSearch ? 'No matching personal expenses' : 'No personal group expenses yet'}
                  </p>
                  <p className="text-xs mt-1 max-w-xs mx-auto text-gray-500">
                    {ledgerSearch
                      ? `No personal transactions matched "${ledgerSearch}"`
                      : 'When group expenses involving you are logged, your personal share to pay or get back will appear here.'}
                  </p>
                  {!ledgerSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpenseType('shared');
                        setShowAddModal(true);
                      }}
                      className="mt-3.5 px-4 py-2 bg-[#4a6454] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#3d5345] cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    >
                      <span>+</span>
                      <span>Log an Expense</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-[#e4e5e0] divide-y divide-[#f1f4f1] overflow-hidden shadow-2xs">
                    {filteredMyLedgerTransactions.map((tx) => {
                      const icon =
                        CATEGORY_ICON_MAP[tx.expense.category || ''] ||
                        CATEGORY_ICON_MAP[tx.expense.description] ||
                        '🧾';
                      const isOwe = tx.netImpact < 0;
                      const date = new Date(tx.expense.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      });

                      return (
                        <div
                          key={tx.expense._id}
                          onClick={() => setSelectedExpenseDetail(tx.expense)}
                          className="p-3 sm:p-3.5 flex items-center justify-between hover:bg-[#f7faf6] cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[#f1f4f1] flex items-center justify-center text-base shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                              {icon}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs sm:text-sm font-semibold text-[#181c1a] truncate">
                                {tx.expense.description}
                              </span>
                              <span className="text-[10px] sm:text-[11px] text-[#424843] truncate mt-0.5">
                                {isOwe ? (
                                  <span>
                                    Paid by <strong className="text-[#181c1a]">{tx.payerName}</strong> ({formatMoney(tx.expense.amount, currency)}) •{' '}
                                    <span className="text-[#ba1a1a] font-medium">To pay {tx.payerName}</span> • {date}
                                  </span>
                                ) : (
                                  <span>
                                    You paid {formatMoney(tx.expense.amount, currency)} •{' '}
                                    <span className="text-[#2e7d32] font-medium">
                                      Get back from {tx.otherMembers.length > 0 ? tx.otherMembers.join(', ') : 'group'}
                                    </span> • {date}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 pl-2 text-right">
                            {isOwe ? (
                              <div className="flex flex-col items-end">
                                <span className="text-xs sm:text-sm font-bold font-mono text-[#ba1a1a]">
                                  -{formatMoney(tx.myShare, currency)}
                                </span>
                                <span className="text-[9px] text-[#ba1a1a] font-semibold uppercase tracking-wider">
                                  to pay
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span className="text-xs sm:text-sm font-bold font-mono text-[#2e7d32]">
                                  +{formatMoney(tx.getBack, currency)}
                                </span>
                                <span className="text-[9px] text-[#2e7d32] font-semibold uppercase tracking-wider">
                                  to get
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Total Card: Red for to pay, Green for to get, Total Net Balance */}
                  <div className="bg-[#f7faf6] rounded-2xl p-4 sm:p-5 border border-[#e4e5e0] shadow-2xs">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div>
                          <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider block">
                            Total To Pay
                          </span>
                          <span className="text-base sm:text-xl font-bold font-mono text-[#ba1a1a]">
                            -{formatMoney(totalToPay, currency)}
                          </span>
                          <span className="text-[10px] text-gray-400 block">your share owed</span>
                        </div>

                        <div className="border-l border-gray-200 pl-4 sm:pl-6">
                          <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider block">
                            Total To Get
                          </span>
                          <span className="text-base sm:text-xl font-bold font-mono text-[#2e7d32]">
                            +{formatMoney(totalToGet, currency)}
                          </span>
                          <span className="text-[10px] text-gray-400 block">receivable from group</span>
                        </div>
                      </div>

                      <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-gray-200 pt-3 sm:pt-0 sm:pl-6">
                        <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider block">
                          Net Balance
                        </span>
                        <span
                          className={`text-lg sm:text-2xl font-extrabold font-mono ${
                            netSharedPosition < -0.01
                              ? 'text-[#ba1a1a]'
                              : netSharedPosition > 0.01
                              ? 'text-[#2e7d32]'
                              : 'text-[#4a6454]'
                          }`}
                        >
                          {netSharedPosition < -0.01
                            ? `-${formatMoney(Math.abs(netSharedPosition), currency)}`
                            : netSharedPosition > 0.01
                            ? `+${formatMoney(netSharedPosition, currency)}`
                            : `${getCurrencySymbol(currency)}0`}
                        </span>
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                            netSharedPosition < -0.01
                              ? 'bg-[#ffdad6] text-[#ba1a1a]'
                              : netSharedPosition > 0.01
                              ? 'bg-[#dcfce7] text-[#15803d]'
                              : 'bg-[#f1f4f1] text-[#4a6454]'
                          }`}
                        >
                          {netSharedPosition < -0.01
                            ? 'You owe money'
                            : netSharedPosition > 0.01
                            ? 'You are owed'
                            : 'All squared up'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUBVIEW 2: GROUP EXPENSE LEDGER */}
          {expenseSubView === 'ledger' && (
            <div
              className="rounded-3xl p-5 sm:p-6 mb-6"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#f1f4f1]">
                <div>
                  <h2
                    className="text-base font-semibold"
                    style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-charcoal)' }}
                  >
                    📜 Group Expense Ledger
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {expenses.length} shared {expenses.length === 1 ? 'expense' : 'expenses'} logged across group
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="text-white text-xs font-medium rounded-xl px-3.5 py-2 transition-all cursor-pointer hover:opacity-90 self-start sm:self-auto flex items-center gap-1.5"
                  style={{
                    backgroundColor: '#4a6454',
                    boxShadow: '0 2px 8px -1px rgba(74,100,84,0.25)',
                  }}
                >
                  <span>+</span>
                  <span>Add Expense</span>
                </button>
              </div>

              {/* Quick Search & Filter Chips */}
              <div className="mb-4 space-y-2.5">
                {expenses.length > 3 && (
                  <div className="relative">
                    <input
                      type="text"
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      placeholder="Search expenses by title or payer..."
                      className="w-full text-xs pl-8 pr-8 py-2 rounded-xl bg-[#f7faf6] border border-gray-200 outline-none focus:border-[#4a6454] transition-colors"
                    />
                    <span className="absolute left-2.5 top-2 text-xs text-gray-400">🔍</span>
                    {ledgerSearch && (
                      <button
                        type="button"
                        onClick={() => setLedgerSearch('')}
                        className="absolute right-2.5 top-2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* Quick Filter Chips (Category & Payer) */}
                {(availableCategories.length > 1 || availablePayers.length > 1) && (
                  <div className="flex flex-col gap-2 pt-1 pb-1">
                    {/* Category Filter Chips */}
                    {availableCategories.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 shrink-0">Category:</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCategoryFilter('all')}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                            selectedCategoryFilter === 'all'
                              ? 'bg-[#4a6454] text-white shadow-2xs font-semibold'
                              : 'bg-[#f1f4f1] text-gray-600 hover:bg-[#e4e8e4]'
                          }`}
                        >
                          All
                        </button>
                        {availableCategories.map((cat) => {
                          const icon = CATEGORY_ICON_MAP[cat] || '🧾';
                          const isActive = selectedCategoryFilter === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedCategoryFilter(isActive ? 'all' : cat)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                                isActive
                                  ? 'bg-[#4a6454] text-white shadow-2xs font-semibold'
                                  : 'bg-[#f1f4f1] text-gray-700 hover:bg-[#e4e8e4]'
                              }`}
                            >
                              <span>{icon}</span>
                              <span>{cat}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Payer Filter Chips */}
                    {availablePayers.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 shrink-0">Paid by:</span>
                        <button
                          type="button"
                          onClick={() => setSelectedPayerFilter('all')}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                            selectedPayerFilter === 'all'
                              ? 'bg-[#4a6454] text-white shadow-2xs font-semibold'
                              : 'bg-[#f1f4f1] text-gray-600 hover:bg-[#e4e8e4]'
                          }`}
                        >
                          All
                        </button>
                        {availablePayers.map((payer) => {
                          const isActive = selectedPayerFilter === payer.id;
                          return (
                            <button
                              key={payer.id}
                              type="button"
                              onClick={() => setSelectedPayerFilter(isActive ? 'all' : payer.id)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                                isActive
                                  ? 'bg-[#4a6454] text-white shadow-2xs font-semibold'
                                  : 'bg-[#f1f4f1] text-gray-700 hover:bg-[#e4e8e4]'
                              }`}
                            >
                              <span>{getAvatarEmoji(payer.avatarId)}</span>
                              <span>{payer.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {filteredSharedExpenses.length === 0 ? (
                <div className="py-8 text-center" style={{ color: 'rgba(26,30,28,0.45)' }}>
                  <p className="text-2xl mb-1">{ledgerSearch || selectedCategoryFilter !== 'all' || selectedPayerFilter !== 'all' ? '🔍' : '💸'}</p>
                  <p className="text-sm font-medium">
                    {ledgerSearch || selectedCategoryFilter !== 'all' || selectedPayerFilter !== 'all' ? 'No matching expenses found' : 'No expenses logged yet'}
                  </p>
                  <p className="text-xs mt-0.5">
                    {ledgerSearch || selectedCategoryFilter !== 'all' || selectedPayerFilter !== 'all'
                      ? 'No expenses matched your search and filter criteria.'
                      : 'Click "+ Add Expense" above to record your first shared expense.'}
                  </p>
                  {(ledgerSearch || selectedCategoryFilter !== 'all' || selectedPayerFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerSearch('');
                        setSelectedCategoryFilter('all');
                        setSelectedPayerFilter('all');
                      }}
                      className="mt-2 text-xs text-[#4a6454] font-medium hover:underline cursor-pointer"
                    >
                      Clear search & filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[#f1f4f1]">
                  {filteredSharedExpenses.map((expense) => {
                    const date = new Date(expense.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    });
                    const participatingCount =
                      expense.includedMembers && expense.includedMembers.length > 0
                        ? expense.includedMembers.length
                        : members.length;

                    return (
                      <div
                        key={expense._id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between first:pt-0 last:pb-0 gap-3"
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg select-none shrink-0"
                            style={{
                              backgroundColor: '#f7faf6',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            {getAvatarEmoji(expense.paidBy?.avatarId)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-charcoal)' }}>
                                {expense.description}
                              </p>
                              {expense.category === 'Settlement' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#eef1ee] text-[#183124] border border-[#ccead5]">
                                  [Transfer]
                                </span>
                              )}
                              {expense.splitType === 'exact' && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-[#e0f2fe] text-[#0369a1]">
                                  Exact Split
                                </span>
                              )}
                              {expense.splitType === 'percentage' && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-[#fef3c7] text-[#92400e]">
                                  % Split
                                </span>
                              )}
                              {expense.receiptImage && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveReceiptModalUrl(expense.receiptImage || null);
                                  }}
                                  className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-[#f3f4f6] text-gray-700 hover:bg-[#e5e7eb] border border-gray-200 flex items-center gap-0.5 cursor-pointer"
                                  title="View Receipt"
                                >
                                  <span>📷</span>
                                  <span>Receipt</span>
                                </button>
                              )}
                            </div>
                            <p className="text-xs truncate" style={{ color: 'rgba(26,30,28,0.5)' }}>
                              Paid by <span className="font-semibold text-[#4a6454]">{expense.paidBy?.username || 'Member'}</span> • {date}
                            </p>
                            {/* Participant breakdown badge & avatars */}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[0.6875rem] font-medium text-gray-500">
                                Split ({participatingCount} of {members.length}):
                              </span>
                              <div className="flex -space-x-1 items-center">
                                {members
                                  .filter((m) =>
                                    expense.includedMembers && expense.includedMembers.length > 0
                                      ? expense.includedMembers.includes(m._id)
                                      : true
                                  )
                                  .map((m) => (
                                    <span
                                      key={m._id}
                                      className="w-4 h-4 rounded-full bg-gray-100 border border-white text-[9px] flex items-center justify-center select-none"
                                      title={m.username}
                                    >
                                      {getAvatarEmoji(m.avatarId)}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                          <span className="text-sm sm:text-base font-bold font-mono" style={{ color: 'var(--color-charcoal)' }}>
                            {formatMoney(expense.amount, currency)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {expense.category !== 'Settlement' ? (
                              <button
                                onClick={() => openEditModal(expense)}
                                title="Edit expense details and participants"
                                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span>✏️</span>
                                <span className="hidden sm:inline">Edit</span>
                              </button>
                            ) : (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#eef1ee] text-[#183124] border border-[#ccead5]"
                                title="Recorded debt settlement transfer (read-only receipt)"
                              >
                                🤝 [Transfer]
                              </span>
                            )}

                            <button
                              onClick={() => handleDeleteExpense(expense._id)}
                              title={expense.category === 'Settlement' ? 'Delete recorded settlement' : 'Remove expense from ledger'}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-100 hover:bg-red-50 text-red-600 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <span>🗑️</span>
                              <span className="hidden sm:inline">{expense.category === 'Settlement' ? 'Delete' : 'Remove'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUBVIEW 3: PRIVATE SPENDS (User's Private Solo Pocket Spends) */}
          {expenseSubView === 'private-spends' && (
            <div className="space-y-4">
              {/* Private Spends Card */}
              <div
                className="rounded-3xl p-5 sm:p-6 bg-white border border-[#e4e5e0] shadow-2xs flex flex-col space-y-3"
              >
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#7e9a88]">
                      PRIVATE SPENDS (SOLO)
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span
                        className="text-xl sm:text-3xl font-bold font-mono text-[#181c1a]"
                        style={{ fontFamily: 'var(--font-heading)' }}
                      >
                        {formatMoney(myPersonalSpend, currency)}
                      </span>
                      <span className="text-xs text-[#424843]">total private spent</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveView('budget')}
                    className="text-xs font-semibold text-[#4a6454] hover:underline cursor-pointer"
                  >
                    View Budget Limit in Budget Tab →
                  </button>
                </div>

                {personalBudget > 0 ? (
                  <div className="space-y-1.5 pt-2 border-t border-[#f1f4f1]">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#424843]">
                        Target Limit: <strong>{formatMoney(personalBudget, currency)}</strong>
                      </span>
                      <span
                        className={`font-semibold ${
                          personalBudget - myPersonalSpend >= 0 ? 'text-[#4a6454]' : 'text-red-600'
                        }`}
                      >
                        {personalBudget - myPersonalSpend >= 0
                          ? `${formatMoney(personalBudget - myPersonalSpend, currency)} remaining`
                          : `${formatMoney(Math.abs(personalBudget - myPersonalSpend), currency)} over`}
                      </span>
                    </div>
                    <div className="h-1.5 sm:h-2 w-full bg-[#ecefeb] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          personalBudget - myPersonalSpend >= 0 ? 'bg-[#4a6454]' : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (myPersonalSpend / personalBudget) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 pt-1.5 border-t border-[#f1f4f1]">
                    💡 Set a private spending target inside the <strong>Budget</strong> section to monitor your personal pocket.
                  </p>
                )}
              </div>

              {/* Private Spends List */}
              {groupedPersonalExpenses.length === 0 ? (
                <div className="py-8 text-center bg-white rounded-3xl p-6 border border-[#e4e5e0] text-[#424843]">
                  <p className="text-3xl mb-2">💳</p>
                  <p className="text-sm font-semibold text-[#181c1a]">No private expenses recorded</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto text-gray-500">
                    Private spends are purchases you buy solely for yourself (souvenirs, snacks) and are kept 100% separate from group balances.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseType('personal');
                      setShowAddModal(true);
                    }}
                    className="mt-3.5 px-4 py-2 bg-[#4a6454] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#3d5345] cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                  >
                    <span>+</span>
                    <span>Log Private Spend</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {groupedPersonalExpenses.map((group) => (
                    <div key={group.dateKey} className="space-y-1.5">
                      <div className="flex items-center justify-between px-1.5 text-[11px] sm:text-xs font-bold text-[#424843] uppercase tracking-wider">
                        <span>{group.dateLabel}</span>
                        <span className="font-mono text-[#181c1a]">
                          {formatMoney(group.totalForDay, currency)}
                        </span>
                      </div>

                      <div className="bg-white rounded-2xl border border-[#e4e5e0] divide-y divide-[#f1f4f1] overflow-hidden shadow-2xs">
                        {group.items.map((exp) => {
                          const icon =
                            CATEGORY_ICON_MAP[exp.category || ''] ||
                            CATEGORY_ICON_MAP[exp.description] ||
                            '🧾';

                          return (
                            <div
                              key={exp._id}
                              onClick={() => setSelectedExpenseDetail(exp)}
                              className="p-3 sm:p-3.5 flex items-center justify-between hover:bg-[#f7faf6] cursor-pointer transition-colors group"
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-[#f1f4f1] flex items-center justify-center text-base shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                                  {icon}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs sm:text-sm font-semibold text-[#181c1a] truncate">
                                    {exp.description}
                                  </span>
                                  <span className="text-[10px] sm:text-[11px] text-[#7e9a88] truncate font-medium">
                                    Personal Fund • {exp.category || 'Misc'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 pl-2">
                                <span className="text-xs sm:text-sm font-bold font-mono text-[#181c1a]">
                                  -{formatMoney(exp.amount, currency)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteExpense(exp._id);
                                  }}
                                  className="text-xs text-red-500 hover:text-red-700 p-1 cursor-pointer"
                                  title="Delete private spend"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* VIEW 3: Settle Up */}
      {activeView === 'settle' && (
        <div
          className="rounded-3xl p-5 sm:p-6 mb-6"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
          }}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f4f1] gap-2 flex-wrap">
            <div>
              <h2
                className="text-base font-semibold"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-charcoal)' }}
              >
                ⚖️ Settle Up (Optimized Debts)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Minimal direct transfers required to settle all shared debts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f1f4f1] text-gray-600">
                {settlements.length} {settlements.length === 1 ? 'payment' : 'payments'}
              </span>
              {settlements.length > 0 && (
                <button
                  type="button"
                  onClick={handleSettleAll}
                  disabled={settlingInProgress}
                  className="bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs font-semibold rounded-lg px-2.5 py-1 shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <span>🤝 Settle All</span>
                </button>
              )}
            </div>
          </div>

          {/* Settlement Success Notification */}
          {settleSuccessMsg && (
            <div className="mb-3 p-3 rounded-xl bg-[#eef1ee] border border-[#ccead5] text-[#183124] text-xs font-semibold flex items-center gap-2 shadow-2xs">
              <span>✓</span>
              <span>{settleSuccessMsg}</span>
            </div>
          )}

          {settlements.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-sm font-semibold" style={{ color: '#4a6454' }}>
                All balances are settled!
              </p>
              <p className="text-xs mt-1 text-gray-500">
                No outstanding peer-to-peer transfers needed. Everyone is all squared up!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {settlements.map((tx, idx) => {
                const debtor = memberMap.get(String(tx.from));
                const creditor = memberMap.get(String(tx.to));
                const isMyDebt = String(tx.from) === String(currentUserId);
                const isOwedToMe = String(tx.to) === String(currentUserId);

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 rounded-2xl"
                    style={{
                      backgroundColor: isMyDebt ? '#fff5f4' : isOwedToMe ? '#f0f9f3' : '#f7faf6',
                      border: isMyDebt ? '1.5px solid #ffdad6' : isOwedToMe ? '1.5px solid #b0cdba' : '1px solid var(--color-border)',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base sm:text-lg">{getAvatarEmoji(debtor?.avatarId)}</span>
                      <span className="text-xs sm:text-sm font-semibold truncate" style={{ color: 'var(--color-charcoal)' }}>
                        {debtor?.username || 'Member'}
                        {isMyDebt && <span className="ml-1 text-[10px] text-red-600 font-bold">(You)</span>}
                      </span>
                      <span className="text-xs font-medium text-[#7e9a88] mx-1">pays →</span>
                      <span className="text-base sm:text-lg">{getAvatarEmoji(creditor?.avatarId)}</span>
                      <span className="text-xs sm:text-sm font-semibold truncate" style={{ color: 'var(--color-charcoal)' }}>
                        {creditor?.username || 'Member'}
                        {isOwedToMe && <span className="ml-1 text-[10px] text-green-700 font-bold">(You)</span>}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-xs sm:text-sm font-bold font-mono whitespace-nowrap pl-2"
                        style={{ color: isMyDebt ? '#ba1a1a' : isOwedToMe ? '#226338' : '#4a6454' }}
                      >
                        {isMyDebt ? `-${formatMoney(tx.amount, currency)}` : isOwedToMe ? `+${formatMoney(tx.amount, currency)}` : formatMoney(tx.amount, currency)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleSettleSingle(tx)}
                        disabled={settlingInProgress}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-[#4a6454] text-[#4a6454] hover:bg-[#4a6454] hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                        title={`Settle ${formatMoney(tx.amount, currency)} transfer`}
                      >
                        Settle ✓
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Past Settled Payments History */}
          {pastSettlements.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#f1f4f1]">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#7e9a88] block mb-2">
                Past Settled Payments ({pastSettlements.length})
              </span>
              <div className="space-y-1.5">
                {pastSettlements.slice(0, 5).map((exp) => (
                  <div
                    key={exp._id}
                    onClick={() => setSelectedExpenseDetail(exp)}
                    className="p-2 sm:p-2.5 rounded-lg bg-[#f7faf6] border border-[#e4e5e0] flex items-center justify-between text-xs cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">🤝</span>
                      <span className="text-xs font-medium text-[#181c1a]">{exp.description}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[#4a6454] text-xs font-semibold">
                      <span>✓ {formatMoney(exp.amount, currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. EXPENSE DETAILS MODAL (Stitch screen 4650) */}
      {selectedExpenseDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div
            className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto border border-[#e4e5e0] animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-3 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f1f4f1]">
              <h3
                className="text-base sm:text-lg font-bold text-[#181c1a]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Expense Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedExpenseDetail(null)}
                className="w-7 h-7 rounded-full bg-[#ecefeb] flex items-center justify-center text-xs text-[#424843] hover:text-[#181c1a] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Hero Section */}
            <div className="flex flex-col items-center justify-center text-center py-1.5 mb-3">
              <div className="w-12 h-12 rounded-xl bg-[#f1f4f1] flex items-center justify-center text-xl shadow-2xs mb-1.5">
                {CATEGORY_ICON_MAP[selectedExpenseDetail.category || ''] || '🧾'}
              </div>
              <span
                className="text-xl sm:text-2xl font-bold font-mono text-[#181c1a]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {formatMoney(selectedExpenseDetail.amount, currency)}
              </span>
              <p className="text-xs sm:text-sm font-semibold text-[#181c1a] mt-0.5">
                {selectedExpenseDetail.description}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
                <span
                  className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    selectedExpenseDetail.category === 'Settlement'
                      ? 'bg-[#eef1ee] text-[#183124] border border-[#ccead5]'
                      : selectedExpenseDetail.isPersonal || selectedExpenseDetail.splitType === 'personal'
                      ? 'bg-[#ecefeb] text-[#424843]'
                      : 'bg-[#c3e0fd]/60 text-[#45617a]'
                  }`}
                >
                  ● {selectedExpenseDetail.category === 'Settlement'
                      ? 'Settlement Transfer [Receipt]'
                      : selectedExpenseDetail.isPersonal || selectedExpenseDetail.splitType === 'personal'
                      ? 'Private spend (solo)'
                      : `Shared (${selectedExpenseDetail.splitType || 'equal'})`}
                </span>
                {selectedExpenseDetail.receiptImage && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f3f4f6] text-gray-700 border border-gray-200 flex items-center gap-1">
                    <span>📷</span>
                    <span>Receipt Attached</span>
                  </span>
                )}
              </div>
            </div>

            {/* Receipt Preview if attached */}
            {selectedExpenseDetail.receiptImage && (
              <div className="mb-3 p-2.5 rounded-xl bg-[#f7faf6] border border-[#e4e5e0] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={selectedExpenseDetail.receiptImage}
                    alt="Receipt thumbnail"
                    className="w-12 h-12 object-cover rounded-lg cursor-pointer border border-gray-200 hover:opacity-90"
                    onClick={() => setActiveReceiptModalUrl(selectedExpenseDetail.receiptImage || null)}
                  />
                  <div className="text-xs min-w-0">
                    <span className="font-semibold text-gray-800 block truncate">Receipt Document</span>
                    <span className="text-[10px] text-gray-400">Click to view full photo</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveReceiptModalUrl(selectedExpenseDetail.receiptImage || null)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-[#4a6454] hover:bg-gray-50 cursor-pointer shadow-2xs shrink-0"
                >
                  View 🔍
                </button>
              </div>
            )}

            {/* Metadata Summary Card */}
            <div className="bg-[#f7faf6] rounded-xl p-3 border border-[#e4e5e0] space-y-2 mb-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#424843]">Paid by</span>
                <span className="font-semibold text-[#181c1a] flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#ccead5] text-[#062014] text-[10px] font-bold flex items-center justify-center">
                    {(selectedExpenseDetail.paidBy?.username || 'M').slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    {(selectedExpenseDetail.paidBy?._id ? String(selectedExpenseDetail.paidBy._id) : String(selectedExpenseDetail.paidBy)) === String(currentUserId)
                      ? `${selectedExpenseDetail.paidBy?.username || 'You'} (You)`
                      : selectedExpenseDetail.paidBy?.username || 'Member'}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#ecefeb] pt-1.5">
                <span className="text-[#424843]">Category</span>
                <span className="font-semibold text-[#181c1a]">
                  {selectedExpenseDetail.category || 'Misc'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#ecefeb] pt-1.5">
                <span className="text-[#424843]">Date & Time</span>
                <span className="font-semibold text-[#181c1a] text-right">
                  <span>
                    {new Date(selectedExpenseDetail.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-gray-400 mx-1.5">•</span>
                  <span>
                    {new Date(selectedExpenseDetail.timestamp).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </span>
              </div>
            </div>

            {/* Participants Breakdown (Only if Shared) */}
            {!(selectedExpenseDetail.isPersonal || selectedExpenseDetail.splitType === 'personal') ? (
              <div className="mb-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs sm:text-sm font-bold text-[#181c1a]"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    Participants
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ecefeb] text-[#424843]">
                    {selectedExpenseDetail.splitType || 'equal'} split
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-[#e4e5e0] divide-y divide-[#f1f4f1] overflow-hidden">
                  {members
                    .filter((m) =>
                      selectedExpenseDetail.includedMembers && selectedExpenseDetail.includedMembers.length > 0
                        ? selectedExpenseDetail.includedMembers.map(String).includes(String(m._id))
                        : true
                    )
                    .map((m) => {
                      const isPayer = String(m._id) === String(selectedExpenseDetail.paidBy?._id || selectedExpenseDetail.paidBy);
                      const isYou = String(m._id) === String(currentUserId);
                      const count = selectedExpenseDetail.includedMembers?.length || members.length;
                      const splitVal = getExpenseUserOwed(selectedExpenseDetail, m._id, count);

                      return (
                        <div
                          key={m._id}
                          className={`p-2.5 flex items-center justify-between text-xs ${
                            isYou ? 'bg-[#ccead5]/20' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#ecefeb] text-[10px] font-bold flex items-center justify-center">
                              {m.username.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="flex flex-col">
                              <span className="font-semibold text-[#181c1a]">
                                {m.username} {isYou ? '(You)' : ''}
                              </span>
                              <span className="text-[9px] text-[#424843]">
                                {isPayer ? 'Payer' : isYou ? 'Your share' : 'Member'}
                              </span>
                            </div>
                          </div>

                          <span className="font-bold font-mono text-[#181c1a] text-xs">
                            {formatMoney(splitVal, currency)}
                          </span>
                        </div>
                      );
                    })}
                </div>
                <p className="text-[10px] text-[#424843] text-center pt-0.5">
                  {(selectedExpenseDetail.includedMembers?.length || members.length)} participants · {selectedExpenseDetail.splitType || 'equal'} split
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-[#f1f4f1]/60 text-xs text-[#424843] mb-3 text-center">
                This is a private personal expense. It does not affect group balances.
              </div>
            )}

            {/* Actions: Edit & Delete */}
            <div className="flex items-center gap-2 pt-1">
              {selectedExpenseDetail.category === 'Settlement' ? (
                <div className="flex-1 py-2 px-3 rounded-xl bg-gray-50 border border-gray-200 text-[11px] text-gray-500 text-center font-medium">
                  🔒 Settlement transaction (cannot be edited)
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const exp = selectedExpenseDetail;
                    setSelectedExpenseDetail(null);
                    openEditModal(exp);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-[#181c1a] flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                >
                  <span>✏️</span>
                  <span>Edit expense</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDeleteExpense(selectedExpenseDetail._id)}
                className="flex-1 py-2 px-3 rounded-xl bg-[#ffdad6] hover:bg-[#ffcdd2] text-[#ba1a1a] text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
              >
                <span>🗑️</span>
                <span>{selectedExpenseDetail.category === 'Settlement' ? 'Delete settlement' : 'Delete expense'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADD EXPENSE MODAL (Stitch screen 5782) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-3xl p-4 sm:p-6 bg-white shadow-2xl max-h-[90vh] overflow-y-auto border border-[#e4e5e0] animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-3 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f1f4f1]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#ecefeb] flex items-center justify-center text-[#4a6454] font-bold text-sm">
                  +
                </div>
                <div>
                  <h3
                    className="text-sm sm:text-base font-bold text-[#181c1a]"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    Add Expense
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-[#424843]">
                    {expenseType === 'shared' ? 'Shared with Group' : 'Private Spend (Solo)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs bg-gray-100 hover:bg-gray-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode Toggle: Shared vs Private */}
            <div className="w-full bg-[#ecefeb] p-0.5 rounded-xl flex items-center justify-between mb-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setExpenseType('shared')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  expenseType === 'shared'
                    ? 'bg-white text-[#181c1a] shadow-xs'
                    : 'text-[#424843]'
                }`}
              >
                <span>👥</span>
                <span>Shared Expense</span>
              </button>
              <button
                type="button"
                onClick={() => setExpenseType('personal')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  expenseType === 'personal'
                    ? 'bg-white text-[#181c1a] shadow-xs'
                    : 'text-[#424843]'
                }`}
              >
                <span>💳</span>
                <span>Private Spends</span>
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="flex flex-col space-y-4">
              {/* Amount Hero Input */}
              <div className="bg-[#f7faf6] rounded-2xl p-4 border border-[#e4e5e0] text-center">
                <span className="text-[11px] font-semibold text-[#424843] uppercase tracking-wider block mb-1">
                  AMOUNT • {currency} ({currSymbol})
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-bold font-mono text-gray-400">{currSymbol}</span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="2400"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    autoFocus
                    className="w-48 text-center text-3xl sm:text-4xl font-bold font-mono text-[#181c1a] bg-transparent outline-none"
                  />
                </div>
              </div>

              {/* Expense Title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    EXPENSE TITLE *
                  </label>
                  {description.trim().length > 0 && (
                    <span className="text-[11px] text-[#4a6454] font-semibold flex items-center gap-0.5">
                      ✓ Valid
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={expenseType === 'personal' ? 'e.g. Handmade souvenir, personal snack' : 'e.g. Dinner at Old Manali Dhaba'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full text-xs sm:text-sm px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:border-[#4a6454] transition-colors"
                />
              </div>

              {/* Category Grid (2x3 Selectable Tiles, Stitch screen 5782) */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block uppercase tracking-wider">
                  CATEGORY
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`p-2.5 rounded-2xl border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#4a6454] bg-[#ccead5]/30 text-[#183124] font-semibold ring-1 ring-[#4a6454]'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-[11px] leading-tight truncate w-full">
                          {cat.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paid By Selector (Only for Shared) */}
              {expenseType === 'shared' ? (
                <div className="bg-[#f7faf6] rounded-2xl p-3.5 border border-[#e4e5e0]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <label className="text-xs font-semibold text-[#181c1a] uppercase tracking-wider block">
                        PAID BY
                      </label>
                      <span className="text-[10px] text-[#424843]">The person who paid the vendor</span>
                    </div>
                    <select
                      value={paidBy}
                      onChange={(e) => setPaidBy(e.target.value)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 bg-white outline-none cursor-pointer"
                    >
                      {members.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.username} {m._id === currentUserId ? '(You)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-[#4a6454] mt-1 flex items-center gap-1">
                    <span>●</span>
                    <span>
                      {payerMember?.username || 'Payer'} will be reimbursed according to participants&apos; shares
                    </span>
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-[#f1f4f1]/80 border border-[#e4e5e0] text-xs text-[#183124]">
                  💡 <strong>Private Spends:</strong> Paid strictly by you. This reduces only your Private Spends target and is completely separate from group settlements.
                </div>
              )}

              {/* Split Mode and Allocation (Only for Shared) */}
              {expenseType === 'shared' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block">
                        SPLIT TYPE
                      </label>
                      <span className="text-[10px] text-gray-500">How should this cost be divided?</span>
                    </div>

                    <div className="flex bg-[#ecefeb] p-0.5 rounded-xl text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setSplitMode('equal')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          splitMode === 'equal' ? 'bg-white text-[#181c1a] shadow-xs' : 'text-gray-600'
                        }`}
                      >
                        Equal
                      </button>
                      <button
                        type="button"
                        onClick={() => setSplitMode('exact')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          splitMode === 'exact' ? 'bg-white text-[#181c1a] shadow-xs' : 'text-gray-600'
                        }`}
                      >
                        Exact
                      </button>
                      <button
                        type="button"
                        onClick={() => setSplitMode('percentage')}
                        className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          splitMode === 'percentage' ? 'bg-white text-[#181c1a] shadow-xs' : 'text-gray-600'
                        }`}
                      >
                        % Split
                      </button>
                    </div>
                  </div>

                  {splitMode === 'equal' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-gray-500">
                          {includedMembers.length} of {members.length} members involved
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ccead5] text-[#183124]">
                          {amount && Number(amount) > 0
                            ? `${formatMoney(Number(amount) / Math.max(1, includedMembers.length), currency)} each`
                            : 'Equally'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {members.map((m) => {
                          const isSelected = includedMembers.includes(m._id);
                          return (
                            <button
                              key={m._id}
                              type="button"
                              onClick={() => toggleMember(m._id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#ccead5] text-[#183124] border border-[#7e9a88]'
                                  : 'bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200'
                              }`}
                            >
                              <span className="w-4 h-4 rounded-full bg-white text-[9px] font-bold flex items-center justify-center">
                                {m.username.slice(0, 1).toUpperCase()}
                              </span>
                              <span>{m.username} {m._id === currentUserId ? '(You)' : ''}</span>
                              {isSelected && <span className="font-bold text-[#4a6454]">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {splitMode === 'exact' && (
                    <div className="bg-[#f7faf6] rounded-2xl p-3 border border-[#e4e5e0] space-y-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-600">Enter exact amount per member:</span>
                        {(() => {
                          const total = parseFloat(amount) || 0;
                          const currentSum = Object.values(exactSplits).reduce(
                            (sum, v) => sum + (parseFloat(v) || 0),
                            0
                          );
                          const diff = total - currentSum;
                          const isBalanced = Math.abs(diff) < 0.05 && total > 0;
                          return (
                            <span
                              className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                isBalanced
                                  ? 'bg-[#dcfce7] text-[#15803d]'
                                  : diff > 0
                                  ? 'bg-[#ffedd5] text-[#c2410c]'
                                  : 'bg-[#ffdad6] text-[#ba1a1a]'
                              }`}
                            >
                              {isBalanced
                                ? '✓ Balanced'
                                : diff > 0
                                ? `${formatMoney(diff, currency)} left`
                                : `${formatMoney(-diff, currency)} over`}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="divide-y divide-gray-200/60 max-h-48 overflow-y-auto">
                        {members.map((m) => (
                          <div key={m._id} className="py-1.5 flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-gray-700 truncate">
                              {m.username} {m._id === currentUserId ? '(You)' : ''}
                            </span>
                            <div className="relative w-32 shrink-0">
                              <span className="absolute left-2.5 top-1.5 text-xs text-gray-400 font-bold">
                                {currSymbol}
                              </span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0.00"
                                value={exactSplits[m._id] || ''}
                                onChange={(e) =>
                                  setExactSplits({ ...exactSplits, [m._id]: e.target.value })
                                }
                                className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold rounded-lg border border-gray-300 bg-white outline-none focus:border-[#4a6454]"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {splitMode === 'percentage' && (
                    <div className="bg-[#f7faf6] rounded-2xl p-3 border border-[#e4e5e0] space-y-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-600">Enter percentage per member:</span>
                        {(() => {
                          const currentPercent = Object.values(percentageSplits).reduce(
                            (sum, v) => sum + (parseFloat(v) || 0),
                            0
                          );
                          const diff = 100 - currentPercent;
                          const isBalanced = Math.abs(diff) < 0.1;
                          return (
                            <span
                              className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                isBalanced
                                  ? 'bg-[#dcfce7] text-[#15803d]'
                                  : diff > 0
                                  ? 'bg-[#ffedd5] text-[#c2410c]'
                                  : 'bg-[#ffdad6] text-[#ba1a1a]'
                              }`}
                            >
                              {isBalanced
                                ? '✓ 100%'
                                : diff > 0
                                ? `${diff.toFixed(1)}% left`
                                : `${(-diff).toFixed(1)}% over`}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="divide-y divide-gray-200/60 max-h-48 overflow-y-auto">
                        {members.map((m) => {
                          const pct = parseFloat(percentageSplits[m._id] || '0') || 0;
                          const total = parseFloat(amount) || 0;
                          const calcAmt = (pct / 100) * total;
                          return (
                            <div key={m._id} className="py-1.5 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-gray-700 truncate block">
                                  {m.username} {m._id === currentUserId ? '(You)' : ''}
                                </span>
                                {total > 0 && pct > 0 && (
                                  <span className="text-[10px] text-gray-400 font-mono">
                                    ≈ {formatMoney(calcAmt, currency)}
                                  </span>
                                )}
                              </div>
                              <div className="relative w-24 shrink-0">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  max="100"
                                  placeholder="0"
                                  value={percentageSplits[m._id] || ''}
                                  onChange={(e) =>
                                    setPercentageSplits({
                                      ...percentageSplits,
                                      [m._id]: e.target.value,
                                    })
                                  }
                                  className="w-full pl-2 pr-6 py-1 text-xs font-mono font-bold rounded-lg border border-gray-300 bg-white outline-none focus:border-[#4a6454]"
                                />
                                <span className="absolute right-2.5 top-1.5 text-xs text-gray-400 font-bold">
                                  %
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Receipt Photo Attachment */}
              <div className="bg-[#f7faf6] rounded-2xl p-3 border border-[#e4e5e0]">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📷</span>
                    <span>Receipt Photo</span>
                  </label>
                  {receiptImage && (
                    <button
                      type="button"
                      onClick={() => setReceiptImage(null)}
                      className="text-xs text-red-600 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {receiptImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 inline-block">
                    <img
                      src={receiptImage}
                      alt="Receipt preview"
                      className="h-28 object-cover rounded-xl cursor-pointer"
                      onClick={() => setActiveReceiptModalUrl(receiptImage)}
                    />
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      Click to expand
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      id="receipt-file-input"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCompressingReceipt(true);
                          try {
                            const compressed = await compressImageFile(file);
                            setReceiptImage(compressed);
                          } catch {
                            alert('Failed to process receipt image');
                          } finally {
                            setCompressingReceipt(false);
                          }
                        }
                      }}
                    />
                    <label
                      htmlFor="receipt-file-input"
                      className="px-3.5 py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-[#4a6454] bg-white text-xs font-medium text-gray-600 hover:text-[#4a6454] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {compressingReceipt ? (
                        <span>Compressing image…</span>
                      ) : (
                        <>
                          <span>📎</span>
                          <span>Upload or snap receipt</span>
                        </>
                      )}
                    </label>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-xs p-3 rounded-xl bg-red-100 text-red-700 font-medium">
                  {error}
                </p>
              )}

              {/* Sticky Action Footer */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3.5 px-4 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-[#181c1a] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {loading ? 'Saving…' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. EDIT EXPENSE MODAL */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-3xl p-4 sm:p-6 bg-white shadow-2xl max-h-[90vh] overflow-y-auto border border-[#e4e5e0]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#f1f4f1]">
              <h3
                className="text-sm sm:text-base font-bold text-[#181c1a]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Edit Expense
              </h3>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs bg-gray-100 hover:bg-gray-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateExpense} className="flex flex-col space-y-4">
              {/* Type Switcher */}
              <div className="w-full bg-[#ecefeb] p-1 rounded-2xl flex items-center justify-between mb-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setEditIsPersonal(false)}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    !editIsPersonal ? 'bg-white text-[#181c1a] shadow-xs' : 'text-[#424843]'
                  }`}
                >
                  <span>👥 Shared</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditIsPersonal(true)}
                  className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    editIsPersonal ? 'bg-white text-[#181c1a] shadow-xs' : 'text-[#424843]'
                  }`}
                >
                  <span>💳 Private Spends</span>
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                  AMOUNT ({currSymbol}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-gray-500 font-bold">{currSymbol}</span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                    className="w-full pl-8 pr-4 py-2.5 text-sm sm:text-base font-mono font-bold rounded-2xl border border-gray-200 outline-none focus:border-[#4a6454]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                  DESCRIPTION *
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  required
                  className="w-full text-xs sm:text-sm px-4 py-2.5 rounded-2xl border border-gray-200 outline-none focus:border-[#4a6454]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">
                  CATEGORY
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const isSelected = editCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setEditCategory(cat.id)}
                        className={`p-2 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#4a6454] bg-[#ccead5]/30 text-[#183124] font-semibold ring-1 ring-[#4a6454]'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="text-lg">{cat.icon}</span>
                        <span className="text-[10px] truncate w-full">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {!editIsPersonal ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                      PAID BY
                    </label>
                    <select
                      value={editPaidBy}
                      onChange={(e) => setEditPaidBy(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-white outline-none cursor-pointer"
                    >
                      {members.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.username} {m._id === currentUserId ? '(You)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Split Type Selector */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block">
                          SPLIT TYPE
                        </label>
                        <span className="text-[10px] text-gray-500">How should this cost be divided?</span>
                      </div>

                      <div className="flex bg-[#ecefeb] p-0.5 rounded-xl text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setEditSplitMode('equal')}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            editSplitMode === 'equal' ? 'bg-white text-[#181c1a] shadow-xs' : 'text-gray-600'
                          }`}
                        >
                          Equal
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditSplitMode('exact')}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            editSplitMode === 'exact' ? 'bg-white text-[#181c1a] shadow-xs' : 'text-gray-600'
                          }`}
                        >
                          Exact
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditSplitMode('percentage')}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            editSplitMode === 'percentage' ? 'bg-white text-[#181c1a] shadow-xs' : 'text-gray-600'
                          }`}
                        >
                          % Split
                        </button>
                      </div>
                    </div>

                    {editSplitMode === 'equal' && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-[#7e9a88] font-semibold">
                            {editIncludedMembers.length} of {members.length} selected
                          </span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ccead5] text-[#183124]">
                            {editAmount && Number(editAmount) > 0
                              ? `${formatMoney(Number(editAmount) / Math.max(1, editIncludedMembers.length), currency)} each`
                              : 'Equally'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {members.map((m) => {
                            const isSelected = editIncludedMembers.includes(m._id);
                            return (
                              <button
                                key={m._id}
                                type="button"
                                onClick={() => toggleEditMember(m._id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#ccead5] text-[#183124] border border-[#7e9a88]'
                                    : 'bg-gray-100 text-gray-500 border border-transparent'
                                }`}
                              >
                                <span className="w-4 h-4 rounded-full bg-white text-[9px] font-bold flex items-center justify-center">
                                  {m.username.slice(0, 1).toUpperCase()}
                                </span>
                                <span>{m.username}</span>
                                {isSelected && <span className="font-bold">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {editSplitMode === 'exact' && (
                      <div className="bg-[#f7faf6] rounded-2xl p-3 border border-[#e4e5e0] space-y-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-gray-600">Enter exact amount per member:</span>
                          {(() => {
                            const total = parseFloat(editAmount) || 0;
                            const currentSum = Object.values(editExactSplits).reduce(
                              (sum, v) => sum + (parseFloat(v) || 0),
                              0
                            );
                            const diff = total - currentSum;
                            const isBalanced = Math.abs(diff) < 0.05 && total > 0;
                            return (
                              <span
                                className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  isBalanced
                                    ? 'bg-[#dcfce7] text-[#15803d]'
                                    : diff > 0
                                    ? 'bg-[#ffedd5] text-[#c2410c]'
                                    : 'bg-[#ffdad6] text-[#ba1a1a]'
                                }`}
                              >
                                {isBalanced
                                  ? '✓ Balanced'
                                  : diff > 0
                                  ? `${formatMoney(diff, currency)} left`
                                  : `${formatMoney(-diff, currency)} over`}
                              </span>
                            );
                          })()}
                        </div>

                        <div className="divide-y divide-gray-200/60 max-h-48 overflow-y-auto">
                          {members.map((m) => (
                            <div key={m._id} className="py-1.5 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-gray-700 truncate">
                                {m.username} {m._id === currentUserId ? '(You)' : ''}
                              </span>
                              <div className="relative w-32 shrink-0">
                                <span className="absolute left-2.5 top-1.5 text-xs text-gray-400 font-bold">
                                  {currSymbol}
                                </span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder="0.00"
                                  value={editExactSplits[m._id] || ''}
                                  onChange={(e) =>
                                    setEditExactSplits({ ...editExactSplits, [m._id]: e.target.value })
                                  }
                                  className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold rounded-lg border border-gray-300 bg-white outline-none focus:border-[#4a6454]"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {editSplitMode === 'percentage' && (
                      <div className="bg-[#f7faf6] rounded-2xl p-3 border border-[#e4e5e0] space-y-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-gray-600">Enter percentage per member:</span>
                          {(() => {
                            const currentPercent = Object.values(editPercentageSplits).reduce(
                              (sum, v) => sum + (parseFloat(v) || 0),
                              0
                            );
                            const diff = 100 - currentPercent;
                            const isBalanced = Math.abs(diff) < 0.1;
                            return (
                              <span
                                className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  isBalanced
                                    ? 'bg-[#dcfce7] text-[#15803d]'
                                    : diff > 0
                                    ? 'bg-[#ffedd5] text-[#c2410c]'
                                    : 'bg-[#ffdad6] text-[#ba1a1a]'
                                }`}
                              >
                                {isBalanced
                                  ? '✓ 100%'
                                  : diff > 0
                                  ? `${diff.toFixed(1)}% left`
                                  : `${(-diff).toFixed(1)}% over`}
                              </span>
                            );
                          })()}
                        </div>

                        <div className="divide-y divide-gray-200/60 max-h-48 overflow-y-auto">
                          {members.map((m) => {
                            const pct = parseFloat(editPercentageSplits[m._id] || '0') || 0;
                            const total = parseFloat(editAmount) || 0;
                            const calcAmt = (pct / 100) * total;
                            return (
                              <div key={m._id} className="py-1.5 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-gray-700 truncate block">
                                    {m.username} {m._id === currentUserId ? '(You)' : ''}
                                  </span>
                                  {total > 0 && pct > 0 && (
                                    <span className="text-[10px] text-gray-400 font-mono">
                                      ≈ {formatMoney(calcAmt, currency)}
                                    </span>
                                  )}
                                </div>
                                <div className="relative w-24 shrink-0">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    max="100"
                                    placeholder="0"
                                    value={editPercentageSplits[m._id] || ''}
                                    onChange={(e) =>
                                      setEditPercentageSplits({
                                        ...editPercentageSplits,
                                        [m._id]: e.target.value,
                                      })
                                    }
                                    className="w-full pl-2 pr-6 py-1 text-xs font-mono font-bold rounded-lg border border-gray-300 bg-white outline-none focus:border-[#4a6454]"
                                  />
                                  <span className="absolute right-2.5 top-1.5 text-xs text-gray-400 font-bold">
                                    %
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Edit Receipt Photo Attachment */}
                  <div className="bg-[#f7faf6] rounded-2xl p-3 border border-[#e4e5e0]">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                        <span>📷</span>
                        <span>Receipt Photo</span>
                      </label>
                      {editReceiptImage && (
                        <button
                          type="button"
                          onClick={() => setEditReceiptImage(null)}
                          className="text-xs text-red-600 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {editReceiptImage ? (
                      <div className="relative rounded-xl overflow-hidden border border-gray-200 inline-block">
                        <img
                          src={editReceiptImage}
                          alt="Receipt preview"
                          className="h-28 object-cover rounded-xl cursor-pointer"
                          onClick={() => setActiveReceiptModalUrl(editReceiptImage)}
                        />
                        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                          Click to expand
                        </div>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          id="edit-receipt-file-input"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setEditCompressingReceipt(true);
                              try {
                                const compressed = await compressImageFile(file);
                                setEditReceiptImage(compressed);
                              } catch {
                                alert('Failed to process receipt image');
                              } finally {
                                setEditCompressingReceipt(false);
                              }
                            }
                          }}
                        />
                        <label
                          htmlFor="edit-receipt-file-input"
                          className="px-3.5 py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-[#4a6454] bg-white text-xs font-medium text-gray-600 hover:text-[#4a6454] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        >
                          {editCompressingReceipt ? (
                            <span>Compressing image…</span>
                          ) : (
                            <>
                              <span>📎</span>
                              <span>Upload or snap receipt</span>
                            </>
                          )}
                        </label>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-2xl bg-[#f1f4f1]/60 text-xs text-[#424843]">
                  💡 Tracked strictly under your <strong>Private Spends</strong>. Not split with the group.
                </div>
              )}

              {editError && (
                <p className="text-xs p-3 rounded-xl bg-red-100 text-red-700">
                  {editError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleDeleteExpense(editingExpense._id)}
                  disabled={editLoading}
                  className="px-4 py-3 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
                >
                  Delete
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-3 px-4 rounded-2xl bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {editLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. RECEIPT FULL VIEWER MODAL */}
      {activeReceiptModalUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setActiveReceiptModalUrl(null)}
        >
          <div
            className="max-w-xl max-h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl relative border border-gray-300 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-[#f7faf6] border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <span>🧾</span>
                <span>Receipt Photo</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveReceiptModalUrl(null)}
                className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-3 overflow-auto flex items-center justify-center bg-gray-50 max-h-[75vh]">
              <img
                src={activeReceiptModalUrl}
                alt="Receipt detail"
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* 8. FLOATING ACTION BUTTON (FAB) FOR QUICK EXPENSE ENTRY */}
      <button
        type="button"
        onClick={() => {
          setExpenseType(expenseSubView === 'private-spends' ? 'personal' : 'shared');
          setShowAddModal(true);
        }}
        className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-30 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#4a6454] hover:bg-[#385041] text-white shadow-lg shadow-[#4a6454]/35 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        aria-label="Add Expense"
        title="Quick Add Expense (+)"
      >
        <span className="text-2xl sm:text-3xl font-light leading-none group-hover:rotate-90 transition-transform duration-200">
          +
        </span>
      </button>
    </div>
  );
}
