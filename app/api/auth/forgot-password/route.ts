import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    await connectDB();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Return success even if email not found to prevent user enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a reset link has been generated.',
      });
    }

    // Generate secure random token (raw token sent to user, SHA-256 hash stored in DB)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const isDevelopment = process.env.NODE_ENV !== 'production';
    const resetUrl = `/reset-password?token=${rawToken}`;

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a reset link has been generated.',
      ...(isDevelopment ? { resetUrl } : {}),
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
