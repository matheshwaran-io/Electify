import { Skeleton } from "@/components/ui/feedback";

export default function SubjectDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6" aria-busy="true" aria-label="Loading subject">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-12 w-80 max-w-full rounded-control" />
      <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      <Skeleton className="mt-8 h-20 w-full rounded-card" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-48 w-full rounded-card" />
        </div>
        <Skeleton className="h-80 w-full rounded-card" />
      </div>
    </div>
  );
}
