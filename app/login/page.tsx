'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import AuthCard from '@/app/components/AuthCard';
import FloatingInput from '@/app/components/FloatingInput';

function LoginFeedback() {
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');
  const reset = searchParams.get('reset');

  if (registered) {
    return (
      <div
        className="mb-6 px-4 py-2.5 rounded-xl text-center text-sm font-medium"
        style={{
          backgroundColor: '#ccead5',
          color: '#183124',
          border: '1px solid #b0cdba',
        }}
      >
        Account created successfully! Please sign in.
      </div>
    );
  }

  if (reset) {
    return (
      <div
        className="mb-6 px-4 py-2.5 rounded-xl text-center text-sm font-medium"
        style={{
          backgroundColor: '#ccead5',
          color: '#183124',
          border: '1px solid #b0cdba',
        }}
      >
        Password reset successfully! Please sign in with your new password.
      </div>
    );
  }

  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid email or password');
        setLoading(false);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
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
        Welcome back
      </h1>
      <p
        className="text-center mb-6"
        style={{ fontSize: '0.9375rem', color: 'rgba(26,30,28,0.55)', fontFamily: 'var(--font-body)' }}
      >
        Sign in to your TripSplit account
      </p>

      {/* Success banner if redirected after registration or reset */}
      <Suspense fallback={null}>
        <LoginFeedback />
      </Suspense>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FloatingInput
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <div>
          <FloatingInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <div className="flex justify-end mt-1.5">
            <Link
              href="/forgot-password"
              className="text-xs transition-opacity hover:opacity-100"
              style={{ color: 'rgba(26,30,28,0.55)', textDecoration: 'underline' }}
            >
              Forgot password?
            </Link>
          </div>
        </div>

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
            letterSpacing: '0.01em',
          }}
          onMouseEnter={(e) => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6e8b78';
          }}
          onMouseLeave={(e) => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#4a6454';
          }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p
        className="text-center mt-8"
        style={{ fontSize: '0.8125rem', color: 'rgba(26,30,28,0.5)', fontFamily: 'var(--font-body)' }}
      >
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="transition-opacity hover:opacity-100"
          style={{ color: 'var(--color-charcoal)', opacity: 0.7, textDecoration: 'underline' }}
        >
          Register
        </Link>
      </p>
    </AuthCard>
  );
}
