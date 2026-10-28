'use client';

import { useState } from 'react';
import Link from 'next/link';
import TripCard, { SerializedDashboardTrip } from './TripCard';
import { getTripStatus } from '@/lib/utils/tripStatus';

interface DashboardTripsSectionProps {
  trips: SerializedDashboardTrip[];
}

export default function DashboardTripsSection({ trips }: DashboardTripsSectionProps) {
  const ongoingTrips = trips.filter((t) => getTripStatus(t) !== 'completed');
  const pastTrips = trips.filter((t) => getTripStatus(t) === 'completed');

  // Default to 'ongoing' if active trips exist, otherwise 'past'
  const [activeTab, setActiveTab] = useState<'ongoing' | 'past'>(() => {
    if (ongoingTrips.length === 0 && pastTrips.length > 0) return 'past';
    return 'ongoing';
  });

  if (trips.length === 0) {
    return (
      <div className="rounded-2xl p-6 sm:p-8 text-center bg-white border border-black/[0.05] shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-[#eef4f0] text-2xl flex items-center justify-center mx-auto mb-3 shadow-2xs">
          ✈️
        </div>
        <h2
          className="font-semibold text-base sm:text-lg text-gray-900 mb-1"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Start your first adventure
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto mb-6 font-body">
          Create a trip to split expenses and pack together, or join an existing trip with an invite code.
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <Link
            href="/trips/new"
            className="flex items-center justify-center gap-1 py-3 px-3.5 rounded-xl text-white font-medium text-xs sm:text-sm bg-[#4a6454] hover:bg-[#3d5345] shadow-xs transition-all active:scale-[0.98]"
          >
            <span>+ New Trip</span>
          </Link>
          <Link
            href="/trips/join"
            className="flex items-center justify-center gap-1 py-3 px-3.5 rounded-xl text-gray-700 font-medium text-xs sm:text-sm bg-[#f1f4f1] hover:bg-[#e4eae4] border border-black/[0.04] transition-all active:scale-[0.98]"
          >
            <span>Join with Code</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 2-Tab Switch: [ Ongoing Trips | Past Trips ] */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="inline-flex p-1 bg-[#edf3ef] rounded-2xl border border-[#d6e3da] shadow-2xs w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ongoing')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'ongoing'
                ? 'bg-white text-[#1a1e1c] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>✈️</span>
            <span>Ongoing Trips</span>
            <span
              className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full ${
                activeTab === 'ongoing' ? 'bg-[#eef3f0] text-[#4a6454]' : 'bg-gray-200/70 text-gray-600'
              }`}
            >
              {ongoingTrips.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'past'
                ? 'bg-white text-[#181c1a] shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>📦</span>
            <span>Past Trips</span>
            <span
              className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full ${
                activeTab === 'past' ? 'bg-[#eef3f0] text-[#4a6454]' : 'bg-gray-200/70 text-gray-600'
              }`}
            >
              {pastTrips.length}
            </span>
          </button>
        </div>

        <span className="text-xs text-gray-400 font-medium hidden sm:inline">
          {trips.length} total {trips.length === 1 ? 'adventure' : 'adventures'}
        </span>
      </div>

      {/* Tab 1: Ongoing Trips */}
      {activeTab === 'ongoing' && (
        <div className="animate-in fade-in duration-150">
          {ongoingTrips.length === 0 ? (
            <div className="rounded-2xl p-6 sm:p-8 text-center bg-white border border-black/[0.05] shadow-xs">
              <p className="text-3xl mb-2">🏝️</p>
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">
                No ongoing or upcoming trips
              </h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto mb-4">
                All your scheduled trips are wrapped up! Plan your next getaway below.
              </p>
              <div className="flex items-center justify-center gap-2.5">
                <Link
                  href="/trips/new"
                  className="inline-flex items-center justify-center gap-1 py-2 px-3.5 rounded-xl text-white font-medium text-xs bg-[#4a6454] hover:bg-[#3d5345] shadow-xs transition-all active:scale-[0.98]"
                >
                  <span>+ Plan New Trip</span>
                </Link>
                {pastTrips.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('past')}
                    className="inline-flex items-center justify-center gap-1 py-2 px-3.5 rounded-xl text-gray-700 font-medium text-xs bg-[#f1f4f1] hover:bg-[#e4eae4] transition-all cursor-pointer"
                  >
                    <span>View Past Trips ({pastTrips.length}) →</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {ongoingTrips.map((trip) => (
                <TripCard key={trip._id} trip={trip} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Past Trips */}
      {activeTab === 'past' && (
        <div className="animate-in fade-in duration-150">
          {pastTrips.length === 0 ? (
            <div className="rounded-2xl p-6 sm:p-8 text-center bg-white border border-black/[0.05] shadow-xs">
              <p className="text-3xl mb-2">🧳</p>
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">
                No past trips yet
              </h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Completed adventures, settled finances, and travel memories will be archived here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pastTrips.map((trip) => (
                <TripCard key={trip._id} trip={trip} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
