import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';
import { AVATARS } from '@/lib/constants/avatars';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(session.user.id).select('_id username email avatarId createdAt').lean();
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { username, avatarId } = body;

  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (username !== undefined) {
    const trimmed = typeof username === 'string' ? username.trim() : '';
    if (!trimmed) {
      return NextResponse.json({ error: 'Username cannot be blank' }, { status: 400 });
    }
    if (trimmed.length < 2 || trimmed.length > 30) {
      return NextResponse.json({ error: 'Username must be between 2 and 30 characters' }, { status: 400 });
    }
    user.username = trimmed;
  }

  if (avatarId !== undefined) {
    const validAvatar = AVATARS.some((a) => a.id === avatarId);
    if (!validAvatar) {
      return NextResponse.json({ error: 'Invalid avatar selection' }, { status: 400 });
    }
    user.avatarId = avatarId;
  }

  await user.save();

  return NextResponse.json({
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    avatarId: user.avatarId,
  });
}
