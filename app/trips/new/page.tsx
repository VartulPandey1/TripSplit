'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import AuthCard from '@/app/components/AuthCard';
import { CURRENCIES, getCurrencySymbol } from '@/lib/utils/currency';

interface CreatedTrip {
  _id: string;
  name: string;
  destinationQuery: string;
  roomCode: string;
  startDate: string;
  endDate: string;
  currency: string;
}

const POPULAR_DESTINATIONS = [
  { label: '🏖️ Goa', name: 'Goa with friends', dest: 'Goa' },
  { label: '⛰️ Himachal', name: 'Himachal Trek', dest: 'Himachal' },
  { label: '🌴 Kerala', name: 'Kerala Trip', dest: 'Kerala' },
  { label: '🏰 Rajasthan', name: 'Rajasthan Roadtrip', dest: 'Rajasthan' },
  { label: '🏔️ Ladakh', name: 'Ladakh Adventure', dest: 'Ladakh' },
  { label: '🏝️ Bali', name: 'Bali Getaway', dest: 'Bali' },
];

function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computePreset(type: 'this_weekend' | 'next_weekend' | 'next_week' | 'next_month'): { start: string; end: string } {
  const now = new Date();
  if (type === 'this_weekend') {
    const day = now.getDay();
    let daysUntilFri = 0;
    if (day === 5) daysUntilFri = 0;
    else if (day === 6) daysUntilFri = -1;
    else if (day === 0) daysUntilFri = 5;
    else daysUntilFri = 5 - day;
    const fri = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilFri);
    const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilFri + (day === 6 ? 1 : 2));
    return { start: toDateInputValue(fri), end: toDateInputValue(sun) };
  } else if (type === 'next_weekend') {
    const day = now.getDay();
    let daysUntilFri = 0;
    if (day === 5) daysUntilFri = 0;
    else if (day === 6) daysUntilFri = -1;
    else if (day === 0) daysUntilFri = 5;
    else daysUntilFri = 5 - day;
    const fri = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilFri + 7);
    const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilFri + 7 + (day === 6 ? 1 : 2));
    return { start: toDateInputValue(fri), end: toDateInputValue(sun) };
  } else if (type === 'next_week') {
    const day = now.getDay();
    const daysUntilNextMon = ((8 - day) % 7) || 7;
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilNextMon);
    const fri = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilNextMon + 4);
    return { start: toDateInputValue(mon), end: toDateInputValue(fri) };
  } else {
    const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const fifth = new Date(now.getFullYear(), now.getMonth() + 1, 5);
    return { start: toDateInputValue(first), end: toDateInputValue(fifth) };
  }
}

function deriveDestination(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  let clean = trimmed.replace(/^(trip to|weekend in|roadtrip to|vacation in|trip in)\s+/i, '');
  clean = clean.replace(/\s+(with\s+friends|with\s+family|trip|trek|tour|getaway|vacation|\d{4})$/i, '');
  clean = clean.trim();
  return clean || trimmed;
}

function formatDurationSummary(startDateStr: string, endDateStr: string): string | null {
  if (!startDateStr || !endDateStr) return null;
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return null;

  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const startFormatted = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endFormatted = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const nights = diffDays - 1;
  const durationDesc = nights > 0 ? `${diffDays} days (${nights} night${nights > 1 ? 's' : ''})` : '1-day trip';

  return `${durationDesc} • ${startFormatted} – ${endFormatted}`;
}

