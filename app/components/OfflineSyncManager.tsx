'use client';

import { useState, useEffect } from 'react';
import {
  subscribeToSyncStatus,
  syncOfflineQueue,
  SyncStatus,
  retryOfflineActions,
} from '@/lib/dexie/sync';

export default function OfflineSyncManager() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
  });
  const [showSyncedToast, setShowSyncedToast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    // Register Service Worker for offline caching and PWA app shell
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('[TripSplit] Service Worker registration failed:', err));
    }

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue().then((res) => {
        if (res.synced > 0) {
          setShowSyncedToast(true);
          setTimeout(() => setShowSyncedToast(false), 3500);
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeToSyncStatus((status) => {
      setSyncStatus(status);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  // If online, nothing pending, no failures, and not syncing -> render nothing (or synced toast if active)
  if (isOnline && syncStatus.pendingCount === 0 && !syncStatus.isSyncing && !showSyncedToast) {
    return null;
  }

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 right-4 sm:right-6 z-40 max-w-sm pointer-events-auto animate-in slide-in-from-bottom duration-300">
      {!isOnline && (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold shadow-lg backdrop-blur-md"
          style={{
            backgroundColor: '#fff7ed',
            color: '#c2410c',
            border: '1px solid #fed7aa',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-[#f97316] animate-pulse shrink-0" />
          <span>Offline Mode • Changes will sync when reconnected</span>
          {syncStatus.pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#ffedd5] text-[10px] font-mono font-bold">
              {syncStatus.pendingCount} queued
            </span>
          )}
        </div>
      )}

      {isOnline && syncStatus.isSyncing && (
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold shadow-lg backdrop-blur-md"
          style={{
            backgroundColor: '#f0fdf4',
            color: '#15803d',
            border: '1px solid #bbf7d0',
          }}
        >
          <span className="animate-spin text-sm">🔄</span>
          <span>Syncing {syncStatus.pendingCount} offline change(s)...</span>
        </div>
      )}

      {isOnline && !syncStatus.isSyncing && syncStatus.failedCount > 0 && (
        <div
          className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold shadow-lg backdrop-blur-md"
          style={{
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span>⚠️</span>
            <span className="truncate">
              {syncStatus.failedCount} action(s) failed sync
            </span>
          </div>
          <button
            type="button"
            onClick={() => retryOfflineActions()}
            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white border border-[#f87171] text-[#b91c1c] text-xs font-bold hover:bg-red-50 cursor-pointer shrink-0 transition-colors inline-flex items-center justify-center"
          >
            Retry
          </button>
        </div>
      )}

      {isOnline && !syncStatus.isSyncing && syncStatus.pendingCount === 0 && showSyncedToast && (
        <div
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold shadow-md backdrop-blur-md"
          style={{
            backgroundColor: '#eef1ee',
            color: '#183124',
            border: '1px solid #ccead5',
          }}
        >
          <span>✓</span>
          <span>All offline changes synced</span>
        </div>
      )}
    </div>
  );
}
