import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { Suspense } from 'react';

async function AuthRedirect(): Promise<React.ReactNode> {
  await connection();
  const session = await auth();
  if (session?.user) redirect('/dashboard');
  else redirect('/login');
  return null;
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <AuthRedirect />
    </Suspense>
  );
}
