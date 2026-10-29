'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getTripStatus, getTripStatusBadge } from '@/lib/utils/tripStatus';

export interface SerializedDashboardTrip {
  _id: string;
  name: string;
  destinationQuery: string;
  startDate?: string;
  endDate?: string;
  roomCode: string;
  status?: string;
  memberCount: number;
}

interface TripCardProps {
  trip: SerializedDashboardTrip;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TripCard({ trip }: TripCardProps) {
  const [copied, setCopied] = useState(false);

  const status = getTripStatus(trip);
  const badge = getTripStatusBadge(status);

  function handleCopyCode(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(trip.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Link
      href={`/trip/${trip._id}/overview`}
      className="block rounded-2xl p-4 sm:p-5 transition-all hover:translate-y-[-1px] group bg-white dark:bg-[#141416] border border-black/[0.05] dark:border-white/10"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          {/* Status Badge + 1-Tap Room Code Copy Pill */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className="text-[0.6875rem] font-medium px-2 py-0.5 rounded-full capitalize flex items-center gap-1"
              style={{
                backgroundColor: badge.bg,
                color: badge.color,
              }}
            >
              <span>{badge.icon}</span>
              <span>{badge.label.toLowerCase()}</span>
            </span>

            {/* 1-Tap Room Code Copy Pill with comfortable touch target */}
            <span
              role="button"
              tabIndex={0}
              onClick={handleCopyCode}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleCopyCode(e as any);
                }
              }}
              className={`min-h-[36px] text-xs font-mono px-2.5 py-1.5 rounded-lg transition-all active:scale-95 inline-flex items-center gap-1.5 cursor-pointer select-none touch-manipulation border ${
                copied
                  ? 'bg-[#eef4f0] text-[#2d4235] dark:bg-[#2c2c34] dark:text-white border-transparent'
                  : 'bg-[#f1f4f1] text-gray-700 dark:bg-[#1f1f24] dark:text-zinc-200 border-black/[0.04] dark:border-white/10 hover:bg-gray-200 dark:hover:bg-[#282830]'
              }`}
              title="Tap to copy room code"
            >
              <span>{copied ? '✓ Copied' : `Code: ${trip.roomCode}`}</span>
              {!copied && <span className="text-[10px] text-gray-400 dark:text-zinc-500">📋</span>}
            </span>
          </div>

          {/* Trip Name */}
          <h3
            className="text-lg sm:text-xl font-semibold mb-1 truncate text-[#1a1e1c] dark:text-white group-hover:text-[#4a6454] dark:group-hover:text-zinc-300 transition-colors"
            style={{
              fontFamily: 'var(--font-heading)',
              letterSpacing: '-0.015em',
            }}
          >
            {trip.name}
          </h3>

          {/* Destination */}
          <p className="text-xs sm:text-sm flex items-center gap-1 text-gray-500 dark:text-zinc-400 truncate">
            <span>📍</span>
            <span className="truncate">{trip.destinationQuery}</span>
          </p>
        </div>

        <span className="text-lg text-gray-300 dark:text-zinc-600 group-hover:text-[#4a6454] dark:group-hover:text-white group-hover:translate-x-0.5 transition-all pt-1 shrink-0">
          →
        </span>
      </div>

      {/* Dates + Travelers Footer */}
      <div
        className="pt-2.5 mt-2 flex items-center justify-between text-xs flex-wrap gap-2 text-gray-500 dark:text-zinc-400 border-t border-[#f1f4f1] dark:border-white/10"
        style={{
          fontFamily: 'var(--font-body)',
        }}
      >
        <span className="flex items-center gap-1">
          <span>🗓️</span>
          <span>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</span>
        </span>
        <span className="flex items-center gap-1 font-medium text-gray-600 dark:text-zinc-300">
          <span>👥</span>
          <span>{trip.memberCount} {trip.memberCount === 1 ? 'traveler' : 'travelers'}</span>
        </span>
      </div>
    </Link>
  );
}
