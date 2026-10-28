'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import AuthCard from '@/app/components/AuthCard';
import { extractRoomCode } from '@/lib/utils/roomCode';

function JoinTripForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';
  const [roomCode, setRoomCode] = useState(codeFromUrl.toUpperCase().slice(0, 6));
  const [loading, setLoading] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [error, setError] = useState('');
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (codeFromUrl) {
      setRoomCode(codeFromUrl.toUpperCase().slice(0, 6));
    }
  }, [codeFromUrl]);

  // Clean up any pending auto-submit timer on unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }
    };
  }, []);

  function cancelAutoSubmit() {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    setAutoSubmitting(false);
  }

  async function handleSubmit(e?: React.FormEvent, overrideCode?: string) {
    if (e) e.preventDefault();
    cancelAutoSubmit();

    const targetCode = (overrideCode ?? roomCode).trim().toUpperCase();
    if (!targetCode || targetCode.length !== 6) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/trips/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: targetCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to join trip');
        setLoading(false);
      } else {
        const trip = await res.json();
        router.push(`/trip/${trip._id}/overview`);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  async function handlePasteFromClipboard() {
    if (loading || autoSubmitting) return;

    setError('');

    // Check if Clipboard API is supported in the current environment
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) {
      setError('Clipboard access is not supported by your browser. Please type or paste manually.');
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setError('Your clipboard is empty. Copy a trip code or WhatsApp invite first.');
        return;
      }

      const extractedCode = extractRoomCode(text);
      if (!extractedCode) {
        setError('No valid 6-character room code found in clipboard.');
        return;
      }

      // Populate input immediately
      setRoomCode(extractedCode);
      setError('');
      setAutoSubmitting(true);

      // Cancel any prior timer
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }

      // Automatically submit in 1 second
      autoSubmitTimerRef.current = setTimeout(() => {
        handleSubmit(undefined, extractedCode);
      }, 1000);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('Clipboard permission denied. Please allow clipboard access or paste manually.');
      } else {
        setError('Unable to read clipboard. Please paste code manually.');
      }
    }
  }

  function handleInputPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    cancelAutoSubmit();
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const extracted = extractRoomCode(pastedText);
    if (extracted) {
      e.preventDefault();
      setRoomCode(extracted);
      setError('');
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

      <form onSubmit={e => handleSubmit(e)} className="flex flex-col gap-4">
        {/* Room code — custom styled, monospaced, centred */}
        <div
          className="rounded-2xl overflow-hidden transition-all"
          style={{
            border: autoSubmitting ? '1px solid #7e9a88' : '1px solid var(--color-border)',
            boxShadow: autoSubmitting
              ? '0 0 0 3px rgba(126,154,136,0.25)'
              : '0 4px 20px -2px rgba(26,30,28,0.04)',
          }}
        >
          <input
            type="text"
            placeholder="TRP987"
            value={roomCode}
            onChange={e => {
              cancelAutoSubmit();
              setRoomCode(e.target.value.toUpperCase());
            }}
            onPaste={handleInputPaste}
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
              (e.currentTarget.parentElement as HTMLElement).style.border = autoSubmitting
                ? '1px solid #7e9a88'
                : '1px solid var(--color-border)';
              (e.currentTarget.parentElement as HTMLElement).style.boxShadow = autoSubmitting
                ? '0 0 0 3px rgba(126,154,136,0.25)'
                : '0 4px 20px -2px rgba(26,30,28,0.04)';
            }}
          />
        </div>

        {/* Character progress dots */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-colors duration-200"
              style={{
                backgroundColor: i < roomCode.length ? '#7e9a88' : 'var(--color-border)',
              }}
            />
          ))}
        </div>

        {/* 1-Tap Paste from Clipboard button */}
        <button
          type="button"
          onClick={handlePasteFromClipboard}
          disabled={loading}
          className="relative overflow-hidden w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-medium text-sm transition-all duration-150 border cursor-pointer active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed select-none touch-manipulation hover:bg-[#ecefeb]"
          style={{
            backgroundColor: autoSubmitting ? '#eef4f0' : '#f7faf6',
            borderColor: autoSubmitting ? '#7e9a88' : 'rgba(126, 154, 136, 0.3)',
            color: autoSubmitting ? '#284634' : '#324c3d',
            fontFamily: 'var(--font-body)',
            boxShadow: '0 1px 3px rgba(26,30,28,0.04)',
          }}
        >
          {autoSubmitting ? (
            <div className="flex items-center gap-2">
              <span className="text-base animate-pulse">✓</span>
              <span>
                Pasted <strong>{roomCode}</strong>! Joining in 1s…
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <span>Paste code from clipboard</span>
            </div>
          )}

          {/* 1-second visual countdown progress bar */}
          {autoSubmitting && (
            <div
              className="absolute bottom-0 left-0 h-[3px] bg-[#4a6454] animate-paste-progress"
            />
          )}
        </button>

        {error && (
          <p
            className="text-sm px-4 py-2 rounded-xl transition-all"
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
          onMouseEnter={e => {
            if (!loading && roomCode.length === 6)
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6e8b78';
          }}
          onMouseLeave={e => {
            if (roomCode.length === 6)
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#4a6454';
          }}
        >
          {loading ? 'Joining…' : autoSubmitting ? 'Joining in 1s…' : 'Join Trip'}
        </button>

        <div className="text-center pt-1">
          <Link
            href="/dashboard"
            className="min-h-[44px] px-3 py-2 text-xs text-gray-500 hover:text-gray-800 transition-colors inline-flex items-center justify-center gap-1"
            title="Return to dashboard"
          >
            ← Back to Dashboard
          </Link>
        </div>
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
