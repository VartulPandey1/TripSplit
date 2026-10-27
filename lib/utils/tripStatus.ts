export type TripDisplayStatus = 'upcoming' | 'ongoing' | 'completed';

export interface TripStatusInput {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  status?: string | null;
}

/**
 * Calculates trip status dynamically based on current local date and optional manual override.
 * - If status is manually set to 'completed', returns 'completed'.
 * - If before start date, returns 'upcoming'.
 * - If between start and end date (inclusive), returns 'ongoing'.
 * - If after end date, returns 'completed'.
 */
export function getTripStatus(trip: TripStatusInput): TripDisplayStatus {
  if (trip.status === 'completed') {
    return 'completed';
  }
  if (trip.status === 'reopened') {
    return 'ongoing';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let startTime: number | null = null;
  let endTime: number | null = null;

  if (trip.startDate) {
    const s = new Date(trip.startDate);
    if (!isNaN(s.getTime())) {
      startTime = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
    }
  }

  if (trip.endDate) {
    const e = new Date(trip.endDate);
    if (!isNaN(e.getTime())) {
      endTime = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
    }
  }

  if (startTime !== null && today < startTime) {
    return 'upcoming';
  }

  if (endTime !== null && today > endTime) {
    return 'completed';
  }

  return 'ongoing';
}

export function getTripStatusBadge(status: TripDisplayStatus): {
  label: string;
  icon: string;
  bg: string;
  color: string;
  border: string;
} {
  switch (status) {
    case 'upcoming':
      return {
        label: 'Upcoming',
        icon: '🗓️',
        bg: '#e0f2fe',
        color: '#0369a1',
        border: '#bae6fd',
      };
    case 'ongoing':
      return {
        label: 'Ongoing',
        icon: '✈️',
        bg: '#ccead5',
        color: '#183124',
        border: '#a3d9b4',
      };
    case 'completed':
      return {
        label: 'Completed',
        icon: '✓',
        bg: '#ecefeb',
        color: '#424843',
        border: '#d8dbd7',
      };
  }
}
