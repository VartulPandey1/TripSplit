import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth, signOut } from '@/lib/auth';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import SignOutButton from '@/app/components/SignOutButton';
import { getAvatarEmoji } from '@/lib/constants/avatars';
import { connectDB } from '@/lib/db/mongoose';
import Trip from '@/lib/db/models/Trip';
import { getTripStatus, getTripStatusBadge } from '@/lib/utils/tripStatus';

function formatDate(dateStr?: string | Date) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function DashboardContent() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const avatar = getAvatarEmoji(session.user.image);

  await connectDB();
  const trips = await Trip.find({
    $or: [{ members: session.user.id }, { creatorId: session.user.id }],
  })
    .sort({ startDate: 1 })
    .lean();

  return (
    <>
      {/* Top nav */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4"
        style={{
          backgroundColor: 'rgba(247,250,246,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Logo layout="horizontal" href="/dashboard" />
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/settings"
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg select-none shrink-0 transition-transform hover:scale-105 cursor-pointer"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border)',
              boxShadow: '0 2px 8px -1px rgba(26,30,28,0.04)',
            }}
            title={`${session.user.name || 'User'} • Account Settings`}
          >
            {avatar}
          </Link>
          <Link
            href="/settings"
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border)',
              color: 'rgba(26,30,28,0.7)',
              boxShadow: '0 2px 8px -1px rgba(26,30,28,0.04)',
            }}
            title="Account Settings"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <SignOutButton
            onSignOut={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Greeting */}
        <div className="mb-8 sm:mb-10">
          <h1
            className="font-semibold mb-1 flex items-center gap-2 flex-wrap"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              letterSpacing: '-0.025em',
              color: 'var(--color-charcoal)',
            }}
          >
            <span>Hey, {session.user.name}</span>
            <span>{avatar}</span>
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'rgba(26,30,28,0.55)', fontFamily: 'var(--font-body)' }}>
            Your trips are waiting
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex gap-3 mb-10">
          <Link
            href="/trips/new"
            className="flex-1 text-center font-medium text-white rounded-2xl py-[14px] transition-colors"
            style={{
              backgroundColor: '#4a6454',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              letterSpacing: '0.01em',
            }}
          >
            + Create Trip
          </Link>
          <Link
            href="/trips/join"
            className="flex-1 text-center font-medium rounded-2xl py-[14px] transition-colors"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--color-border)',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-charcoal)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              letterSpacing: '0.01em',
              boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
            }}
          >
            Join with Code
          </Link>
        </div>

        {/* Trips section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="font-semibold"
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.25rem',
                letterSpacing: '-0.015em',
                color: 'var(--color-charcoal)',
              }}
            >
              Your Trips
            </h2>
            {trips.length > 0 && (
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: 'rgba(126,154,136,0.14)',
                  color: '#4a6454',
                }}
              >
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
              </span>
            )}
          </div>

          {trips.length === 0 ? (
            <div
              className="rounded-3xl p-12 text-center"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--color-border)',
                boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
                color: 'rgba(26,30,28,0.5)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <div className="text-4xl mb-3">🗺️</div>
              <p className="font-medium text-base mb-1" style={{ color: 'var(--color-charcoal)' }}>
                No trips yet
              </p>
              <p className="text-sm mb-6" style={{ color: 'rgba(26,30,28,0.5)' }}>
                Create your first adventure or join friends using their trip code.
              </p>
              <div className="flex justify-center gap-3">
                <Link
                  href="/trips/new"
                  className="text-sm font-medium px-4 py-2 rounded-xl text-white"
                  style={{ backgroundColor: '#4a6454' }}
                >
                  Create Trip
                </Link>
                <Link
                  href="/trips/join"
                  className="text-sm font-medium px-4 py-2 rounded-xl"
                  style={{
                    backgroundColor: '#f1f4f1',
                    color: 'var(--color-charcoal)',
                  }}
                >
                  Enter Code
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {trips.map((trip: any) => {
                const memberCount = trip.members?.length || 1;
                return (
                  <Link
                    key={trip._id.toString()}
                    href={`/trip/${trip._id.toString()}/overview`}
                    className="block rounded-3xl p-6 transition-all hover:translate-y-[-1px]"
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--color-border)',
                      boxShadow: '0 6px 24px -4px rgba(26,30,28,0.05)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {(() => {
                            const status = getTripStatus(trip);
                            const badge = getTripStatusBadge(status);
                            return (
                              <span
                                className="text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"
                                style={{
                                  backgroundColor: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.border}`,
                                }}
                              >
                                <span>{badge.icon}</span>
                                <span>{badge.label}</span>
                              </span>
                            );
                          })()}
                          <span
                            className="text-xs font-mono px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: '#f1f4f1',
                              color: 'rgba(26,30,28,0.7)',
                            }}
                          >
                            Code: {trip.roomCode}
                          </span>
                        </div>
                        <h3
                          className="text-xl font-semibold mb-1"
                          style={{
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-charcoal)',
                            letterSpacing: '-0.015em',
                          }}
                        >
                          {trip.name}
                        </h3>
                        <p className="text-sm flex items-center gap-1.5" style={{ color: 'rgba(26,30,28,0.6)' }}>
                          <span>📍</span>
                          <span>{trip.destinationQuery}</span>
                        </p>
                      </div>
                      <span className="text-lg text-[#7e9a88] pt-1">→</span>
                    </div>

                    <div
                      className="pt-3 flex items-center justify-between text-xs flex-wrap gap-2"
                      style={{
                        borderTop: '1px solid #f1f4f1',
                        color: 'rgba(26,30,28,0.5)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <span>
                        🗓️ {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
                      </span>
                      <span>
                        👥 {memberCount} {memberCount === 1 ? 'traveler' : 'travelers'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center" style={{ color: 'rgba(26,30,28,0.45)' }}>
      <div className="w-10 h-10 border-2 border-[#7e9a88] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm">Loading your adventures…</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-silk)' }}>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
