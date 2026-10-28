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
  creatorId?: string;
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCrewSheetOpen, setIsCrewSheetOpen] = useState(false);

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
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 mb-3 sm:mb-4 bg-white transition-all border border-black/[0.05]">
        {/* Top Status & ⋯ Menu */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Dynamic Status Badge */}
            <span
              className="text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5"
              style={{
                backgroundColor: badge.bg,
                color: badge.color,
                border: `1px solid ${badge.border}`,
              }}
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

          {/* Secondary Actions Consolidated in ⋯ Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl border border-gray-200 bg-white text-gray-600 flex items-center justify-center font-bold text-lg hover:bg-gray-50 active:scale-95 shadow-3xs cursor-pointer transition-all select-none touch-manipulation"
              title="Trip options"
              aria-label="Trip options"
            >
              ⋯
            </button>
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 top-12 z-40 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 min-w-[175px] flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                  {isCreator ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          setEditForm({
                            name: trip.name,
                            destinationQuery: trip.destinationQuery,
                            startDate: toInputDate(trip.startDate),
                            endDate: toInputDate(trip.endDate),
                          });
                          setErrorMsg('');
                          setIsEditing(true);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <span>✏️</span>
                        <span>Edit trip details</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          handleToggleTripStatus();
                        }}
                        disabled={isUpdatingStatus}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <span>{isCompleted ? '↺' : '✓'}</span>
                        <span>{isCompleted ? 'Reopen trip' : 'Mark as complete'}</span>
                      </button>
                      <div className="h-px bg-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          setDeleteError('');
                          setIsDeleting(true);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <span>🗑️</span>
                        <span>Delete trip</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setLeaveError('');
                        setIsLeaving(true);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      <span>🚪</span>
                      <span>Leave trip</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Title & Info */}
        <div className="mb-3.5">
          <h1
            className="text-xl sm:text-2xl font-bold mb-1"
            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: 'var(--color-charcoal)' }}
          >
            {trip.name}
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 gap-0.5 text-xs sm:text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <span>📍</span>
              <span className="font-medium text-gray-700">{trip.destinationQuery}</span>
            </span>
            <span className="hidden sm:inline mx-1 text-gray-300">•</span>
            <span>🗓️ {formatDateRange(trip.startDate, trip.endDate)}</span>
          </div>
        </div>

        {/* Member Avatars + Invite Crew Button */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#f1f4f1]">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsCrewSheetOpen(true)}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors shrink-0 text-left cursor-pointer"
              title="Click to view all crew members"
            >
              Crew ({members.length}):
            </button>
            <div className="flex -space-x-1.5 items-center overflow-hidden">
              {members.length > 5 ? (
                <>
                  {members.slice(0, 4).map((m: Member, i: number) => (
                    <div
                      key={m._id || i}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm border-2 border-white select-none shrink-0"
                      style={{
                        backgroundColor: '#ecefeb',
                        boxShadow: '0 2px 6px -1px rgba(26,30,28,0.08)',
                      }}
                      title={m.username || 'Member'}
                    >
                      {getAvatarEmoji(m.avatarId)}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsCrewSheetOpen(true)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white select-none shrink-0 bg-[#e4ede6] hover:bg-[#d5e3d8] text-[#2c4033] transition-all cursor-pointer active:scale-95"
                    style={{
                      boxShadow: '0 2px 6px -1px rgba(26,30,28,0.08)',
                    }}
                    title={`View all ${members.length} crew members`}
                    aria-label={`View all ${members.length} crew members`}
                  >
                    +{members.length - 4}
                  </button>
                </>
              ) : (
                members.map((m: Member, i: number) => (
                  <div
                    key={m._id || i}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm border-2 border-white select-none shrink-0"
                    style={{
                      backgroundColor: '#ecefeb',
                      boxShadow: '0 2px 6px -1px rgba(26,30,28,0.08)',
                    }}
                    title={m.username || 'Member'}
                  >
                    {getAvatarEmoji(m.avatarId)}
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#ccead5] hover:bg-[#b0cdba] text-[#183124] transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-3xs active:scale-95"
            title="Invite friends to this trip"
          >
            <span>👥</span>
            <span>Invite Crew</span>
          </button>
        </div>
      </div>

      {/* Invite Crew Modal */}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          style={{ backgroundColor: 'rgba(15, 23, 19, 0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsInviteModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle for Mobile */}
            <div className="w-12 h-1.5 bg-gray-300/80 rounded-full mx-auto mb-3.5 sm:hidden shrink-0 cursor-grab" />

            <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/[0.04]">
              <div className="flex items-center gap-2">
                <span className="text-xl">👥</span>
                <h3 className="font-semibold text-gray-900 text-base">Invite crew</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-base transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Share the room code or link with friends to plan, log expenses, and split together.
            </p>

            <div className="space-y-3">
              {/* Room Code */}
              <div className="p-3 rounded-2xl bg-[#f7faf6] border border-black/[0.04] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-medium text-gray-500 block">
                    Room code
                  </span>
                  <span className="text-lg font-mono font-bold text-[#181c1a]">
                    {trip.roomCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-all cursor-pointer shadow-3xs select-none touch-manipulation active:scale-95"
                >
                  {copiedCode ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>

              {/* Copy Direct Link */}
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="w-full py-2.5 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-800 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-3xs select-none touch-manipulation active:scale-95"
              >
                <span>{copiedLink ? '✓' : '🔗'}</span>
                <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy 1-Click Invite Link'}</span>
              </button>

              {/* WhatsApp Share */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-3xs select-none touch-manipulation active:scale-95"
              >
                <span>💬</span>
                <span>Share via WhatsApp</span>
              </button>

              {/* Native Mobile Share */}
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full py-2.5 px-3 rounded-xl bg-[#f1f4f1] hover:bg-[#e4e8e4] text-gray-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>📱</span>
                <span>More Share Options</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crew List Sheet */}
      {isCrewSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          style={{ backgroundColor: 'rgba(15, 23, 19, 0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCrewSheetOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle for Mobile */}
            <div className="w-12 h-1.5 bg-gray-300/80 rounded-full mx-auto mb-3.5 sm:hidden shrink-0 cursor-grab" />

            <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/[0.04]">
              <div className="flex items-center gap-2">
                <span className="text-xl">👥</span>
                <div>
                  <h3 className="font-semibold text-gray-900 text-base sm:text-lg leading-tight">
                    Trip Crew
                  </h3>
                  <p className="text-xs text-gray-500">
                    {members.length} {members.length === 1 ? 'traveler' : 'travelers'} in this trip
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCrewSheetOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-base transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Members List */}
            <div className="overflow-y-auto space-y-2 pr-1 -mr-1 flex-1 min-h-0 py-1">
              {members.map((m: Member, idx: number) => {
                const isHost = trip.creatorId ? m._id === trip.creatorId : idx === 0;
                return (
                  <div
                    key={m._id || idx}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-[#f8faf8] border border-black/[0.04] hover:bg-[#f1f4f1] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 select-none border border-white"
                        style={{
                          backgroundColor: '#ecefeb',
                          boxShadow: '0 2px 6px -1px rgba(26,30,28,0.08)',
                        }}
                      >
                        {getAvatarEmoji(m.avatarId)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-gray-900 truncate">
                          {m.username || 'Traveler'}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {isHost ? 'Trip Organizer' : 'Trip Member'}
                        </div>
                      </div>
                    </div>

                    {isHost ? (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#ccead5] text-[#183124]">
                        Host
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] font-medium text-gray-400 px-2 py-0.5">
                        Member
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Invite More Friends Footer Button */}
            <div className="pt-4 mt-2 border-t border-black/[0.04] shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsCrewSheetOpen(false);
                  setIsInviteModalOpen(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-3xs active:scale-[0.99]"
              >
                <span>➕</span>
                <span>Invite More Friends</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Trip & Reschedule Slide-Up Bottom Sheet */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          style={{ backgroundColor: 'rgba(15, 23, 19, 0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditing(false);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Handle for Mobile */}
            <div className="w-12 h-1.5 bg-gray-300/80 rounded-full mx-auto mb-3.5 sm:hidden shrink-0 cursor-grab" />

            <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/[0.04]">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
                  Edit trip details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-base transition-colors cursor-pointer shrink-0"
                aria-label="Close"
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
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Trip title
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
                <label className="text-xs font-semibold text-gray-700 block mb-1">
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
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#4a6454] focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    End date
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

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.04]">
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
                  {saveLoading ? 'Saving…' : 'Save changes'}
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
            className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl p-6 shadow-2xl space-y-4"
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
            className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl p-6 shadow-2xl space-y-4"
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
