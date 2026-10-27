'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Logo from '@/app/components/Logo';
import AuthCard from '@/app/components/AuthCard';

function JoinTripForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';
  const [roomCode, setRoomCode] = useState(codeFromUrl.toUpperCase().slice(0, 6));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (codeFromUrl) {
      setRoomCode(codeFromUrl.toUpperCase().slice(0, 6));
    }
  }, [codeFromUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/trips/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to join trip');
      setLoading(false);
    } else {
      const trip = await res.json();
      router.push(`/trip/${trip._id}/overview`);
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
        Join a Trip
      </h1>
      <p
        className="text-center mb-8"
        style={{ fontSize: '0.9375rem', color: 'rgba(26,30,28,0.55)', fontFamily: 'var(--font-body)' }}
      >
        Enter the 6-character code shared by your trip creator
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Room code — custom styled, monospaced, centred */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
          }}
        >
          <input
            type="text"
            placeholder="TRP987"
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
            className="w-full text-center tracking-[0.35em] font-mono uppercase outline-none px-4 py-[16px]"
            style={{
              fontSize: '1.5rem',
              color: 'var(--color-charcoal)',
              backgroundColor: '#ffffff',
              fontFamily: 'monospace',
            }}
            onFocus={e => {
              (e.currentTarget.parentElement as HTMLElement).style.border = '1px solid #7e9a88';
              (e.currentTarget.parentElement as HTMLElement).style.boxShadow = '0 0 0 3px rgba(154,183,211,0.35)';
            }}
            onBlur={e => {
              (e.currentTarget.parentElement as HTMLElement).style.border = '1px solid var(--color-border)';
              (e.currentTarget.parentElement as HTMLElement).style.boxShadow = '0 4px 20px -2px rgba(26,30,28,0.04)';
            }}
          />
        </div>

        {/* Character progress dots */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                backgroundColor: i < roomCode.length ? '#7e9a88' : 'var(--color-border)',
              }}
            />
          ))}
        </div>

        {error && (
          <p
            className="text-sm px-4 py-2 rounded-xl"
            style={{ color: '#ba1a1a', backgroundColor: '#ffdad6' }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || roomCode.length !== 6}
          className="w-full font-medium text-white rounded-2xl py-[14px] mt-2 transition-colors disabled:opacity-50"
          style={{
            height: '52px',
            backgroundColor: loading || roomCode.length !== 6 ? '#7e9a88' : '#4a6454',
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={e => { if (!loading && roomCode.length === 6) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6e8b78'; }}
          onMouseLeave={e => { if (roomCode.length === 6) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#4a6454'; }}
        >
          {loading ? 'Joining…' : 'Join Trip'}
        </button>
      </form>
    </AuthCard>
  );
}

export default function JoinTripPage() {
  return (
    <Suspense
      fallback={
        <AuthCard>
          <Logo className="mb-8" />
          <div className="text-center py-12 text-sm text-gray-500">Loading trip join portal…</div>
        </AuthCard>
      }
    >
      <JoinTripForm />
    </Suspense>
  );
}
