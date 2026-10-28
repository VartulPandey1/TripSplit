export default function OverviewSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 animate-fade-in" aria-label="Loading trip details…">
      {/* 1. Trip Header Card Skeleton */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 bg-white border border-black/[0.05] shadow-xs">
        {/* Top Status & ⋯ Menu */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <div className="h-6 w-20 rounded-full skeleton-shimmer" />
            <div className="h-6 w-12 rounded-full skeleton-shimmer" />
          </div>
          <div className="w-10 h-10 rounded-xl skeleton-shimmer" />
        </div>

        {/* Trip Title & Subtitle */}
        <div className="h-7 sm:h-8 w-3/5 rounded-xl skeleton-shimmer mb-2.5" />
        <div className="flex items-center gap-2 mb-4">
          <div className="h-4 w-36 rounded-md skeleton-shimmer" />
          <div className="h-3 w-3 rounded-full skeleton-shimmer" />
          <div className="h-4 w-24 rounded-md skeleton-shimmer" />
        </div>

        {/* Member Avatars & Room Code Copy Pill */}
        <div className="flex items-center justify-between pt-3 border-t border-black/[0.04]">
          <div className="flex items-center -space-x-2">
            <div className="w-8 h-8 rounded-full border-2 border-white skeleton-shimmer" />
            <div className="w-8 h-8 rounded-full border-2 border-white skeleton-shimmer" />
            <div className="w-8 h-8 rounded-full border-2 border-white skeleton-shimmer" />
            <div className="w-8 h-8 rounded-full border-2 border-white skeleton-shimmer" />
          </div>
          <div className="h-8 w-28 rounded-xl skeleton-shimmer" />
        </div>
      </div>

      {/* 2. Upcoming Milestone / Next Stop Card Skeleton */}
      <div className="rounded-2xl p-4 sm:p-5 bg-white border border-black/[0.05] shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="h-4 w-28 rounded-md skeleton-shimmer" />
          <div className="h-4 w-16 rounded-md skeleton-shimmer" />
        </div>
        <div className="h-5 w-3/4 rounded-lg skeleton-shimmer mb-2" />
        <div className="h-3.5 w-1/2 rounded-md skeleton-shimmer" />
      </div>

      {/* 3. Checklists & Gear Card Skeleton */}
      <div className="rounded-2xl p-4 sm:p-5 bg-white border border-black/[0.05] shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-32 rounded-lg skeleton-shimmer" />
          <div className="h-7 w-36 rounded-xl skeleton-shimmer" />
        </div>

        <div className="space-y-3">
          {/* Row 1 */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2.5 flex-1">
              <div className="w-5 h-5 rounded-full skeleton-shimmer shrink-0" />
              <div className="h-4 w-44 rounded-md skeleton-shimmer" />
            </div>
            <div className="h-6 w-14 rounded-lg skeleton-shimmer shrink-0" />
          </div>
          {/* Row 2 */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2.5 flex-1">
              <div className="w-5 h-5 rounded-full skeleton-shimmer shrink-0" />
              <div className="h-4 w-36 rounded-md skeleton-shimmer" />
            </div>
            <div className="h-6 w-14 rounded-lg skeleton-shimmer shrink-0" />
          </div>
          {/* Row 3 */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2.5 flex-1">
              <div className="w-5 h-5 rounded-full skeleton-shimmer shrink-0" />
              <div className="h-4 w-40 rounded-md skeleton-shimmer" />
            </div>
            <div className="h-6 w-14 rounded-lg skeleton-shimmer shrink-0" />
          </div>
        </div>
      </div>

      {/* 4. Analytics Card Skeleton */}
      <div className="rounded-2xl p-4 sm:p-5 bg-white border border-black/[0.05] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-36 rounded-lg skeleton-shimmer" />
          <div className="h-4 w-20 rounded-md skeleton-shimmer" />
        </div>
        <div className="h-7 w-28 rounded-lg skeleton-shimmer mb-2.5" />
        <div className="h-2.5 w-full rounded-full skeleton-shimmer" />
      </div>
    </div>
  );
}
