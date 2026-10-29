import type { Metadata, Viewport } from 'next';
import './globals.css';
import OfflineSyncManager from '@/app/components/OfflineSyncManager';
import { ThemeProvider } from '@/app/components/ThemeProvider';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('tripsplit_theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen" style={{ backgroundColor: 'var(--color-silk)', color: 'var(--color-charcoal)' }}>
        <ThemeProvider>
          {children}
          <OfflineSyncManager />
        </ThemeProvider>
      </body>
    </html>
  );
}
