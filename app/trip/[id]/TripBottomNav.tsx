'use client';

import Link from 'next/link';
import { useParams, useSelectedLayoutSegment } from 'next/navigation';

function OverviewIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H4a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

function MoneyIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <circle cx="17" cy="14.5" r="1" fill="currentColor" />
    </svg>
  );
}

function PlanIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

function TasksIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

const TABS = [
  { href: 'overview', label: 'Overview', renderIcon: (active: boolean) => <OverviewIcon active={active} /> },
  { href: 'money', label: 'Money', renderIcon: (active: boolean) => <MoneyIcon active={active} /> },
  { href: 'plan', label: 'Plan', renderIcon: (active: boolean) => <PlanIcon active={active} /> },
  { href: 'tasks', label: 'Tasks', renderIcon: (active: boolean) => <TasksIcon active={active} /> },
];

export default function TripBottomNav() {
  const params = useParams<{ id: string }>();
  const segment = useSelectedLayoutSegment();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 flex"
      style={{
        backgroundColor: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--color-border)',
        boxShadow: '0 -4px 20px -2px rgba(26,30,28,0.03)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="w-full max-w-4xl mx-auto flex">
        {TABS.map((tab) => {
          const isActive = segment === tab.href;
          return (
            <Link
              key={tab.href}
              href={`/trip/${params.id}/${tab.href}`}
              className="flex-1 flex flex-col items-center justify-center py-2.5 text-xs transition-colors"
              style={{
                color: isActive ? '#4a6454' : 'rgba(26,30,28,0.45)',
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'var(--font-body)',
              }}
            >
              <span className="mb-1 transition-transform duration-150" style={{ transform: isActive ? 'scale(1.05)' : 'scale(1)' }}>
                {tab.renderIcon(isActive)}
              </span>
              <span style={{ fontSize: '0.6875rem', letterSpacing: '0.01em' }}>{tab.label}</span>
              {isActive && (
                <span
                  className="w-1 h-1 rounded-full mt-1"
                  style={{ backgroundColor: '#4a6454' }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
