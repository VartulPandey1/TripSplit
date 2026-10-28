export default function MoneySkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 animate-fade-in" aria-label="Loading ledger…">
      {/* Page Title */}
      <div className="mb-4">
        <div className="h-8 w-44 rounded-xl skeleton-shimmer mb-1.5" />
        <div className="h-4 w-60 rounded-md skeleton-shimmer" />
      </div>

      {/* 1-Line Financial Ticker */}
      <div className="h-14 w-full rounded-2xl skeleton-shimmer" />

      {/* Action Buttons */}
      <div className="flex gap-2">
        <div className="h-11 flex-1 rounded-2xl skeleton-shimmer" />
        <div className="h-11 flex-1 rounded-2xl skeleton-shimmer" />
      </div>

      {/* Toggle */}
      <div className="h-10 w-full rounded-2xl skeleton-shimmer" />

      {/* Transactions Card */}
      <div className="rounded-2xl p-4 sm:p-5 bg-white border border-black/[0.05] shadow-xs space-y-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-9 h-9 rounded-xl skeleton-shimmer shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div
                  className="h-4 rounded-md skeleton-shimmer"
                  style={{ width: `${Math.max(30, 60 - i * 8)}%` }}
                />
                <div className="h-3 w-28 rounded-md skeleton-shimmer" />
              </div>
            </div>
            <div className="h-5 w-16 rounded-md skeleton-shimmer shrink-0 ml-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
