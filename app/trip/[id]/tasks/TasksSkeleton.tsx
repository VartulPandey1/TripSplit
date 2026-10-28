export default function TasksSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 animate-fade-in" aria-label="Loading checklists and gear…">
      {/* Title */}
      <div className="mb-4">
        <div className="h-8 w-56 rounded-xl skeleton-shimmer mb-2" />
        <div className="h-4 w-72 rounded-md skeleton-shimmer hidden sm:block" />
      </div>

      {/* Top Toggle Pills */}
      <div className="h-11 w-full rounded-2xl skeleton-shimmer mb-4" />

      {/* Checklist Rows Card */}
      <div className="rounded-2xl p-4 sm:p-5 bg-white border border-black/[0.05] shadow-xs space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-6 h-6 rounded-lg skeleton-shimmer shrink-0" />
              <div
                className="h-4 rounded-md skeleton-shimmer"
                style={{ width: `${Math.max(35, 65 - i * 7)}%` }}
              />
            </div>
            <div className="h-6 w-16 rounded-full skeleton-shimmer shrink-0 ml-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
