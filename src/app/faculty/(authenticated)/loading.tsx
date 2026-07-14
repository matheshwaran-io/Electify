export default function Loading() {
  return (
    <div className="flex-1 w-full h-full p-8 flex flex-col gap-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2 border-b border-[var(--border)]/50 pb-6">
        <div className="h-8 w-1/3 bg-[var(--accent)] rounded-lg" />
        <div className="h-4 w-1/4 bg-[var(--accent)] rounded-lg" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--card)] p-6 rounded-xl border border-[var(--border)]/50 h-32 flex flex-col justify-between">
            <div className="h-8 w-8 bg-[var(--accent)] rounded-lg" />
            <div className="space-y-2">
              <div className="h-3 w-1/2 bg-[var(--accent)] rounded-lg" />
              <div className="h-6 w-1/3 bg-[var(--accent)] rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 bg-[var(--card)] rounded-xl border border-[var(--border)]/50 p-6 space-y-4">
        <div className="h-6 w-1/4 bg-[var(--accent)] rounded-lg mb-8" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="h-10 w-full bg-[var(--accent)]/50 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
