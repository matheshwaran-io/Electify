import { Skeleton } from "@/components/ui/feedback";

export default function SubjectCatalogLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6" aria-busy="true" aria-label="Loading subjects">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-10 w-72 rounded-control" />
      <Skeleton className="mt-6 h-20 w-full rounded-card" />
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-card" />
        ))}
      </div>
    </div>
  );
}
