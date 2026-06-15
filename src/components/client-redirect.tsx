"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

interface ClientRedirectProps {
  to: string;
}

export function ClientRedirect({ to }: ClientRedirectProps) {
  const router = useRouter();

  React.useEffect(() => {
    router.replace(to);
  }, [router, to]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Redirecting...</p>
      </div>
    </div>
  );
}
