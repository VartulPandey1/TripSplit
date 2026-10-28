'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BudgetGuessingHub, { SerializedBudget } from '../money/BudgetGuessingHub';

export interface Milestone {
  _id: string;
  title: string;
  targetDate?: string;
  targetTime?: string;
  order?: number;
  isCompleted: boolean;
}

interface Member {
  _id: string;
  username: string;
  avatarId?: string;
  email?: string;
}

interface PlanClientProps {
  tripId: string;
  initialMilestones: Milestone[];
  tripName?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  initialNotes?: string;
  currentUserId?: string;
  isCreator?: boolean;
  members?: Member[];
  initialBudget?: SerializedBudget | null;
  currency?: string;
  totalActualSpend?: number;
}

// Category detection for travel icons & tints
function getActivityCategory(title: string): { emoji: string; label: string; bg: string; color: string } {
  const lower = title.toLowerCase();
  if (lower.match(/flight|airport|plane|terminal|airline|fly|boarding/)) {
    return { emoji: '✈️', label: 'Transit', bg: '#eff6ff', color: '#1d4ed8' };
  }
  if (lower.match(/train|railway|station|bus|drive|car|cab|taxi|uber|ola|ferry|boat/)) {
    return { emoji: '🚆', label: 'Transport', bg: '#f0f9ff', color: '#0369a1' };
  }
  if (lower.match(/hotel|resort|check.?in|airbnb|hostel|stay|villa|lodge|room/)) {
    return { emoji: '🏨', label: 'Stay', bg: '#fff7ed', color: '#c2410c' };
  }
  if (lower.match(/dinner|lunch|breakfast|food|cafe|coffee|restaurant|bar|brunch|eat|drink|snack|bakery|pub/)) {
    return { emoji: '🍽️', label: 'Dining', bg: '#fef3c7', color: '#b45309' };
  }
  if (lower.match(/beach|swim|pool|sea|ocean|scuba|snorkel|sunset|kayak|water/)) {
    return { emoji: '🏖️', label: 'Beach', bg: '#e0f2fe', color: '#0284c7' };
  }
  if (lower.match(/hike|trek|trail|mountain|camp|peak|safari|climb|waterfall|nature|forest/)) {
    return { emoji: '🥾', label: 'Outdoor', bg: '#f0fdf4', color: '#15803d' };
  }
  if (lower.match(/museum|palace|temple|church|monument|fort|historic|tour|gallery|heritage/)) {
    return { emoji: '🏛️', label: 'Sightseeing', bg: '#faf5ff', color: '#7e22ce' };
  }
  if (lower.match(/party|club|concert|show|nightlife|music|event/)) {
    return { emoji: '🎉', label: 'Event', bg: '#fdf2f8', color: '#be185d' };
  }
  return { emoji: '📍', label: 'Stop', bg: '#f3f6f4', color: '#4a6454' };
}

