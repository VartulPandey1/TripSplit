import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimitDurable } from '@/lib/utils/rateLimit';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit registration, password recovery, and trip join brute-force attempts
  if (
    request.method === 'POST' &&
    (pathname.startsWith('/api/register') ||
      pathname.startsWith('/api/auth/forgot-password') ||
      pathname.startsWith('/api/auth/reset-password') ||
      pathname.startsWith('/api/auth/callback/credentials') ||
      pathname.startsWith('/api/trips/join'))
  ) {
    // Get client IP address
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const rateLimitKey = `${pathname}:${ip}`;

    // Max 10 attempts per 5 minutes per IP (durable across multi-instance serverless)
    const rateCheck = await checkRateLimitDurable(rateLimitKey, 10, 5 * 60 * 1000);

    if (!rateCheck.success) {
      return new NextResponse(
        JSON.stringify({
          error: `Too many requests from this address. Please wait ${rateCheck.resetSeconds} seconds before trying again.`,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.resetSeconds),
          },
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/callback/credentials',
    '/api/trips/join',
  ],
};
