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
      className="min-h-[44px] min-w-[44px] text-xs font-medium px-3 py-2 rounded-full transition-all cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5 hover:bg-gray-50 active:scale-95 bg-white border border-black/[0.05] text-gray-700"
      title="Sign out"
      aria-label="Sign out"
    >
      {signingOut ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span className="hidden sm:inline">Signing out…</span>
        </>
      ) : (
        <>
          <span className="sm:hidden text-sm">🚪</span>
          <span className="hidden sm:inline">Sign out</span>
        </>
      )}
    </button>
  );
}
