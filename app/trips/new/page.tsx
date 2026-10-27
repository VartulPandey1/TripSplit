'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/app/components/Logo';
import AuthCard from '@/app/components/AuthCard';
import FloatingInput from '@/app/components/FloatingInput';
import { CURRENCIES } from '@/lib/utils/currency';

export default function NewTripPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    destinationQuery: '',
    startDate: '',
    endDate: '',
    currency: 'INR',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, val: string) {
    setForm((f) => ({ ...f, [field]: val }));
    if (error) setError('');
  }

  function handleStartDateChange(val: string) {
    setForm((prev) => {
      const next = { ...prev, startDate: val };
      // If end date is already set and is earlier than the new start date, auto-bump it
      if (prev.endDate && val && prev.endDate < val) {
        next.endDate = val;
      }
      return next;
    });
    if (error) setError('');
  }

  function handleEndDateChange(val: string) {
    setForm((prev) => ({ ...prev, endDate: val }));
    if (form.startDate && val && val < form.startDate) {
      setError('End date cannot be earlier than start date');
    } else if (error) {
      setError('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = form.name.trim();
    const trimmedDest = form.destinationQuery.trim();

    if (!trimmedName) {
      setError('Trip name cannot be blank');
      return;
    }
    if (!trimmedDest) {
      setError('Destination cannot be blank');
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError('Please choose both start and end dates');
      return;
    }
    if (new Date(form.startDate) > new Date(form.endDate)) {
      setError('End date cannot be earlier than start date');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        name: trimmedName,
        destinationQuery: trimmedDest,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to create trip');
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
        New Trip
      </h1>
      <p
        className="text-center mb-8"
        style={{ fontSize: '0.9375rem', color: 'rgba(26,30,28,0.55)', fontFamily: 'var(--font-body)' }}
      >
        Fill in the details to get started
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FloatingInput
          label="Trip name (e.g. Goa 2026)"
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          required
        />
        <FloatingInput
          label="Destination (e.g. Goa, India)"
          type="text"
          value={form.destinationQuery}
          onChange={(e) => update('destinationQuery', e.target.value)}
          required
        />

        {/* Currency Selector */}
        <div>
          <label
            className="text-[0.6875rem] font-medium block mb-1"
            style={{ letterSpacing: '0.04em', color: 'rgba(26,30,28,0.55)', fontFamily: 'var(--font-body)' }}
          >
            DEFAULT CURRENCY
          </label>
          <select
            value={form.currency}
            onChange={(e) => update('currency', e.target.value)}
            className="w-full rounded-2xl px-4 py-3 outline-none text-sm transition-all"
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
              color: 'var(--color-charcoal)',
            }}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date row with calendar constraints */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <label
              className="text-[0.6875rem] font-medium"
              style={{ letterSpacing: '0.04em', color: 'rgba(26,30,28,0.55)', fontFamily: 'var(--font-body)' }}
            >
              START DATE
            </label>
            <input
              type="date"
              value={form.startDate}
              max={form.endDate || undefined}
              onChange={(e) => handleStartDateChange(e.target.value)}
              required
              className="w-full rounded-2xl px-4 py-3 text-base sm:text-[0.9375rem] outline-none transition-all"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
                color: 'var(--color-charcoal)',
                fontFamily: 'var(--font-body)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = '1px solid #7e9a88';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(154,183,211,0.35)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1px solid var(--color-border)';
                e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(26,30,28,0.04)';
              }}
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label
              className="text-[0.6875rem] font-medium"
              style={{ letterSpacing: '0.04em', color: 'rgba(26,30,28,0.55)', fontFamily: 'var(--font-body)' }}
            >
              END DATE
            </label>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(e) => handleEndDateChange(e.target.value)}
              required
              className="w-full rounded-2xl px-4 py-3 text-base sm:text-[0.9375rem] outline-none transition-all"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 20px -2px rgba(26,30,28,0.04)',
                color: 'var(--color-charcoal)',
                fontFamily: 'var(--font-body)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = '1px solid #7e9a88';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(154,183,211,0.35)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1px solid var(--color-border)';
                e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(26,30,28,0.04)';
              }}
            />
          </div>
        </div>

        {error && (
          <p
            className="text-sm px-4 py-2 rounded-xl text-center"
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
          {loading ? 'Creating…' : 'Create Trip'}
        </button>
      </form>
    </AuthCard>
  );
}
