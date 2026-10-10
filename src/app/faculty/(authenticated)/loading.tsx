import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-8">
      <div className="space-y-2.5 pb-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-4 rounded-card border border-border bg-surface p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-card border border-border bg-surface p-5">
        <Skeleton className="h-9 w-72 max-w-full" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
