import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';

export const instant = false;

export default async function Home() {
  await connection();
  const session = await auth();
  if (session?.user?.id) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
