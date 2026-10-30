import Link from 'next/link';
import { APP_VERSION } from '@/lib/constants/version';

interface LogoProps {
  className?: string;
  layout?: 'vertical' | 'horizontal';
  size?: number;
  href?: string;
  showVersion?: boolean;
}

/**
 * TripSplit brand logo — inline SVG conforming to the "Ethereal Sanctuary" design.
 * Supports vertical (cards/auth pages) and horizontal (headers/navigation) layouts.
 */
export default function Logo({
  className = '',
  layout = 'vertical',
  size,
  href,
  showVersion = true,
}: LogoProps) {
  const iconSize = size ?? (layout === 'horizontal' ? 34 : 48);
  const isHorizontal = layout === 'horizontal';

  const content = (
    <div
      className={`inline-flex items-center ${
        isHorizontal ? 'flex-row gap-2.5' : 'flex-col gap-2'
      } ${className}`}
    >
      {/* Icon mark */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Soft circle backdrop */}
        <circle cx="24" cy="24" r="24" fill="#7e9a88" fillOpacity="0.12" />
        {/* Plane silhouette */}
        <path
          d="M36 14L20 22.5L14 20L12 23L19 26.5L17 34L20 35L24.5 28.5L32 32L34 30L25.5 17L36 14Z"
          fill="#4a6454"
        />
        {/* Horizontal split line */}
        <line
          x1="13"
          y1="38"
          x2="35"
          y2="38"
          stroke="#7e9a88"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {/* Wordmark */}
      <div className="inline-flex items-baseline gap-1.5 leading-none">
        <span
          style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em' }}
          className={`${
            isHorizontal ? 'text-lg' : 'text-xl'
          } font-semibold text-[#4a6454] dark:text-white select-none`}
        >
          Trip<span className="text-[#7e9a88] dark:text-zinc-400">Split</span>
        </span>
        {showVersion && (
          <span
            className="text-[9px] font-mono font-medium tracking-tight text-gray-400/80 dark:text-zinc-500 select-none"
            title={`TripSplit v${APP_VERSION}`}
          >
            v{APP_VERSION}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center transition-opacity hover:opacity-85">
        {content}
      </Link>
    );
  }

  return content;
}
