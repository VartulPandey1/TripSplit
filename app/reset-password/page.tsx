'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import AuthCard from '@/app/components/AuthCard';
import FloatingInput from '@/app/components/FloatingInput';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing password reset token.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: password,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to reset password');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login?reset=1');
        }, 1500);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <p className="text-3xl mb-3">✅</p>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-charcoal)' }}>
          Password Reset Complete
        </h2>
        <p className="text-sm mb-6" style={{ color: 'rgba(26,30,28,0.6)' }}>
          Your password has been securely updated. Redirecting to sign in…
        </p>
        <Link
          href="/login"
          className="text-xs font-semibold px-4 py-2 rounded-xl text-white"
          style={{ backgroundColor: '#4a6454' }}
        >
          Sign In Now
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FloatingInput
        label="New password (min 6 characters)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
      />
      <FloatingInput
        label="Confirm new password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
      />

      {error && (
        <p
          className="text-sm px-4 py-2.5 rounded-xl text-center"
          style={{ color: '#ba1a1a', backgroundColor: '#ffdad6' }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !token}
        className="w-full font-medium text-white rounded-2xl py-[14px] mt-2 transition-colors disabled:opacity-50 cursor-pointer"
        style={{
          height: '52px',
          backgroundColor: loading ? '#7e9a88' : '#4a6454',
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
        }}
      >
        {loading ? 'Updating password…' : 'Set New Password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard>
      <Logo className="mb-8" />
      <h1
        className="text-[1.75rem] font-semibold mb-1 text-center"
        style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: 'var(--color-charcoal)' }}
      >
        Create new password
      </h1>
      <p
        className="text-center mb-8"
        style={{ fontSize: '0.9375rem', color: 'rgba(26,30,28,0.55)', fontFamily: 'var(--font-body)' }}
      >
        Choose a strong password for your account
      </p>

      <Suspense fallback={<div className="py-12 text-center text-sm">Verifying link…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
