'use client';

import { useState } from 'react';
import { clearLocalDatabase } from '@/lib/dexie/db';

interface SignOutButtonProps {
  onSignOut: () => Promise<void>;
}

export default function SignOutButton({ onSignOut }: SignOutButtonProps) {
  const [signingOut, setSigningOut] = useState(false);

  const handleClick = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Purge local IndexedDB so another user logging into this device does not sync old user's actions
      await clearLocalDatabase();
    } catch (err) {
      console.warn('[TripSplit] Error clearing offline queue on logout:', err);
    }
    await onSignOut();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={signingOut}
      className="text-xs font-medium px-3 py-1.5 rounded-full transition-all cursor-pointer disabled:opacity-50"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--color-border)',
        color: 'rgba(26,30,28,0.6)',
        boxShadow: '0 2px 8px -1px rgba(26,30,28,0.04)',
      }}
    >
      {signingOut ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
