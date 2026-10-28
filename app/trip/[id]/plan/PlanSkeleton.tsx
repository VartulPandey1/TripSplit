export default function PlanSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 animate-fade-in" aria-label="Loading itinerary…">
      {/* Title */}
      <div className="mb-4">
        <div className="h-8 w-48 rounded-xl skeleton-shimmer mb-1.5" />
        <div className="h-4 w-64 rounded-md skeleton-shimmer" />
      </div>

      {/* 3-Tab Toggle: Itinerary | Budget | Notes */}
      <div className="h-11 w-full rounded-2xl skeleton-shimmer" />

      {/* Day / Stop Timeline Cards */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl p-4 sm:p-5 bg-white border border-black/[0.05] shadow-xs">
            <div className="flex items-center justify-between mb-2.5">
              <div className="h-5 w-24 rounded-full skeleton-shimmer" />
              <div className="h-4 w-16 rounded-md skeleton-shimmer" />
            </div>
            <div
              className="h-5 rounded-md skeleton-shimmer mb-2"
              style={{ width: `${Math.max(40, 75 - i * 10)}%` }}
            />
            <div className="h-3.5 w-1/2 rounded-md skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
