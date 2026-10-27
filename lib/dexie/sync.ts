'use client';

import db, { PendingSyncAction } from './db';

export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncTime?: number;
  lastError?: string;
}

export type SyncListener = (status: SyncStatus) => void;
const listeners = new Set<SyncListener>();

function notifyListeners(status: SyncStatus) {
  listeners.forEach((listener) => {
    try {
      listener(status);
    } catch (e) {
      console.error('Error notifying sync listener:', e);
    }
  });
}

export function subscribeToSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  getSyncStatus().then(notifyListeners);
  return () => {
    listeners.delete(listener);
  };
}

export async function getSyncStatus(): Promise<SyncStatus> {
  if (typeof window === 'undefined' || !db) {
    return { isSyncing: false, pendingCount: 0, failedCount: 0 };
  }
  try {
    const all = await db.pending_sync_queue.toArray();
    const failed = all.filter((a) => Boolean(a.error));
    return {
      isSyncing: false,
      pendingCount: all.length,
      failedCount: failed.length,
      lastError: failed.length > 0 ? failed[0].error : undefined,
    };
  } catch {
    return { isSyncing: false, pendingCount: 0, failedCount: 0 };
  }
}

export async function syncOfflineQueue(currentUserId?: string): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined' || !db || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const allPending = await db.pending_sync_queue.toArray();

  // If a current user is known, discard or skip actions queued by a different user
  const pendingActions = currentUserId
    ? allPending.filter((a) => !a.userId || a.userId === currentUserId)
    : allPending;

  // Cleanup any orphaned actions from another user to prevent cross-account queue leaks
  if (currentUserId) {
    const foreignActions = allPending.filter((a) => a.userId && a.userId !== currentUserId);
    if (foreignActions.length > 0) {
      const foreignIds = foreignActions.map((a) => a.id!).filter(Boolean);
      await db.pending_sync_queue.bulkDelete(foreignIds);
      console.warn(`[TripSplit] Purged ${foreignIds.length} foreign offline actions from previous user session.`);
    }
  }

  if (pendingActions.length === 0) {
    notifyListeners({
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      lastSyncTime: Date.now(),
    });
    return { synced: 0, failed: 0 };
  }

  notifyListeners({
    isSyncing: true,
    pendingCount: pendingActions.length,
    failedCount: pendingActions.filter((a) => Boolean(a.error)).length,
  });

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offlineActions: pendingActions.map((action) => ({
          queueId: action.id,
          type: action.type,
          payload: action.payload,
        })),
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const results: Array<{ queueId?: number; success: boolean; error?: string }> = data.results || [];

      // 1. Only delete items that succeeded
      const successfulIds = results
        .filter((r) => r.success && typeof r.queueId === 'number')
        .map((r) => r.queueId as number);

      if (successfulIds.length > 0) {
        await db.pending_sync_queue.bulkDelete(successfulIds);
        console.log(`[TripSplit] Synced and removed ${successfulIds.length} item(s) from offline queue.`);
      }

      // 2. Retain failed items and update their error and retryCount
      const failedResults = results.filter((r) => !r.success && typeof r.queueId === 'number');
      for (const failed of failedResults) {
        const existing = pendingActions.find((a) => a.id === failed.queueId);
        if (existing && existing.id !== undefined) {
          await db.pending_sync_queue.update(existing.id, {
            error: failed.error || 'Sync rejected by server',
            retryCount: (existing.retryCount || 0) + 1,
          });
        }
      }

      const remaining = await db.pending_sync_queue.toArray();
      const failedCount = remaining.filter((a) => Boolean(a.error)).length;

      notifyListeners({
        isSyncing: false,
        pendingCount: remaining.length,
        failedCount,
        lastSyncTime: Date.now(),
        lastError: failedResults[0]?.error,
      });

      return { synced: successfulIds.length, failed: failedResults.length };
    } else {
      throw new Error(`Sync HTTP error ${res.status}`);
    }
  } catch (err: any) {
    console.error('[TripSplit] Sync failed:', err);
    const remaining = await db.pending_sync_queue.toArray();
    notifyListeners({
      isSyncing: false,
      pendingCount: remaining.length,
      failedCount: remaining.filter((a) => Boolean(a.error)).length,
      lastError: err?.message || 'Sync network error',
    });
    return { synced: 0, failed: pendingActions.length };
  }
}

export async function queueOfflineAction(
  type: 'CREATE_EXPENSE' | 'CLAIM_GEAR' | 'COMPLETE_TASK' | 'CREATE_TASK',
  payload: Record<string, unknown>,
  userId?: string
) {
  if (typeof window === 'undefined' || !db) return;
  await db.pending_sync_queue.add({
    userId,
    type,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
  });
  getSyncStatus().then(notifyListeners);
}

export async function deleteOfflineAction(id: number) {
  if (typeof window === 'undefined' || !db) return;
  await db.pending_sync_queue.delete(id);
  getSyncStatus().then(notifyListeners);
}

export async function retryOfflineActions() {
  return syncOfflineQueue();
}
