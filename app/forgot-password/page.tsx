'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import AuthCard from '@/app/components/AuthCard';
import FloatingInput from '@/app/components/FloatingInput';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to request reset');
      } else {
        setSubmitted(true);
        if (data.resetUrl) {
          setResetUrl(data.resetUrl);
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard>
      {/* Logo */}
      <Logo className="mb-8" />

      {/* Heading */}
      <h1
        className="text-[1.75rem] font-semibold mb-1 text-center"
        style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: 'var(--color-charcoal)' }}
      >
        Reset password
      </h1>
      <p
        className="text-center mb-8"
        style={{ fontSize: '0.9375rem', color: 'rgba(26,30,28,0.55)', fontFamily: 'var(--font-body)' }}
      >
        Enter your email address to recover your account
      </p>

      {submitted ? (
        <div className="flex flex-col gap-4 text-center">
          <div
            className="p-4 rounded-2xl text-sm"
            style={{
              backgroundColor: '#ccead5',
              color: '#183124',
              border: '1px solid #b0cdba',
            }}
          >
            <p className="font-semibold mb-1">Reset link generated</p>
            <p className="text-xs">
              If an account with {email} exists, your password reset link is ready.
            </p>
          </div>

          {resetUrl && (
            <Link
              href={resetUrl}
              className="w-full text-center font-medium text-white rounded-2xl py-3.5 transition-all"
              style={{
                backgroundColor: '#4a6454',
                fontSize: '0.875rem',
              }}
            >
              Proceed to Set New Password →
            </Link>
          )}

          <Link
            href="/login"
            className="min-h-[44px] text-xs text-center hover:underline mt-2 inline-flex items-center justify-center"
            style={{ color: 'rgba(26,30,28,0.6)' }}
          >
            ← Back to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FloatingInput
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
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
            disabled={loading}
            className="w-full font-medium text-white rounded-2xl py-[14px] mt-2 transition-colors disabled:opacity-50 cursor-pointer"
            style={{
              height: '52px',
              backgroundColor: loading ? '#7e9a88' : '#4a6454',
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
            }}
          >
            {loading ? 'Generating link…' : 'Send Reset Link'}
          </button>

          <p
            className="text-center mt-6"
            style={{ fontSize: '0.8125rem', color: 'rgba(26,30,28,0.5)', fontFamily: 'var(--font-body)' }}
          >
            Remember your password?{' '}
            <Link
              href="/login"
              className="transition-opacity hover:opacity-100"
              style={{ color: 'var(--color-charcoal)', opacity: 0.7, textDecoration: 'underline' }}
            >
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
