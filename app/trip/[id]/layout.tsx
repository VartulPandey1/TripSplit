import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Trip from '@/lib/db/models/Trip';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import TripBottomNav from './TripBottomNav';

async function TripAuthGuard({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
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

  return <>{children}</>;
}

export default function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-silk)' }}
    >
      {/* Top Header with consistent Logo */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3"
        style={{
          backgroundColor: 'rgba(247,250,246,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Logo layout="horizontal" href="/dashboard" />
        <Link
          href="/dashboard"
          className="text-xs font-medium px-3 py-1.5 rounded-full transition-all shrink-0"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border)',
            color: 'rgba(26,30,28,0.7)',
            boxShadow: '0 2px 8px -1px rgba(26,30,28,0.04)',
          }}
        >
          ← Dashboard
        </Link>
      </header>

      {/* Main content view with layout-level IDOR Trip Membership Guard */}
      <main className="flex-1 pb-28 sm:pb-24">
        <Suspense
          fallback={
            <div className="p-8 max-w-2xl mx-auto text-center py-24 text-sm" style={{ color: 'rgba(26,30,28,0.45)' }}>
              Verifying trip access…
            </div>
          }
        >
          <TripAuthGuard params={params}>{children}</TripAuthGuard>
        </Suspense>
      </main>

      {/* Bottom Navigation wrapped in Suspense */}
      <Suspense fallback={null}>
        <TripBottomNav />
      </Suspense>
    </div>
  );
}
