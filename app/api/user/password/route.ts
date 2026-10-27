import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'Current password and new password are required' },
      { status: 400 }
    );
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return NextResponse.json(
      { error: 'New password must be at least 6 characters long' },
      { status: 400 }
    );
  }

  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'User account not found' }, { status: 404 });
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    return NextResponse.json({ error: 'Incorrect current password' }, { status: 400 });
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSamePassword) {
    return NextResponse.json(
      { error: 'New password cannot be the same as your current password' },
      { status: 400 }
    );
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  user.passwordHash = newHash;
  await user.save();

  return NextResponse.json({ success: true, message: 'Password changed successfully' });
}