// Strict chronological & intra-day sorting
function sortMilestonesDateWise(list: Milestone[]): Milestone[] {
  return [...list].sort((a, b) => {
    if (a.targetDate && b.targetDate) {
      const dateCmp = a.targetDate.localeCompare(b.targetDate);
      if (dateCmp !== 0) return dateCmp;
      if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
      if (a.targetTime && b.targetTime) return a.targetTime.localeCompare(b.targetTime);
      if (a.targetTime && !b.targetTime) return -1;
      if (!a.targetTime && b.targetTime) return 1;
      return 0;
    }
    if (a.targetDate && !b.targetDate) return -1;
    if (!a.targetDate && b.targetDate) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

function formatTime12h(timeStr?: string): string | null {
  if (!timeStr) return null;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hours12 = h % 12 || 12;
  return `${hours12}:${m < 10 ? '0' + m : m} ${ampm}`;
}

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getLocalTodayDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRelativeDateLabel(dateStr: string): string | null {
  if (!dateStr) return null;
  const todayStr = getLocalTodayDate();
  if (dateStr === todayStr) return '🔥 Today';

  try {
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return '⏳ Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  } catch {
    // ignore
  }
  return null;
}

export default function PlanClient({
  tripId,
  initialMilestones,
  tripName = 'Trip',
  destination = '',
  startDate = '',
  endDate = '',
  initialNotes = '',
  currentUserId = '',
  isCreator = false,
  members = [],
  initialBudget = null,
  currency = 'INR',
  totalActualSpend = 0,
}: PlanClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTabParam = searchParams?.get('tab');
  const [milestones, setMilestones] = useState<Milestone[]>(() =>
    sortMilestonesDateWise(initialMilestones)
  );
  const [budget, setBudget] = useState<SerializedBudget | null>(initialBudget || null);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'budget' | 'notes'>(
    initialTabParam === 'budget' ? 'budget' : initialTabParam === 'notes' ? 'notes' : 'itinerary'
  );

  useEffect(() => {
    const t = searchParams?.get('tab');
    if (t === 'budget') setActiveTab('budget');
    else if (t === 'notes') setActiveTab('notes');
    else if (t === 'itinerary') setActiveTab('itinerary');
  }, [searchParams]);
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState(startDate || '');
  const [targetTime, setTargetTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [milestoneError, setMilestoneError] = useState('');

  // Slide-Up Bottom Sheet States
  const [isAddStopSheetOpen, setIsAddStopSheetOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailDate, setDetailDate] = useState('');
  const [detailTime, setDetailTime] = useState('');
  const [detailCompleted, setDetailCompleted] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailDeleting, setDetailDeleting] = useState(false);
  const [detailError, setDetailError] = useState('');

  function openStopDetails(m: Milestone) {
    setSelectedMilestone(m);
    setDetailTitle(m.title);
    setDetailDate(m.targetDate || '');
    setDetailTime(m.targetTime || '');
    setDetailCompleted(m.isCompleted);
    setDetailError('');
  }

  function closeStopDetails() {
    setSelectedMilestone(null);
    setDetailError('');
  }

  async function handleSaveStopDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMilestone || !detailTitle.trim()) return;
    setDetailSaving(true);
    setDetailError('');
    try {
      const res = await fetch(`/api/tasks/${selectedMilestone._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: detailTitle.trim(),
          targetDate: detailDate || null,
          targetTime: detailTime || '',
          isCompleted: detailCompleted,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update stop');
      }
      const updated = await res.json();
      setMilestones((prev) =>
        sortMilestonesDateWise(
          prev.map((item) =>
            item._id === selectedMilestone._id
              ? {
                  ...item,
                  title: updated.title,
                  targetDate: updated.targetDate ? String(updated.targetDate).split('T')[0] : undefined,
                  targetTime: updated.targetTime || undefined,
                  isCompleted: updated.isCompleted,
                }
              : item
          )
        )
      );
      closeStopDetails();
      router.refresh();
    } catch (err: any) {
      setDetailError(err.message || 'Error updating stop details');
    } finally {
      setDetailSaving(false);
    }
  }

  async function handleDeleteStopDetails() {
    if (!selectedMilestone) return;
    setDetailDeleting(true);
    try {
      await deleteMilestone(selectedMilestone._id);
      closeStopDetails();
    } finally {
      setDetailDeleting(false);
    }
  }

  // Shared Notes state (persisted to MongoDB via /api/trips/[id])
  const [notes, setNotes] = useState(initialNotes || '');
  const [savedNotesValue, setSavedNotesValue] = useState(initialNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [autoSaveCountdown, setAutoSaveCountdown] = useState<number | null>(null);
  const [notesCopied, setNotesCopied] = useState(false);

  async function handleCopyNotes() {
    if (!notes.trim()) return;
    try {
      await navigator.clipboard.writeText(notes);
      setNotesCopied(true);
      setTimeout(() => setNotesCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy notes', err);
    }
  }

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const savedNotesRef = useRef(savedNotesValue);
  savedNotesRef.current = savedNotesValue;
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef<string | null>(null);

  // Keep notes synchronized if initialNotes prop changes
  useEffect(() => {
    if (typeof initialNotes === 'string') {
      setNotes(initialNotes);
      setSavedNotesValue(initialNotes);
    }
  }, [initialNotes]);

  // Network offline detection & auto-reconnect sync
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      // If there are unsaved edits queued while offline, sync now
      if (notesRef.current !== savedNotesRef.current) {
        saveNotesToDb(notesRef.current);
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Offline warning & prevention before navigating away with unsaved notes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (notes !== savedNotesValue) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [notes, savedNotesValue]);

  const isTitleEmpty = !title.trim();
  const isNotesChanged = notes !== savedNotesValue;

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (isTitleEmpty) return;

    if (targetDate) {
      if (startDate && targetDate < startDate) {
        setMilestoneError(`Scheduled date cannot be before trip start date (${startDate})`);
        return;
      }
      if (endDate && targetDate > endDate) {
        setMilestoneError(`Scheduled date cannot be after trip end date (${endDate})`);
        return;
      }
    }

    setLoading(true);
    setMilestoneError('');

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          type: 'milestone',
          title: title.trim(),
          targetDate: targetDate || undefined,
          targetTime: targetTime ? targetTime.trim() : undefined,
          order: milestones.length,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMilestoneError(data.error || 'Failed to add stop');
        return;
      }

      const created = await res.json();
      const createdMilestone: Milestone = {
        _id: created._id,
        title: created.title,
        targetDate: created.targetDate ? created.targetDate.split('T')[0] : '',
        targetTime: created.targetTime || '',
        order: typeof created.order === 'number' ? created.order : milestones.length,
        isCompleted: Boolean(created.isCompleted),
      };

      // Re-sort date-wise so the item lands at its chronological place
      setMilestones((prev) => sortMilestonesDateWise([...prev, createdMilestone]));
      setTitle('');
      setTargetTime('');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function moveMilestone(itemId: string, direction: 'up' | 'down', groupItems: Milestone[]) {
    const index = groupItems.findIndex((m) => m._id === itemId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groupItems.length) return;

    const currentItem = groupItems[index];
    const targetItem = groupItems[targetIndex];

    const currentOrder = currentItem.order ?? index;
    const targetOrder = targetItem.order ?? targetIndex;

    const newCurrentOrder =
      targetOrder === currentOrder
        ? direction === 'up'
          ? currentOrder - 1
          : currentOrder + 1
        : targetOrder;
    const newTargetOrder = currentOrder;

    setMilestones((prev) => {
      const next = prev.map((m) => {
        if (m._id === currentItem._id) return { ...m, order: newCurrentOrder };
        if (m._id === targetItem._id) return { ...m, order: newTargetOrder };
        return m;
      });
      return sortMilestonesDateWise(next);
    });

    try {
      await Promise.all([
        fetch(`/api/tasks/${currentItem._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: newCurrentOrder }),
        }),
        fetch(`/api/tasks/${targetItem._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: newTargetOrder }),
        }),
      ]);
    } catch {
      // ignore
    }
  }

  async function toggleMilestone(id: string, isCompleted: boolean) {
    setMilestones((prev) =>
      prev.map((m) => (m._id === id ? { ...m, isCompleted: !isCompleted } : m))
    );

    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted: !isCompleted }),
    });
  }

  async function deleteMilestone(id: string) {
    setMilestones((prev) => prev.filter((m) => m._id !== id));
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  }

  // Core save function to Trip database with queuing to prevent dropped keystrokes
  async function saveNotesToDb(contentToSave: string) {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      return;
    }

    // If an auto-save request is already inflight over the network, queue the latest content
    if (isSavingRef.current) {
      pendingSaveRef.current = contentToSave;
      return;
    }

    isSavingRef.current = true;
    setSavingNotes(true);
    setNotesError('');
    setAutoSaveCountdown(null);

    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: contentToSave }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save notes');
      }

      setSavedNotesValue(contentToSave);
      setNotesSaved(true);
      router.refresh();
      setTimeout(() => setNotesSaved(false), 3000);
    } catch (err: any) {
      setNotesError(err.message || 'Failed to save shared notes. Please try again.');
    } finally {
      isSavingRef.current = false;
      setSavingNotes(false);

      // Check if user edited notes while this network request was resolving
      const queued = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (queued !== null && queued !== contentToSave) {
        saveNotesToDb(queued);
      } else if (notesRef.current !== contentToSave) {
        saveNotesToDb(notesRef.current);
      }
    }
  }

  // 3-second auto-save debounce when typing stops
  useEffect(() => {
    if (notes === savedNotesValue) {
      setAutoSaveCountdown(null);
      return;
    }

    if (isOffline) {
      setAutoSaveCountdown(null);
      return;
    }

    setAutoSaveCountdown(3);
    const interval = setInterval(() => {
      setAutoSaveCountdown((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);

    const debounceTimer = setTimeout(() => {
      saveNotesToDb(notes);
    }, 3000);

    return () => {
      clearTimeout(debounceTimer);
      clearInterval(interval);
    };
  }, [notes, savedNotesValue, isOffline]);

  function handleManualSave() {
    saveNotesToDb(notes);
  }

  // Calculate day mapping (Day 1, Day 2...) if startDate is provided
  const startDateTime = startDate ? new Date(startDate + 'T00:00:00').getTime() : null;

  function getDayHeader(dateKey: string): { title: string; dayNumber?: number; relative?: string | null } {
    if (dateKey === 'flexible') {
      return { title: '📌 Flexible / Any Time' };
    }
    const formatted = formatDateLabel(dateKey);
    const relative = getRelativeDateLabel(dateKey);

    if (startDateTime) {
      try {
        const itemTime = new Date(dateKey + 'T00:00:00').getTime();
        const diffDays = Math.round((itemTime - startDateTime) / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays > 0 && diffDays <= 30) {
          return { title: `Day ${diffDays} • ${formatted}`, dayNumber: diffDays, relative };
        }
      } catch {
        // fallback
      }
    }
    return { title: formatted, relative };
  }

  // Group milestones strictly date-wise
  interface GroupedDay {
    dateKey: string;
    header: string;
    dayNumber?: number;
    relative?: string | null;
    items: Milestone[];
  }

  const groupsMap = new Map<string, GroupedDay>();

  milestones.forEach((m) => {
    const key = m.targetDate || 'flexible';
    if (!groupsMap.has(key)) {
      const dayInfo = getDayHeader(key);
      groupsMap.set(key, {
        dateKey: key,
        header: dayInfo.title,
        dayNumber: dayInfo.dayNumber,
        relative: dayInfo.relative,
        items: [],
      });
    }
    groupsMap.get(key)!.items.push(m);
  });

  const dayGroups: GroupedDay[] = Array.from(groupsMap.values()).sort((a, b) => {
    if (a.dateKey === 'flexible') return 1;
    if (b.dateKey === 'flexible') return -1;
    return a.dateKey.localeCompare(b.dateKey);
  });

  const localToday = useMemo(() => getLocalTodayDate(), []);

  const todayGroup = useMemo(() => {
    return dayGroups.find((g) => g.dateKey === localToday);
  }, [dayGroups, localToday]);

  const todayDayNumber = useMemo(() => {
    if (!startDate) return null;
    try {
      const start = new Date(startDate + 'T00:00:00').getTime();
      const today = new Date(localToday + 'T00:00:00').getTime();
      const diff = Math.round((today - start) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 && diff <= 30 ? diff : null;
    } catch {
      return null;
    }
  }, [startDate, localToday]);

  const totalStops = milestones.length;
  const completedStops = milestones.filter((m) => m.isCompleted).length;
  const completionPercent = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  return (
    <div className="px-3 py-3 sm:px-6 sm:py-6 max-w-4xl mx-auto space-y-3 sm:space-y-4">
      {/* 1. TRIP HEADER WITH PROGRESS */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg sm:text-xl">🗺️</span>
              <h1
                className="text-xl sm:text-3xl font-bold tracking-tight text-[#1a1e1c]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {tripName} itinerary
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500">
              {destination && <span className="font-medium text-[#4a6454]">📍 {destination} • </span>}
              {startDate && endDate ? `${formatDateLabel(startDate)} – ${formatDateLabel(endDate)}` : 'Date-wise travel timeline'}
            </p>
          </div>

          {totalStops > 0 && (
            <div className="flex items-center sm:flex-col sm:items-end gap-1.5 shrink-0">
              <span className="text-xs font-semibold text-[#4a6454] bg-[#f0f5f2] px-2.5 py-1 rounded-full">
                {completedStops} / {totalStops} visited ({completionPercent}%)
              </span>
              <div className="w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#4a6454] h-full rounded-full transition-all duration-300"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TOP TOGGLE: [ 🗺️ Itinerary (n) | 🎯 Budget | 📝 Trip Notes ] */}
      <div className="bg-[#ecefeb] p-1 sm:p-1.5 rounded-2xl flex items-center gap-1 border border-[#d6ddd6] shadow-2xs select-none touch-manipulation">
        <button
          type="button"
          onClick={() => setActiveTab('itinerary')}
          className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer select-none touch-manipulation ${
            activeTab === 'itinerary'
              ? 'bg-white text-[#183124] shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <span>🗺️</span>
          <span>Itinerary</span>
          <span
            className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
              activeTab === 'itinerary'
                ? 'bg-[#e3efe7] text-[#1a4427]'
                : 'bg-[#dfe3df] text-gray-600'
            }`}
          >
            {milestones.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('budget')}
          className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer select-none touch-manipulation ${
            activeTab === 'budget'
              ? 'bg-white text-[#183124] shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <span>🎯</span>
          <span>Budget</span>
          {budget && (budget.items?.length || 0) > 0 && (
            <span
              className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeTab === 'budget'
                  ? 'bg-[#e3efe7] text-[#1a4427]'
                  : 'bg-[#dfe3df] text-gray-600'
              }`}
            >
              {budget.items.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer select-none touch-manipulation ${
            activeTab === 'notes'
              ? 'bg-white text-[#183124] shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <span>📝</span>
          <span>Trip Notes</span>
          {isNotesChanged && (
            <span
              className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-0.5"
              title="Unsaved changes"
            />
          )}
        </button>
      </div>

      {/* BUDGET TAB CONTENT */}
      {activeTab === 'budget' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <BudgetGuessingHub
            tripId={tripId}
            currentUserId={currentUserId}
            isCreator={isCreator}
            members={members}
            initialBudget={budget}
            totalActualSpend={totalActualSpend}
            currency={currency}
            onBudgetUpdated={(updated) => setBudget(updated)}
          />
        </div>
      )}

      {/* ITINERARY TAB CONTENT */}
      {activeTab === 'itinerary' && (
        <>
          {/* Mobile: Clean + Add Stop Button (Collapses the 200px form on mobile) */}
          <div className="sm:hidden">
            <button
              type="button"
              onClick={() => setIsAddStopSheetOpen(true)}
              className="w-full py-2.5 px-3.5 rounded-2xl bg-white border border-[#e4e5e0] shadow-2xs hover:bg-[#f7faf6] flex items-center justify-between text-xs font-semibold text-[#4a6454] cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-xl bg-[#eef4f0] text-[#244b34] flex items-center justify-center font-bold text-sm">
                  +
                </span>
                <span>Add Stop to Itinerary</span>
              </span>
              <span className="text-[11px] text-gray-400 font-normal">Tap to schedule ›</span>
            </button>
          </div>

          {/* Desktop: Keep form open as it is today (sm:) */}
          <div
            className="hidden sm:block rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white border border-[#e4e5e0] shadow-2xs"
          >
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-sm sm:text-base font-semibold flex items-center gap-1.5"
                style={{ color: 'var(--color-charcoal)' }}
              >
                <span>🗓️</span>
                <span>Add to Itinerary</span>
              </h2>
              <span className="text-xs text-gray-400">Scheduled date-wise</span>
            </div>

            {milestoneError && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between shadow-2xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>⚠️</span> {milestoneError}
                </span>
                <button
                  type="button"
                  onClick={() => setMilestoneError('')}
                  className="text-xs font-bold px-1.5 py-0.5 text-red-600 hover:text-red-900 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleAddMilestone} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                placeholder="Stop name (e.g. Flight, Hotel, Dinner)"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (milestoneError) setMilestoneError('');
                }}
                required
                className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-[#f7faf6] border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] transition-colors"
              />

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <input
                  type="date"
                  value={targetDate}
                  min={startDate || undefined}
                  max={endDate || undefined}
                  onChange={(e) => {
                    setTargetDate(e.target.value);
                    if (milestoneError) setMilestoneError('');
                  }}
                  className="flex-1 sm:w-auto px-3 py-2.5 text-xs sm:text-sm bg-[#f7faf6] border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] transition-colors"
                  title={`Scheduled Date${startDate && endDate ? ` (between ${startDate} and ${endDate})` : ''}`}
                />

                <input
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="flex-1 sm:w-auto px-2.5 py-2.5 text-xs sm:text-sm bg-[#f7faf6] border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] transition-colors text-gray-700"
                  title="Optional activity time (e.g., 10:00 AM)"
                />
              </div>

              <button
                type="submit"
                disabled={isTitleEmpty || loading}
                className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
                  isTitleEmpty || loading
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                    : 'bg-[#4a6454] hover:bg-[#385041] text-white cursor-pointer shadow-2xs active:scale-95'
                }`}
                title={isTitleEmpty ? 'Type an activity or destination first' : 'Add stop to itinerary'}
              >
                <span className="font-bold">+</span>
                <span>{loading ? 'Adding…' : 'Add to Itinerary'}</span>
              </button>
            </form>
          </div>

          {/* Sticky 'Jump to Today' Pill when on multi-day trips and today exists in schedule */}
          {todayGroup && dayGroups.length > 1 && (
            <div className="sticky top-2 sm:top-4 z-20 flex justify-center pointer-events-none mb-1">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById(`day-group-${todayGroup.dateKey}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="pointer-events-auto px-4 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-[#b0cdba] text-[#183124] text-xs font-semibold shadow-md hover:bg-white hover:border-[#4a6454] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 group"
                title={`Jump to Today's schedule (${todayGroup.header})`}
              >
                <span>📍</span>
                <span>Jump to Today {todayGroup.dayNumber ? `(Day ${todayGroup.dayNumber})` : todayDayNumber ? `(Day ${todayDayNumber})` : ''}</span>
                <span className="text-gray-400 group-hover:translate-y-0.5 transition-transform text-[11px]">↓</span>
              </button>
            </div>
          )}

          {/* 3. DATE-WISE ITINERARY TIMELINE */}
          <div className="mb-3">
            {milestones.length === 0 ? (
              <div
                className="rounded-2xl p-6 text-center bg-white border border-dashed border-gray-200"
                style={{ color: 'rgba(26,30,28,0.45)' }}
              >
                <p className="text-xl mb-1">🗺️</p>
                <p className="text-xs sm:text-sm font-medium text-gray-700">No stops scheduled yet</p>
                <p className="text-[11px] mt-0.5 text-gray-400">
                  Add your flights, hotel stays, or destinations above. Everything will be ordered date-wise.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {dayGroups.map((group) => {
                  const completedCount = group.items.filter((m) => m.isCompleted).length;
                  const totalCount = group.items.length;
                  const isDayComplete = totalCount > 0 && completedCount === totalCount;

                  return (
                    <div
                      key={group.dateKey}
                      id={`day-group-${group.dateKey}`}
                      className={`rounded-2xl p-3 sm:p-4 bg-white shadow-xs scroll-mt-20 transition-all ${
                        isDayComplete
                          ? 'border border-emerald-200/80 bg-gradient-to-b from-[#f9fbf9] to-white shadow-xs'
                          : ''
                      }`}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isDayComplete ? 'bg-emerald-600' : 'bg-[#4a6454]'
                            }`}
                          />
                          <h3 className="text-xs sm:text-sm font-bold text-gray-800 truncate">
                            {group.header}
                          </h3>
                          {group.relative && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                              {group.relative}
                            </span>
                          )}
                        </div>

                        {/* Day Completion Badge or Stop Count */}
                        {isDayComplete ? (
                          <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#e8f5ec] text-[#1e5230] border border-[#b2ddbe] shadow-2xs shrink-0 animate-in fade-in zoom-in-95 duration-200">
                            <span>✓</span>
                            <span>Day Complete ({completedCount}/{totalCount})</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium shrink-0">
                            {completedCount > 0
                              ? `${completedCount}/${totalCount} visited`
                              : `${totalCount} ${totalCount === 1 ? 'stop' : 'stops'}`}
                          </span>
                        )}
                      </div>

                    {/* Day items */}
                    <div className="flex flex-col gap-1.5">
                      {group.items.map((m, idx) => {
                        const cat = getActivityCategory(m.title);
                        const formattedTime = formatTime12h(m.targetTime);

                        return (
                          <div
                            key={m._id}
                            onClick={() => openStopDetails(m)}
                            className="p-2 sm:p-2.5 rounded-lg flex items-center justify-between gap-2 transition-colors hover:bg-gray-50/80 cursor-pointer"
                            style={{
                              backgroundColor: m.isCompleted ? '#f9faf8' : '#ffffff',
                              border: '1px solid #f0f3f0',
                            }}
                            title="Click to view or edit stop details"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {/* Complete Checkbox with min 44px clickable hitbox */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMilestone(m._id, m.isCompleted);
                                }}
                                className="w-11 h-11 min-w-[44px] min-h-[44px] -ml-2 -my-2 flex items-center justify-center shrink-0 transition-all cursor-pointer"
                                title={m.isCompleted ? 'Mark unvisited' : 'Mark visited'}
                                aria-label={m.isCompleted ? 'Mark unvisited' : 'Mark visited'}
                              >
                                <span
                                  className="w-4 h-4 rounded-full flex items-center justify-center transition-all"
                                  style={{
                                    backgroundColor: m.isCompleted ? '#4a6454' : 'transparent',
                                    border: `1.5px solid ${m.isCompleted ? '#4a6454' : '#b0cdba'}`,
                                  }}
                                >
                                  {m.isCompleted && (
                                    <span className="text-white text-[9px] font-bold">✓</span>
                                  )}
                                </span>
                              </button>

                              {/* Category Emoji Badge */}
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 select-none"
                                style={{ backgroundColor: cat.bg }}
                                title={cat.label}
                              >
                                {cat.emoji}
                              </div>

                              {/* Stop Title & Time Badges */}
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`text-xs sm:text-sm font-medium truncate ${
                                      m.isCompleted ? 'line-through text-gray-400' : 'text-[#1a1e1c]'
                                    }`}
                                  >
                                    {m.title}
                                  </span>

                                  {/* Desktop inline time badge */}
                                  {formattedTime && (
                                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                      ⏰ {formattedTime}
                                    </span>
                                  )}
                                </div>

                                {/* Mobile: subtle time pill below the stop title */}
                                {formattedTime && (
                                  <div className="flex sm:hidden mt-0.5">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                      ⏰ {formattedTime}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions: Intra-day Reorder & Delete */}
                            <div className="flex items-center gap-1 shrink-0">
                              {group.items.length > 1 && (
                                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveMilestone(m._id, 'up', group.items);
                                    }}
                                    className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-xs transition-colors ${
                                      idx === 0
                                        ? 'text-gray-200 cursor-not-allowed'
                                        : 'text-gray-400 hover:text-[#4a6454] hover:bg-gray-100 cursor-pointer'
                                    }`}
                                    title="Move earlier in day schedule"
                                    aria-label="Move earlier in day schedule"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === group.items.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveMilestone(m._id, 'down', group.items);
                                    }}
                                    className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-xs transition-colors ${
                                      idx === group.items.length - 1
                                        ? 'text-gray-200 cursor-not-allowed'
                                        : 'text-gray-400 hover:text-[#4a6454] hover:bg-gray-100 cursor-pointer'
                                    }`}
                                    title="Move later in day schedule"
                                    aria-label="Move later in day schedule"
                                  >
                                    ▼
                                  </button>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteMilestone(m._id);
                                }}
                                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50/60 transition-colors cursor-pointer text-sm shrink-0 -mr-1"
                                title="Remove stop"
                                aria-label="Remove stop"
                              >
                                ✕
                              </button>

                              <span className="text-gray-300 text-xs pl-0.5">›</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. SINGLE FLOATING ACTION BUTTON (FAB) FOR QUICK ITINERARY STOP ENTRY */}
          <button
            type="button"
            onClick={() => setIsAddStopSheetOpen(true)}
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 sm:bottom-8 sm:right-8 z-30 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#4a6454] hover:bg-[#385041] text-white shadow-lg shadow-black/15 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            aria-label="Add Stop to Itinerary"
            title="Add Stop (+)"
          >
            <span className="text-2xl sm:text-3xl font-light leading-none group-hover:rotate-90 transition-transform duration-200">
              +
            </span>
          </button>
        </>
      )}

      {/* TRIP NOTES TAB CONTENT (Apple Notes-style Full-Height Dedicated Canvas) */}
      {activeTab === 'notes' && (
        <div className="rounded-2xl sm:rounded-3xl bg-white shadow-xs border border-[#e4e5e0] overflow-hidden flex flex-col relative transition-all">
          {/* Header */}
          <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-gray-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">📝</span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-gray-800 leading-tight">
                  Trip Notes &amp; Logistics
                </h2>
                <p className="text-[11px] text-gray-400">
                  Shared real-time notepad for Wi-Fi, flight PNRs, addresses &amp; gate codes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyNotes}
                disabled={!notes.trim()}
                className={`text-xs font-semibold px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 ${
                  !notes.trim()
                    ? 'text-gray-300 cursor-not-allowed'
                    : notesCopied
                    ? 'bg-[#e8f0eb] text-[#244b34] border border-[#b0cdba]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer'
                }`}
                title="Copy notes to clipboard"
              >
                <span>{notesCopied ? '✓' : '📋'}</span>
                <span className="hidden sm:inline">{notesCopied ? 'Copied!' : 'Copy'}</span>
              </button>
              <span className="text-[11px] text-gray-400 hidden sm:inline font-mono">
                {notes.trim() ? `${notes.trim().split(/\s+/).length} words` : 'Empty note'}
              </span>
            </div>
          </div>

          {/* Offline Warning Toast / Banner */}
          {isOffline && (
            <div className="mx-3 mt-3 sm:mx-6 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm shrink-0">⚠️</span>
                <div className="min-w-0">
                  <span className="font-bold">Offline:</span>
                  <span className="ml-1 text-amber-800 text-xs">
                    {isNotesChanged
                      ? 'Changes preserved in memory, will auto-sync once connected.'
                      : 'Changes cannot sync until internet is restored.'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 shrink-0">
                Offline
              </span>
            </div>
          )}

          {notesError && (
            <div className="mx-3 mt-3 sm:mx-6 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
              {notesError}
            </div>
          )}

          {/* Dedicated Full-Height Apple Notes-Style Textarea */}
          <textarea
            placeholder="Wi-Fi passwords, gate codes, booking IDs, addresses..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-[55vh] sm:h-[60vh] p-4 sm:p-6 text-sm sm:text-base leading-relaxed bg-[#fbfcfb] sm:bg-[#fcfdfc] border-0 outline-none resize-none focus:outline-none focus:bg-white text-gray-800 placeholder:text-gray-300 transition-colors font-sans"
          />

          {/* Sticky Sync Status Bar at bottom */}
          <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 py-2.5 sm:px-6 sm:py-3 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 text-xs">
              {isOffline && isNotesChanged ? (
                <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Offline (pending sync)</span>
                </span>
              ) : savingNotes ? (
                <span className="font-semibold text-[#4a6454] bg-[#eef1ee] border border-[#d8dbd7] px-2.5 py-1 rounded-full flex items-center gap-1.5 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4a6454] animate-ping" />
                  <span>Auto-saving to trip…</span>
                </span>
              ) : autoSaveCountdown !== null ? (
                <span className="font-semibold text-[#424843] bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7e9a88]" />
                  <span>Auto-saving in {autoSaveCountdown}s…</span>
                </span>
              ) : isNotesChanged ? (
                <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Unsaved changes</span>
                </span>
              ) : (
                <span className="font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full flex items-center gap-1.5 text-[11px]">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Auto-saved to trip</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyNotes}
                disabled={!notes.trim()}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  !notes.trim()
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                    : notesCopied
                    ? 'bg-[#e8f0eb] text-[#244b34] border border-[#b0cdba]'
                    : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 cursor-pointer shadow-2xs active:scale-95'
                }`}
                title="Copy notes to clipboard to share in WhatsApp or group chats"
              >
                <span>{notesCopied ? '✓' : '📋'}</span>
                <span>{notesCopied ? 'Copied!' : 'Copy Notes'}</span>
              </button>

              <button
                type="button"
                onClick={handleManualSave}
                disabled={!isNotesChanged || savingNotes || isOffline}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  !isNotesChanged || savingNotes || isOffline
                    ? 'bg-gray-100/80 text-gray-400 border border-gray-200/50 cursor-not-allowed opacity-60'
                    : 'bg-[#4a6454] hover:bg-[#385041] text-white cursor-pointer shadow-2xs active:scale-95'
                }`}
                title={!isNotesChanged ? 'All changes auto-saved to trip' : 'Click to save now'}
              >
                <span>💾</span>
                <span>
                  {savingNotes
                    ? 'Saving…'
                    : !isNotesChanged
                    ? 'Saved ✓'
                    : 'Save now'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SLIDE-UP BOTTOM SHEET: ADD STOP TO ITINERARY */}
      {isAddStopSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          style={{ backgroundColor: 'rgba(15, 23, 19, 0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddStopSheetOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-2xl max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-gray-300/80 rounded-full mx-auto mb-3.5 sm:hidden shrink-0 cursor-grab" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🗓️</span>
                <div>
                  <h3 className="font-bold text-gray-900 text-base sm:text-lg">
                    Add to Itinerary
                  </h3>
                  <p className="text-xs text-gray-400">
                    Schedule an activity, transit, stay, or destination
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStopSheetOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-base transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {milestoneError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between">
                <span>⚠️ {milestoneError}</span>
                <button
                  type="button"
                  onClick={() => setMilestoneError('')}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-xs font-bold text-red-600 hover:text-red-900 cursor-pointer shrink-0"
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                await handleAddMilestone(e);
                setIsAddStopSheetOpen(false);
              }}
              className="space-y-4"
            >
              {/* Title input */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Activity or destination <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Stop name (e.g. Flight, Hotel, Dinner)"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (milestoneError) setMilestoneError('');
                  }}
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#f7faf6] border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] focus:bg-white transition-all text-gray-800"
                />
              </div>

              {/* Day / Date Selector */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Scheduled day / date
                </label>
                <input
                  type="date"
                  value={targetDate}
                  min={startDate || undefined}
                  max={endDate || undefined}
                  onChange={(e) => {
                    setTargetDate(e.target.value);
                    if (milestoneError) setMilestoneError('');
                  }}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#f7faf6] border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] focus:bg-white transition-all text-gray-800"
                />
              </div>

              {/* Time input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Activity time <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  {targetTime && (
                    <button
                      type="button"
                      onClick={() => setTargetTime('')}
                      className="text-[11px] text-gray-400 hover:text-red-500 cursor-pointer"
                    >
                      Clear time
                    </button>
                  )}
                </div>
                <input
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#f7faf6] border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] focus:bg-white transition-all text-gray-800"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddStopSheetOpen(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isTitleEmpty || loading}
                  className={`px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    isTitleEmpty || loading
                      ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                      : 'bg-[#4a6454] hover:bg-[#385041] text-white cursor-pointer shadow-xs active:scale-95'
                  }`}
                >
                  <span>{loading ? 'Adding…' : '+ Add Stop to Itinerary'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. SLIDE-UP BOTTOM SHEET: STOP DETAILS */}
      {selectedMilestone && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          style={{ backgroundColor: 'rgba(15, 23, 19, 0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeStopDetails();
          }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-2xl max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-gray-300/80 rounded-full mx-auto mb-3.5 sm:hidden shrink-0 cursor-grab" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {getActivityCategory(detailTitle || selectedMilestone.title).emoji}
                </span>
                <div>
                  <h3 className="font-bold text-gray-900 text-base sm:text-lg">
                    Stop details
                  </h3>
                  <p className="text-xs text-gray-400">
                    View and update scheduled itinerary activity
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeStopDetails}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-base transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {detailError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between">
                <span>⚠️ {detailError}</span>
                <button
                  type="button"
                  onClick={() => setDetailError('')}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-xs font-bold text-red-600 hover:text-red-900 cursor-pointer shrink-0"
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleSaveStopDetails} className="space-y-4">
              {/* Title input */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Activity or destination
                </label>
                <input
                  type="text"
                  placeholder="Stop name"
                  value={detailTitle}
                  onChange={(e) => setDetailTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#f7faf6] border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] focus:bg-white transition-all text-gray-800"
                />
              </div>

              {/* Day / Date Selector */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Scheduled day / date
                </label>
                <input
                  type="date"
                  value={detailDate}
                  min={startDate || undefined}
                  max={endDate || undefined}
                  onChange={(e) => setDetailDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#f7faf6] border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] focus:bg-white transition-all text-gray-800"
                />
              </div>

              {/* Time input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Activity time <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  {detailTime && (
                    <button
                      type="button"
                      onClick={() => setDetailTime('')}
                      className="text-[11px] text-gray-400 hover:text-red-500 cursor-pointer"
                    >
                      Clear time
                    </button>
                  )}
                </div>

                <input
                  type="time"
                  value={detailTime}
                  onChange={(e) => setDetailTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#f7faf6] border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] focus:bg-white transition-all text-gray-800"
                />
              </div>

              {/* Status Checkbox */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setDetailCompleted((prev) => !prev)}
                  className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                    detailCompleted
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <span className="text-base">{detailCompleted ? '✓' : '○'}</span>
                    <span>{detailCompleted ? 'Marked as visited' : 'Mark as visited'}</span>
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {detailCompleted ? 'Completed' : 'Upcoming'}
                  </span>
                </button>
              </div>

              {/* Action Buttons: Delete & Save */}
              <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleDeleteStopDetails}
                  disabled={detailDeleting}
                  className="min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer transition-colors inline-flex items-center justify-center"
                >
                  {detailDeleting ? 'Deleting…' : 'Delete'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeStopDetails}
                    className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={!detailTitle.trim() || detailSaving}
                    className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-[#4a6454] hover:bg-[#385041] text-white cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 transition-all inline-flex items-center justify-center"
                  >
                    {detailSaving ? 'Saving…' : 'Save Changes'}
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
