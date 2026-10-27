import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';
import SettingsClient from './SettingsClient';

async function SettingsContent() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  await connectDB();
  const user = await User.findById(session.user.id).lean();
  if (!user) redirect('/login');

  const initialUser = {
    id: (user as any)._id.toString(),
    username: (user as any).username,
    email: (user as any).email,
    avatarId: (user as any).avatarId || 'avatar-fox.svg',
    createdAt: (user as any).createdAt ? (user as any).createdAt.toISOString() : undefined,
  };

  return <SettingsClient initialUser={initialUser} />;
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-gray-500">
          Loading settings…
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
