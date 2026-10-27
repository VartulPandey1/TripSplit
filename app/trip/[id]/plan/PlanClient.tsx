'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export interface Milestone {
  _id: string;
  title: string;
  targetDate?: string;
  targetTime?: string;
  order?: number;
  isCompleted: boolean;
}

interface PlanClientProps {
  tripId: string;
  initialMilestones: Milestone[];
  tripName?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  initialNotes?: string;
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

function getRelativeDateLabel(dateStr: string): string | null {
  if (!dateStr) return null;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
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
}: PlanClientProps) {
  const router = useRouter();
  const [milestones, setMilestones] = useState<Milestone[]>(() =>
    sortMilestonesDateWise(initialMilestones)
  );
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState(startDate || '');
  const [targetTime, setTargetTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [milestoneError, setMilestoneError] = useState('');

  // Shared Notes state (persisted to MongoDB via /api/trips/[id])
  const [notes, setNotes] = useState(initialNotes || '');
  const [savedNotesValue, setSavedNotesValue] = useState(initialNotes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [autoSaveCountdown, setAutoSaveCountdown] = useState<number | null>(null);

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

  const totalStops = milestones.length;
  const completedStops = milestones.filter((m) => m.isCompleted).length;
  const completionPercent = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  return (
    <div className="px-3 py-3 sm:px-6 sm:py-6 max-w-4xl mx-auto space-y-3 sm:space-y-4">
      {/* 1. TRIP HEADER WITH PROGRESS */}
      <div
        className="rounded-2xl sm:rounded-3xl p-4 sm:p-6"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border)',
          boxShadow: '0 2px 10px -2px rgba(26,30,28,0.04)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg sm:text-xl">🗺️</span>
              <h1
                className="text-xl sm:text-3xl font-bold tracking-tight text-[#1a1e1c]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {tripName} Itinerary
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

      {/* 2. ADD TO ITINERARY SECTION */}
      <div
        className="rounded-2xl sm:rounded-3xl p-4 sm:p-6"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border)',
          boxShadow: '0 2px 10px -2px rgba(26,30,28,0.04)',
        }}
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
            placeholder="e.g. Flight 6E-204, Hotel Check-in, Sunset Cruise..."
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
            {dayGroups.map((group) => (
              <div
                key={group.dateKey}
                className="rounded-2xl p-3 sm:p-4 bg-white border border-gray-200 shadow-2xs"
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4a6454]" />
                    <h3 className="text-xs sm:text-sm font-bold text-gray-800">
                      {group.header}
                    </h3>
                    {group.relative && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {group.relative}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {group.items.length} {group.items.length === 1 ? 'stop' : 'stops'}
                  </span>
                </div>

                {/* Day items */}
                <div className="flex flex-col gap-1.5">
                  {group.items.map((m, idx) => {
                    const cat = getActivityCategory(m.title);
                    const formattedTime = formatTime12h(m.targetTime);

                    return (
                      <div
                        key={m._id}
                        className="p-2 sm:p-2.5 rounded-lg flex items-center justify-between gap-2 transition-colors hover:bg-[#fafbfa]"
                        style={{
                          backgroundColor: m.isCompleted ? '#f9faf8' : '#ffffff',
                          border: '1px solid #f0f3f0',
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Complete Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleMilestone(m._id, m.isCompleted)}
                            className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer"
                            style={{
                              backgroundColor: m.isCompleted ? '#4a6454' : 'transparent',
                              border: `1.5px solid ${m.isCompleted ? '#4a6454' : '#b0cdba'}`,
                            }}
                            title={m.isCompleted ? 'Mark unvisited' : 'Mark visited'}
                          >
                            {m.isCompleted && (
                              <span className="text-white text-[9px] font-bold">✓</span>
                            )}
                          </button>

                          {/* Category Emoji Badge */}
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 select-none"
                            style={{ backgroundColor: cat.bg }}
                            title={cat.label}
                          >
                            {cat.emoji}
                          </div>

                          {/* Time badge if specified */}
                          {formattedTime && (
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                              ⏰ {formattedTime}
                            </span>
                          )}

                          {/* Title */}
                          <span
                            className={`text-xs sm:text-sm font-medium truncate ${
                              m.isCompleted ? 'line-through text-gray-400' : 'text-[#1a1e1c]'
                            }`}
                          >
                            {m.title}
                          </span>
                        </div>

                        {/* Actions: Intra-day Reorder & Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {group.items.length > 1 && (
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveMilestone(m._id, 'up', group.items)}
                                className={`w-5 h-5 rounded flex items-center justify-center text-[10px] transition-colors ${
                                  idx === 0
                                    ? 'text-gray-200 cursor-not-allowed'
                                    : 'text-gray-400 hover:text-[#4a6454] hover:bg-gray-100 cursor-pointer'
                                }`}
                                title="Move earlier in day schedule"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={idx === group.items.length - 1}
                                onClick={() => moveMilestone(m._id, 'down', group.items)}
                                className={`w-5 h-5 rounded flex items-center justify-center text-[10px] transition-colors ${
                                  idx === group.items.length - 1
                                    ? 'text-gray-200 cursor-not-allowed'
                                    : 'text-gray-400 hover:text-[#4a6454] hover:bg-gray-100 cursor-pointer'
                                }`}
                                title="Move later in day schedule"
                              >
                                ▼
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => deleteMilestone(m._id)}
                            className="text-gray-300 hover:text-red-500 transition-colors p-0.5 cursor-pointer text-xs shrink-0"
                            title="Remove stop"
                          >
                            ✕
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

      {/* 4. SHARED NOTES & LOGISTICS (SYNCS WITH TRIP DB) */}
      <div
        className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white border border-gray-200 shadow-2xs"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg">📝</span>
            <h2 className="text-sm sm:text-base font-bold text-gray-800">
              Shared Notes & Logistics
            </h2>
          </div>
          {notesSaved && (
            <span className="text-xs text-[#4a6454] font-semibold bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <span>Saved to Trip</span>
              <span>✓</span>
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-2.5">
          Shared with all trip members in real time. Wi-Fi codes, flight PNRs, booking links, gate passwords, etc.
        </p>

        {/* Offline Warning Toast / Banner */}
        {isOffline && (
          <div className="mb-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-1.5 shadow-2xs">
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
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase shrink-0">
              Offline
            </span>
          </div>
        )}

        {notesError && (
          <p className="text-xs text-red-600 mb-2 font-medium">{notesError}</p>
        )}

        <textarea
          placeholder="e.g. Wi-Fi password, villa gate code, flight booking references, check-in instructions..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl p-3 text-xs sm:text-sm bg-[#f7faf6] border border-gray-200 outline-none resize-none h-24 sm:h-32 focus:border-[#4a6454] transition-colors"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px]">
            {isOffline && isNotesChanged ? (
              <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Offline — pending sync
              </span>
            ) : savingNotes ? (
              <span className="font-semibold text-[#4a6454] bg-[#eef1ee] border border-[#d8dbd7] px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4a6454] animate-ping" />
                Auto-saving…
              </span>
            ) : autoSaveCountdown !== null ? (
              <span className="font-semibold text-[#424843] bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7e9a88]" />
                Auto-saving in {autoSaveCountdown}s…
              </span>
            ) : notesSaved ? (
              <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                ✓ Saved to Trip
              </span>
            ) : isNotesChanged ? (
              <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes
              </span>
            ) : (
              <span className="text-gray-400">
                Shared with all trip members • Auto-saves as you type
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleManualSave}
            disabled={!isNotesChanged || savingNotes || isOffline}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1 ${
              !isNotesChanged || savingNotes || isOffline
                ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                : 'bg-[#4a6454] hover:bg-[#385041] text-white cursor-pointer shadow-2xs'
            }`}
            title={!isNotesChanged ? 'No changes to save' : 'Click to save immediately'}
          >
            <span>💾</span>
            <span>
              {savingNotes
                ? 'Saving…'
                : notesSaved && !isNotesChanged
                ? 'Saved ✓'
                : !isNotesChanged
                ? 'All Saved'
                : 'Save Notes'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
