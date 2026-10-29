import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth, signOut } from '@/lib/auth';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import SignOutButton from '@/app/components/SignOutButton';
import ThemeToggle from '@/app/components/ThemeToggle';
import { getAvatarEmoji } from '@/lib/constants/avatars';
import { connectDB } from '@/lib/db/mongoose';
import Trip from '@/lib/db/models/Trip';
import { SerializedDashboardTrip } from './TripCard';
import DashboardTripsSection from './DashboardTripsSection';

export const instant = false;

export default async function DashboardPage() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = session.user;
  const avatar = getAvatarEmoji(user.image);

  await connectDB();
  const rawTrips = await Trip.find({
    $or: [{ members: user.id }, { creatorId: user.id }],
  })
    .sort({ startDate: 1 })
    .lean();

  const trips: SerializedDashboardTrip[] = rawTrips.map((t: any) => ({
    _id: t._id.toString(),
    name: t.name,
    destinationQuery: t.destinationQuery,
    startDate: t.startDate ? new Date(t.startDate).toISOString() : undefined,
    endDate: t.endDate ? new Date(t.endDate).toISOString() : undefined,
    roomCode: t.roomCode,
    status: t.status || 'active',
    memberCount: t.members?.length || 1,
  }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-silk)' }}>
      {/* Top nav */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4"
        style={{
          backgroundColor: 'var(--color-header-bg)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Logo layout="horizontal" href="/dashboard" />
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Quick Toggle */}
          <ThemeToggle />

          {/* Avatar circle (Settings trigger on mobile & desktop) */}
          <Link
            href="/settings"
            className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-lg sm:text-xl select-none shrink-0 transition-all hover:scale-105 active:scale-95 cursor-pointer bg-white dark:bg-[#1c1c20] border border-black/[0.05] dark:border-white/10"
            title={`${user.name || 'User'} • Account Settings`}
            aria-label="Account Settings"
          >
            {avatar}
          </Link>

          {/* Settings text pill: hidden on mobile, visible on desktop */}
          <Link
            href="/settings"
            className="hidden sm:flex text-xs font-medium px-3 py-1.5 rounded-full transition-all cursor-pointer items-center gap-1.5 bg-white dark:bg-[#1c1c20] border border-black/[0.05] dark:border-white/10 text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-[#25252b] active:scale-95"
            title="Account Settings"
          >
            <span>⚙️</span>
            <span>Settings</span>
          </Link>

          {/* Sign out button (compact icon on mobile, text on desktop) */}
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
        <div className="mb-6 sm:mb-8">
          <h1
            className="font-semibold mb-1 flex items-center gap-2 flex-wrap"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              letterSpacing: '-0.025em',
              color: 'var(--color-charcoal)',
            }}
          >
            <span>Hey, {user.name}</span>
            <span>{avatar}</span>
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'rgba(26,30,28,0.55)' }} className="dark:!text-zinc-400">
            Your trips are waiting
          </p>
        </div>

        {/* Quick action buttons (only shown when user already has trips) */}
        {trips.length > 0 && (
          <div className="flex gap-3 mb-8 sm:mb-10">
            <Link
              href="/trips/new"
              className="flex-1 text-center font-medium text-white dark:text-black rounded-2xl py-3.5 transition-colors shadow-xs flex items-center justify-center gap-1 text-sm bg-[#4a6454] hover:bg-[#3d5345] dark:bg-white dark:hover:bg-zinc-200"
            >
              + Create Trip
            </Link>
            <Link
              href="/trips/join"
              className="flex-1 text-center font-medium rounded-2xl py-3.5 transition-colors border border-black/[0.06] dark:border-white/10 bg-white dark:bg-[#1c1c20] hover:bg-gray-50 dark:hover:bg-[#25252b] shadow-xs flex items-center justify-center gap-1 text-sm text-gray-800 dark:text-white"
            >
              Join with Code
            </Link>
          </div>
        )}

        {/* Trips section */}
        <section>
          <DashboardTripsSection trips={trips} />
        </section>
      </main>
    </div>
  );
}
