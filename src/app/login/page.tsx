import type { Metadata } from "next";
import { AuthContainer } from "@/components/auth/auth-container";
import { BrandPanel } from "@/components/auth/brand-panel";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Sign in" };

export default function UnifiedLoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />

      <main className="relative flex flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between lg:justify-end">
          <Wordmark className="lg:hidden" />
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-enter">
          <AuthContainer />
        </div>

        <p className="mx-auto max-w-sm text-center text-xs text-fg-subtle lg:hidden">
          Sign-ins are rate limited and recorded in the audit log.
        </p>
      </main>
    </div>
  );
}
