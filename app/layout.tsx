import type { Metadata, Viewport } from 'next';
import './globals.css';
import OfflineSyncManager from '@/app/components/OfflineSyncManager';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'TripSplit – Group Travel Organizer',
  description: 'Plan, split expenses, and coordinate with your travel group.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen" style={{ backgroundColor: 'var(--color-silk)', color: 'var(--color-charcoal)' }}>
        {children}
        <OfflineSyncManager />
      </body>
    </html>
  );
}
