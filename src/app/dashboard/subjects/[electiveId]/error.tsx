"use client";

import Link from "next/link";
import { ErrorState } from "@/components/ui/feedback";

export default function SubjectCatalogError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5">
      <ErrorState
        title="Subjects didn't load"
        description="Something went wrong on our side or your connection dropped. Your registration is not affected."
        onRetry={reset}
      />
      <Link href="/dashboard" className="mt-2 text-sm font-medium text-fg underline-offset-4 hover:underline">
        Back to registration
      </Link>
    </main>
  );
}
