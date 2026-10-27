'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import AuthCard from '@/app/components/AuthCard';
import FloatingInput from '@/app/components/FloatingInput';
import { AVATARS } from '@/lib/constants/avatars';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    avatarId: 'avatar-fox.svg',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, val: string) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
          confirmPassword: form.confirmPassword,
          avatarId: form.avatarId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
      } else {
        // Automatically sign in upon registration and navigate straight to the dashboard
        const signInRes = await signIn('credentials', {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          redirect: false,
        });

        if (signInRes?.error) {
          router.push('/login?registered=1');
        } else {
          router.push('/dashboard');
          router.refresh();
        }
      }
    } catch {
      setError('Network error. Please try again.');
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
        Create account
      </h1>
      <p
        className="text-center mb-8"
        style={{ fontSize: '0.9375rem', color: 'rgba(26,30,28,0.55)', fontFamily: 'var(--font-body)' }}
      >
        Join TripSplit and plan your next adventure
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FloatingInput
          label="Username"
          type="text"
          value={form.username}
          onChange={(e) => update('username', e.target.value)}
          required
          autoComplete="username"
        />
        <FloatingInput
          label="Email address"
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          required
          autoComplete="email"
        />
        <FloatingInput
          label="Password (min 6 characters)"
          type="password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          required
          autoComplete="new-password"
        />
        <FloatingInput
          label="Confirm password"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => update('confirmPassword', e.target.value)}
          required
          autoComplete="new-password"
        />

        {/* Avatar picker */}
        <div>
          <p
            className="mb-3"
            style={{
              fontSize: '0.8125rem',
              fontWeight: 500,
              letterSpacing: '0.04em',
              color: 'rgba(26,30,28,0.55)',
              fontFamily: 'var(--font-body)',
            }}
          >
            CHOOSE YOUR AVATAR
          </p>
          <div className="grid grid-cols-4 gap-2.5 sm:gap-3 justify-items-center">
            {AVATARS.map((av) => (
              <button
                key={av.id}
                type="button"
                onClick={() => update('avatarId', av.id)}
                title={av.label}
                className="w-11 h-11 rounded-full flex items-center justify-center text-xl transition-all cursor-pointer"
                style={{
                  backgroundColor: form.avatarId === av.id ? 'rgba(126,154,136,0.18)' : '#ffffff',
                  border: `2px solid ${form.avatarId === av.id ? '#7e9a88' : 'var(--color-border)'}`,
                  boxShadow: form.avatarId === av.id ? '0 0 0 3px rgba(154,183,211,0.35)' : 'none',
                }}
              >
                {av.emoji}
              </button>
            ))}
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
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p
        className="text-center mt-8"
        style={{ fontSize: '0.8125rem', color: 'rgba(26,30,28,0.5)', fontFamily: 'var(--font-body)' }}
      >
        Already have an account?{' '}
        <Link
          href="/login"
          className="transition-opacity hover:opacity-100"
          style={{ color: 'var(--color-charcoal)', opacity: 0.7, textDecoration: 'underline' }}
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