function NewTripForm() {
  const router = useRouter();

  // Wizard state: 1: Destination, 2: Dates, 'invite': Instant Invite Sheet
  const [step, setStep] = useState<1 | 2 | 'invite'>(1);

  // Form values
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [isCustomDest, setIsCustomDest] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<'this_weekend' | 'next_weekend' | 'next_week' | 'next_month' | null>(null);
  const [currency, setCurrency] = useState('INR'); // Smart default to local INR
  const [showCurrencySelect, setShowCurrencySelect] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdTrip, setCreatedTrip] = useState<CreatedTrip | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
      setHasNativeShare(true);
    }
  }, []);

  function handleNameChange(val: string) {
    setName(val);
    if (!isCustomDest) {
      setDestination(deriveDestination(val));
    }
    if (error) setError('');
  }

  function handleSelectDestinationChip(chip: { name: string; dest: string }) {
    setName(chip.name);
    setDestination(chip.dest);
    setIsCustomDest(false);
    if (error) setError('');
  }

  function handleStartDateChange(val: string) {
    setStartDate(val);
    setSelectedPreset(null);
    if (endDate && val && endDate < val) {
      setEndDate(val);
    }
    if (error) setError('');
  }

  function handleEndDateChange(val: string) {
    setEndDate(val);
    setSelectedPreset(null);
    if (startDate && val && val < startDate) {
      setError('End date cannot be earlier than start date');
    } else if (error) {
      setError('');
    }
  }

  function applyPreset(type: 'this_weekend' | 'next_weekend' | 'next_week' | 'next_month') {
    const range = computePreset(type);
    setStartDate(range.start);
    setEndDate(range.end);
    setSelectedPreset(type);
    if (error) setError('');
  }

  function handleStep1Next(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please tell us where you are going');
      return;
    }
    setError('');
    setStep(2);
  }

  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    const effectiveDest = destination.trim() || deriveDestination(trimmedName) || trimmedName;

    if (!trimmedName) {
      setError('Trip name cannot be blank');
      setStep(1);
      return;
    }
    if (!startDate || !endDate) {
      setError('Please pick your travel dates');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('End date cannot be earlier than start date');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          destinationQuery: effectiveDest,
          startDate,
          endDate,
          currency: currency || 'INR',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create trip');
        setLoading(false);
      } else {
        const trip: CreatedTrip = await res.json();
        setCreatedTrip(trip);
        setStep('invite');
        setLoading(false);
      }
    } catch {
      setError('Failed to create trip. Please try again.');
      setLoading(false);
    }
  }

  function getInviteUrl(code: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tripsplit.app';
    return `${origin}/trips/join?code=${code}`;
  }

  function handleShareWhatsApp() {
    if (!createdTrip) return;
    const url = getInviteUrl(createdTrip.roomCode);
    const message = `Hey! I just created our trip "${createdTrip.name}" on TripSplit ✈️\n\nTap here to join, split expenses & organize packing:\n${url}\n\n(Room Code: ${createdTrip.roomCode})`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  function handleCopyCode() {
    if (!createdTrip?.roomCode) return;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(createdTrip.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  function handleCopyInviteLink() {
    if (!createdTrip?.roomCode) return;
    const url = getInviteUrl(createdTrip.roomCode);
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  async function handleNativeShare() {
    if (!createdTrip) return;
    const url = getInviteUrl(createdTrip.roomCode);
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: `Join ${createdTrip.name} on TripSplit`,
          text: `Join our trip "${createdTrip.name}" on TripSplit! Track expenses, split bills & plan gear:`,
          url,
        });
        return;
      } catch {
        // Fallback silently
      }
    }
    handleCopyInviteLink();
  }

  const durationSummary = formatDurationSummary(startDate, endDate);

  return (
    <AuthCard>
      {/* Top Header / Logo */}
      <div className="flex items-center justify-between mb-6">
        <Logo />
        {step !== 'invite' && (
          <Link
            href="/dashboard"
            className="min-h-[44px] min-w-[44px] px-2.5 py-1 text-xs text-gray-400 hover:text-gray-700 transition-colors inline-flex items-center justify-center"
            title="Cancel and return to dashboard"
            aria-label="Cancel"
          >
            ✕ Cancel
          </Link>
        )}
      </div>

      {/* Progress Indicator for Step 1 and 2 */}
      {step !== 'invite' && (
        <div className="flex items-center gap-2 mb-6">
          <div
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              step >= 1 ? 'bg-[#4a6454]' : 'bg-gray-200'
            }`}
          />
          <div
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              step === 2 ? 'bg-[#4a6454]' : 'bg-gray-200'
            }`}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 1: "Where are you going?"
         ───────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <form onSubmit={handleStep1Next} className="flex flex-col">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-[#4a6454] bg-[#eef3ee] mb-2.5">
              <span>Step 1 of 2</span>
              <span>•</span>
              <span>Destination</span>
            </span>
            <h1
              className="text-2xl sm:text-[1.75rem] font-semibold text-gray-900 tracking-tight"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Where are you going?
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 font-body">
              Name your trip or pick a destination
            </p>
          </div>

          {/* Primary Trip / Destination Input */}
          <div className="relative mb-3">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              ✈️
            </div>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Trip name (e.g. Goa, Ladakh)"
              className="w-full rounded-2xl pl-11 pr-10 py-3.5 text-base text-gray-900 outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
              style={{
                border: '1.5px solid var(--color-border)',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = '1.5px solid #4a6454';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,100,84,0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1.5px solid var(--color-border)';
                e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(26,30,28,0.04)';
              }}
            />
            {name && (
              <button
                type="button"
                onClick={() => {
                  setName('');
                  setDestination('');
                  setIsCustomDest(false);
                }}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Smart Location inference pill / customize */}
          {name.trim() && (
            <div className="flex items-center justify-between px-1 mb-4 text-xs text-gray-500">
              <span className="flex items-center gap-1 truncate">
                <span>📍 Tag:</span>
                <strong className="text-gray-800 font-medium truncate">
                  {destination || deriveDestination(name)}
                </strong>
              </span>
              {!isCustomDest ? (
                <button
                  type="button"
                  onClick={() => setIsCustomDest(true)}
                  className="text-[#4a6454] hover:underline font-medium text-[11px] shrink-0 ml-2"
                >
                  Edit tag
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomDest(false);
                    setDestination(deriveDestination(name));
                  }}
                  className="text-gray-400 hover:text-gray-600 text-[11px] shrink-0 ml-2"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Optional inline custom destination editor */}
          {isCustomDest && (
            <div className="mb-4">
              <input
                type="text"
                placeholder="Specific city or country (e.g. Goa, India)"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-[#4a6454] bg-white text-gray-800"
              />
            </div>
          )}

          {/* Quick Destination Pill Suggestions */}
          <div className="mb-6">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block mb-2 px-1">
              Popular Getaways
            </span>
            <div className="flex flex-wrap gap-2">
              {POPULAR_DESTINATIONS.map((chip) => (
                <button
                  key={chip.dest}
                  type="button"
                  onClick={() => handleSelectDestinationChip(chip)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                    destination === chip.dest
                      ? 'border-[#4a6454] bg-[#eef3ee] text-[#4a6454] font-medium shadow-xs'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs px-3.5 py-2 rounded-xl text-center mb-4 text-[#ba1a1a] bg-[#ffdad6]">
              {error}
            </p>
          )}

          {/* Continue button */}
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full font-medium text-white rounded-2xl py-3.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer bg-[#4a6454] hover:bg-[#3d5345] shadow-sm flex items-center justify-center gap-2"
          >
            <span>Next: Choose Dates</span>
            <span>→</span>
          </button>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STEP 2: "When?" (Quick Date Selector)
         ───────────────────────────────────────────────────────────── */}
      {step === 2 && (
        <form onSubmit={handleCreateTrip} className="flex flex-col">
          <div className="text-center mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-[#4a6454] bg-[#eef3ee] mb-2.5">
              <span>Step 2 of 2</span>
              <span>•</span>
              <span>{name}</span>
            </span>
            <h1
              className="text-2xl sm:text-[1.75rem] font-semibold text-gray-900 tracking-tight"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              When are you traveling?
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 font-body">
              Pick your dates or choose a quick preset
            </p>
          </div>

          {/* Quick Date Presets */}
          <div className="mb-4">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block mb-2 px-1">
              Quick Presets
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('this_weekend')}
                className={`text-xs px-3 py-2.5 rounded-xl border text-center transition-all ${
                  selectedPreset === 'this_weekend'
                    ? 'border-[#4a6454] bg-[#4a6454] text-white font-medium shadow-xs'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                🏖️ This Weekend
              </button>
              <button
                type="button"
                onClick={() => applyPreset('next_weekend')}
                className={`text-xs px-3 py-2.5 rounded-xl border text-center transition-all ${
                  selectedPreset === 'next_weekend'
                    ? 'border-[#4a6454] bg-[#4a6454] text-white font-medium shadow-xs'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                🌴 Next Weekend
              </button>
              <button
                type="button"
                onClick={() => applyPreset('next_week')}
                className={`text-xs px-3 py-2.5 rounded-xl border text-center transition-all ${
                  selectedPreset === 'next_week'
                    ? 'border-[#4a6454] bg-[#4a6454] text-white font-medium shadow-xs'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                🗓️ Next Week (5d)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('next_month')}
                className={`text-xs px-3 py-2.5 rounded-xl border text-center transition-all ${
                  selectedPreset === 'next_month'
                    ? 'border-[#4a6454] bg-[#4a6454] text-white font-medium shadow-xs'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                📅 Next Month
              </button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider px-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => handleStartDateChange(e.target.value)}
                required
                className="w-full rounded-2xl px-3.5 py-3 text-sm font-medium outline-none transition-all text-gray-800"
                style={{
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1.5px solid #4a6454';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,100,84,0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1.5px solid var(--color-border)';
                  e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(26,30,28,0.04)';
                }}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider px-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => handleEndDateChange(e.target.value)}
                required
                className="w-full rounded-2xl px-3.5 py-3 text-sm font-medium outline-none transition-all text-gray-800"
                style={{
                  border: '1.5px solid var(--color-border)',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1.5px solid #4a6454';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,100,84,0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1.5px solid var(--color-border)';
                  e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(26,30,28,0.04)';
                }}
              />
            </div>
          </div>

          {/* Live Duration Summary Pill */}
          {durationSummary && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#eef3ee] text-[#2d4235] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#dce8dc]">
              <span>🗓️</span>
              <span>{durationSummary}</span>
            </div>
          )}

          {/* Smart Defaults: Currency automatically defaults to local currency (INR) without needing to configure up-front */}
          <div className="mb-5 pt-1 text-center">
            <button
              type="button"
              onClick={() => setShowCurrencySelect(!showCurrencySelect)}
              className="text-xs text-gray-500 hover:text-gray-800 transition-colors inline-flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-gray-100/60"
            >
              <span>
                Default Currency: <strong className="text-gray-700">{getCurrencySymbol(currency)} {currency}</strong>
              </span>
              <span className="text-[10px] text-gray-400">
                ({showCurrencySelect ? 'hide' : 'tap to change'})
              </span>
            </button>

            {showCurrencySelect && (
              <div className="mt-2 text-left bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider block mb-1">
                  Change Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs border border-gray-300 bg-white text-gray-800 outline-none focus:border-[#4a6454]"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs px-3.5 py-2 rounded-xl text-center mb-4 text-[#ba1a1a] bg-[#ffdad6]">
              {error}
            </p>
          )}

          {/* Action buttons: Back + Create */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep(1);
              }}
              className="px-4 py-3.5 rounded-2xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={loading || !startDate || !endDate}
              className="flex-1 font-medium text-white rounded-2xl py-3.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-[#4a6454] hover:bg-[#3d5345] shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Trip...</span>
                </>
              ) : (
                <>
                  <span>✨ Create Trip</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────
          INSTANT INVITE LINK SHEET: Shown right after trip creation
         ───────────────────────────────────────────────────────────── */}
      {step === 'invite' && createdTrip && (
        <div className="flex flex-col items-center text-center">
          {/* Celebratory Icon */}
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-3 shadow-xs">
            🎉
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-800 bg-emerald-100 mb-2">
            Trip Created!
          </span>

          <h1
            className="text-2xl font-bold tracking-tight text-gray-900 mb-1"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {createdTrip.name}
          </h1>

          <p className="text-xs sm:text-sm text-gray-500 mb-6 font-body max-w-xs">
            Invite your travel crew now so everyone can start splitting expenses and organizing gear!
          </p>

          {/* Prominent WhatsApp Invite Button */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl text-white font-medium shadow-md hover:shadow-lg transition-all active:scale-[0.99] mb-4 cursor-pointer"
            style={{ backgroundColor: '#25D366' }}
          >
            <WhatsAppIcon className="w-5 h-5 fill-current" />
            <span className="text-sm sm:text-base font-semibold tracking-wide">
              Send WhatsApp Invite
            </span>
          </button>

          {/* Room Code Card */}
          <div className="w-full bg-[#f4f6f4] rounded-2xl p-4 mb-4 border border-gray-100 flex flex-col gap-2.5 text-left">
            <div className="flex items-center justify-between text-xs text-gray-500 font-medium px-1">
              <span className="tracking-wider uppercase text-[10px]">Room Code</span>
              <span className="text-[11px] text-gray-400">Share with friends to join</span>
            </div>

            <div className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-gray-200">
              <span className="font-mono text-xl font-bold tracking-widest text-[#1a1e1c]">
                {createdTrip.roomCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors select-none touch-manipulation active:scale-95"
              >
                {copiedCode ? '✓ Copied' : 'Copy Code'}
              </button>
            </div>

            {/* Direct Copy Invite Link */}
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors select-none touch-manipulation active:scale-95"
            >
              <span>🔗</span>
              <span>{copiedLink ? 'Invite Link Copied to Clipboard!' : 'Copy Direct Invite Link'}</span>
            </button>
          </div>

          {/* Native Share Sheet (Mobile) */}
          {hasNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-2 mb-2 text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>More share options (SMS, Telegram, AirDrop)...</span>
            </button>
          )}

          {/* Continue to Trip Overview Button */}
          <button
            type="button"
            onClick={() => router.push(`/trip/${createdTrip._id}/overview`)}
            className="w-full font-medium text-white rounded-2xl py-3.5 mt-2 transition-all cursor-pointer bg-[#4a6454] hover:bg-[#3d5345] shadow-sm flex items-center justify-center gap-2"
          >
            <span>Go to Trip Overview</span>
            <span>→</span>
          </button>

          <p className="text-[11px] text-gray-400 mt-2.5">
            You can always invite more friends later from the Trip Overview
          </p>
        </div>
      )}
    </AuthCard>
  );
}

export default function NewTripPage() {
  return (
    <Suspense
      fallback={
        <AuthCard>
          <div className="flex items-center justify-between mb-8">
            <Logo />
          </div>
          <div className="text-center py-12 text-sm text-gray-500">
            Loading trip planner…
          </div>
        </AuthCard>
      }
    >
      <NewTripForm />
    </Suspense>
  );
}
