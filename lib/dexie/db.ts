import Dexie, { Table } from 'dexie';

export interface PendingSyncAction {
  id?: number;
  userId?: string;
  type: 'CREATE_EXPENSE' | 'CLAIM_GEAR' | 'COMPLETE_TASK' | 'CREATE_TASK';
  payload: Record<string, unknown>;
  createdAt: number;
  error?: string;
  retryCount?: number;
}

export interface CachedTrip {
  id: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

export interface CachedExpense {
  id: string;
  tripId: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

class TripSplitDB extends Dexie {
  pending_sync_queue!: Table<PendingSyncAction, number>;
  cached_trips!: Table<CachedTrip, string>;
  cached_expenses!: Table<CachedExpense, string>;

  constructor() {
    super('tripsplit-db');
    this.version(1).stores({
      pending_sync_queue: '++id, type, createdAt',
      cached_trips: 'id, updatedAt',
      cached_expenses: 'id, tripId, updatedAt',
    });
    this.version(2).stores({
      pending_sync_queue: '++id, userId, type, createdAt',
      cached_trips: 'id, updatedAt',
      cached_expenses: 'id, tripId, updatedAt',
    });
  }
}

// Only instantiate on client-side
const db = typeof window !== 'undefined' ? new TripSplitDB() : null!;
export default db;

export async function clearLocalDatabase() {
  if (typeof window === 'undefined' || !db) return;
  try {
    await db.pending_sync_queue.clear();
    await db.cached_trips.clear();
    await db.cached_expenses.clear();
    console.log('[TripSplit] Cleared local offline IndexedDB cache upon user sign-out.');
  } catch (err) {
    console.warn('[TripSplit] Error clearing local IndexedDB:', err);
  }
}
