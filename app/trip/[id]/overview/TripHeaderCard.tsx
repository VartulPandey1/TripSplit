'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAvatarEmoji } from '@/lib/constants/avatars';
import { getTripStatus, getTripStatusBadge, TripDisplayStatus } from '@/lib/utils/tripStatus';

interface Member {
  _id: string;
  username: string;
  avatarId?: string;
}

interface TripData {
  _id: string;
  name: string;
  destinationQuery: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  currency?: string;
  roomCode: string;
}

interface TripHeaderCardProps {
  trip: TripData;
  members: Member[];
  isCreator: boolean;
}

function formatDateRange(start?: string, end?: string) {
  if (!start && !end) return 'Dates not set';
  if (start && !end) return `From ${new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  if (!start && end) return `Until ${new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  
  const s = new Date(start!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(end!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

function toInputDate(val?: string) {
  if (!val) return '';
  try {
    return new Date(val).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export default function TripHeaderCard({ trip: initialTrip, members, isCreator }: TripHeaderCardProps) {
  const router = useRouter();
  const [trip, setTrip] = useState<TripData>(initialTrip);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Delete & Leave state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: initialTrip.name,
    destinationQuery: initialTrip.destinationQuery,
    startDate: toInputDate(initialTrip.startDate),
    endDate: toInputDate(initialTrip.endDate),
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const displayStatus: TripDisplayStatus = getTripStatus({
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
  });
  const badge = getTripStatusBadge(displayStatus);

  const isCompleted = displayStatus === 'completed';

  function handleCopyCode() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(trip.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  function getInviteUrl(): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tripsplit.app';
    return `${origin}/trips/join?code=${trip.roomCode}`;
  }

  function handleCopyInviteLink() {
    const url = getInviteUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  function handleShareWhatsApp() {
    const url = getInviteUrl();
    const message = `Join our trip "${trip.name}" on TripSplit!\nTap here to join: ${url}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleNativeShare() {
    const url = getInviteUrl();
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: `Join ${trip.name} on TripSplit`,
          text: `Join our trip "${trip.name}" on TripSplit!`,
          url: url,
        });
        return;
      } catch {
        // Fallback to clipboard if cancelled or unsupported
      }
    }
    handleCopyInviteLink();
  }

  function handleStartDateChange(val: string) {
    setEditForm((prev) => {
      const updated = { ...prev, startDate: val };
      // If end date is set and earlier than new start date, sync end date to start date
      if (val && prev.endDate && prev.endDate < val) {
        updated.endDate = val;
      }
      return updated;
    });
  }

  async function handleSaveTripDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.name.trim()) {
      setErrorMsg('Trip name is required');
      return;
    }
    if (!editForm.destinationQuery.trim()) {
      setErrorMsg('Destination is required');
      return;
    }
    if (editForm.startDate && editForm.endDate && editForm.endDate < editForm.startDate) {
      setErrorMsg('End date cannot be earlier than start date');
      return;
    }

    setSaveLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/trips/${trip._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          destinationQuery: editForm.destinationQuery.trim(),
          startDate: editForm.startDate || null,
          endDate: editForm.endDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update trip');
      }

      const updated = await res.json();
      setTrip((prev) => ({
        ...prev,
        name: updated.name,
        destinationQuery: updated.destinationQuery,
        startDate: updated.startDate ? new Date(updated.startDate).toISOString() : undefined,
        endDate: updated.endDate ? new Date(updated.endDate).toISOString() : undefined,
      }));
      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating trip details');
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleToggleTripStatus() {
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);

    // If currently completed, re-open to 'reopened' (or 'active' if dates are current)
    // If currently not completed, set to 'completed'
    const newStatus = isCompleted ? 'reopened' : 'completed';

    try {
      const res = await fetch(`/api/trips/${trip._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to toggle trip status');
      }

      const updated = await res.json();
      setTrip((prev) => ({
        ...prev,
        status: updated.status,
      }));
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle trip status');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleDeleteTrip() {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/trips/${trip._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || 'Failed to delete trip');
        setDeleteLoading(false);
        return;
      }
      router.push('/dashboard');
    } catch {
      setDeleteError('Network error while deleting trip');
      setDeleteLoading(false);
    }
  }

  async function handleLeaveTrip() {
    setLeaveLoading(true);
    setLeaveError('');
    try {
      const res = await fetch(`/api/trips/${trip._id}/leave`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setLeaveError(data.error || 'Failed to leave trip');
        setLeaveLoading(false);
        return;
      }
      router.push('/dashboard');
    } catch {
      setLeaveError('Network error while leaving trip');
      setLeaveLoading(false);
    }
  }

  return (
    <>
      <div
        className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-4 sm:mb-6"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border)',
          boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
        }}
      >
        {/* Top Badges & Actions Bar */}
        <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Dynamic Status Badge */}
            <span
              className="text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5"
              style={{
                backgroundColor: badge.bg,
                color: badge.color,
                border: `1px solid ${badge.border}`,
              }}
              title={
                displayStatus === 'upcoming'
                  ? 'Upcoming adventure'
                  : displayStatus === 'ongoing'
                  ? 'Currently ongoing trip'
                  : 'Trip completed'
              }
            >
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </span>

            {/* Currency Pill */}
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{
                backgroundColor: 'rgba(126,154,136,0.15)',
                color: '#4a6454',
              }}
            >
              {trip.currency || 'INR'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Copy Invite Link */}
            <button
              onClick={handleCopyInviteLink}
              type="button"
              className="text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border"
              style={{
                backgroundColor: copiedLink ? '#e8f5e9' : '#ffffff',
                borderColor: copiedLink ? '#a5d6a7' : 'var(--color-border)',
                color: copiedLink ? '#1b5e20' : '#4a6454',
              }}
              title="Copy shareable invite link (https://tripsplit.app/trips/join?code=...)"
            >
              <span>{copiedLink ? '✓' : '🔗'}</span>
              <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
            </button>

            {/* WhatsApp Share */}
            <button
              onClick={handleShareWhatsApp}
              type="button"
              className="text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer bg-[#e8f5e9] text-[#1b5e20] hover:bg-[#c8e6c9] border border-[#a5d6a7]/60"
              title="Share invite via WhatsApp"
            >
              <span>💬</span>
              <span className="hidden xs:inline">WhatsApp</span>
            </button>

            {/* Room Code with 1-click copy */}
            <button
              onClick={handleCopyCode}
              type="button"
              className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer hover:bg-[#e4e8e4]"
              style={{
                backgroundColor: '#f1f4f1',
                color: 'rgba(26,30,28,0.75)',
              }}
              title="Click to copy 6-character trip room code"
            >
              <span>Code: {trip.roomCode}</span>
              <span className="text-[11px]">{copiedCode ? '✓' : '📋'}</span>
            </button>
          </div>
        </div>

        {/* Title & Info */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <h1
              className="text-xl sm:text-2xl font-bold mb-1"
              style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: 'var(--color-charcoal)' }}
            >
              {trip.name}
            </h1>
            <p className="text-xs sm:text-sm flex items-center gap-1.5 flex-wrap" style={{ color: 'rgba(26,30,28,0.6)' }}>
              <span>📍</span>
              <span className="font-medium text-gray-700">{trip.destinationQuery}</span>
              <span className="mx-1 text-gray-300">•</span>
              <span>🗓️ {formatDateRange(trip.startDate, trip.endDate)}</span>
            </p>
          </div>

          {/* Creator & Member Controls */}
          <div className="flex items-center gap-2 self-start shrink-0 flex-wrap">
            {isCreator ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditForm({
                      name: trip.name,
                      destinationQuery: trip.destinationQuery,
                      startDate: toInputDate(trip.startDate),
                      endDate: toInputDate(trip.endDate),
                    });
                    setErrorMsg('');
                    setIsEditing(true);
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  title="Edit trip details and reschedule dates"
                >
                  <span>✏️</span>
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleTripStatus}
                  disabled={isUpdatingStatus}
                  className={`text-xs font-medium px-3 py-1.5 rounded-xl border flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer ${
                    isCompleted
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                  title={isCompleted ? 'Reopen trip to add more expenses' : 'Mark trip as completed'}
                >
                  <span>{isCompleted ? '↺' : '✓'}</span>
                  <span>
                    {isUpdatingStatus
                      ? 'Updating…'
                      : isCompleted
                      ? 'Reopen'
                      : 'Complete'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteError('');
                    setIsDeleting(true);
                  }}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                  title="Delete trip and all records permanently"
                >
                  <span>🗑️</span>
                  <span>Delete</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLeaveError('');
                  setIsLeaving(true);
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-red-50 text-gray-700 hover:text-red-700 hover:border-red-200 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title="Leave this trip"
              >
                <span>🚪</span>
                <span>Leave Trip</span>
              </button>
            )}
          </div>
        </div>

        {/* Member Avatars */}
        <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid #f1f4f1' }}>
          <span className="text-xs font-medium" style={{ color: 'rgba(26,30,28,0.5)' }}>
            Travelers ({members.length}):
          </span>
          <div className="flex -space-x-1.5 items-center">
            {members.map((m: Member, i: number) => (
              <div
                key={m._id || i}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-white select-none"
                style={{
                  backgroundColor: '#ecefeb',
                  boxShadow: '0 2px 6px -1px rgba(26,30,28,0.08)',
                }}
                title={m.username || 'Member'}
              >
                {getAvatarEmoji(m.avatarId)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Trip & Reschedule Modal */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 19, 0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditing(false);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-gray-100 transition-all animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
                  Edit Trip Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveTripDetails} className="space-y-4">
              <div>
                <label className="text-[0.6875rem] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Trip Title
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  placeholder="e.g. Manali Adventure 2026"
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-[0.6875rem] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Destination
                </label>
                <input
                  type="text"
                  value={editForm.destinationQuery}
                  onChange={(e) => setEditForm({ ...editForm, destinationQuery: e.target.value })}
                  required
                  placeholder="e.g. Manali, Himachal Pradesh"
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.6875rem] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-[0.6875rem] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editForm.endDate}
                    min={editForm.startDate || undefined}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saveLoading}
                  className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#4a6454] hover:bg-[#385041] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60"
                >
                  {saveLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Trip Confirmation Modal */}
      {isDeleting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(26,30,28,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => !deleteLoading && setIsDeleting(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl border border-red-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-red-700">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-bold text-lg text-gray-900">Delete Trip Permanently?</h3>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-gray-900">{trip.name}</strong>? This action cannot be undone and will permanently delete all expenses, tasks, packing lists, and budgets for all {members.length} travelers.
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleting(false)}
                disabled={deleteLoading}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTrip}
                disabled={deleteLoading}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>{deleteLoading ? 'Deleting…' : 'Delete Entire Trip'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Trip Confirmation Modal */}
      {isLeaving && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(26,30,28,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => !leaveLoading && setIsLeaving(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl border border-gray-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-gray-800">
              <span className="text-2xl">🚪</span>
              <h3 className="font-bold text-lg text-gray-900">Leave Trip?</h3>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Are you sure you want to leave <strong className="text-gray-900">{trip.name}</strong>? You can only leave if your balance is completely settled (net balance is $0).
            </p>

            {leaveError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <strong>Cannot leave yet:</strong> {leaveError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsLeaving(false)}
                disabled={leaveLoading}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveTrip}
                disabled={leaveLoading}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>{leaveLoading ? 'Processing…' : 'Confirm Leave'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
