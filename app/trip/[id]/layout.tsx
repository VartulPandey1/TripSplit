import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Trip from '@/lib/db/models/Trip';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import ThemeToggle from '@/app/components/ThemeToggle';
import TripBottomNav from './TripBottomNav';

export const instant = false;

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  await connectDB();
  const trip = await Trip.findById(id).lean();
  if (!trip) redirect('/dashboard');

  const isMember =
    trip.members?.some((m: any) => m.toString() === session.user.id) ||
    trip.creatorId?.toString() === session.user.id;

  if (!isMember) {
    redirect('/dashboard');
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-canvas)' }}
    >
      {/* Top Header with consistent Logo */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3"
        style={{
          backgroundColor: 'var(--color-header-bg)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Logo layout="horizontal" href="/dashboard" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/dashboard"
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all shrink-0 hover:bg-gray-100/90 inline-flex items-center gap-1.5 cursor-pointer border border-black/[0.06] bg-white text-gray-700 shadow-2xs active:scale-95"
            title="View All Trips"
            aria-label="View All Trips"
          >
            <span className="text-sm">🗂️</span>
            <span>All Trips</span>
          </Link>
        </div>
      </header>

      {/* Main content view */}
      <main className="flex-1 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:pb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      <TripBottomNav />
    </div>
  );
}
