'use client';

import { useTheme } from './ThemeProvider';
import { useEffect, useState } from 'react';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`w-10 h-10 min-w-[40px] min-h-[40px] rounded-full border border-black/[0.05] bg-white opacity-0 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-full border border-black/[0.06] bg-white hover:bg-gray-50 active:scale-95 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700 shadow-2xs select-none touch-manipulation ${className}`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="text-sm select-none leading-none">
        {isDark ? '☀️' : '🌙'}
      </span>
      <span className="hidden md:inline text-xs font-semibold">
        {isDark ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
