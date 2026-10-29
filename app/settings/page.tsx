import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';
import SettingsClient from './SettingsClient';

export const instant = false;

async function SettingsContent({ userId }: { userId: string }) {
  await connection();
  await connectDB();
  const user = await User.findById(userId).lean();
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

export default async function SettingsPage() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return <SettingsContent userId={session.user.id} />;
}
