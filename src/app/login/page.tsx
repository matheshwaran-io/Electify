import type { Metadata } from "next";
import { AuthContainer } from "@/components/auth/auth-container";
import { BrandPanel } from "@/components/auth/brand-panel";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Sign in" };

export default function UnifiedLoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[80rem] items-center justify-between px-5 pt-safe sm:px-8 lg:px-16">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="mx-auto grid w-full max-w-[80rem] flex-1 items-center gap-8 px-5 pb-10 pt-4 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-20 lg:px-16 lg:pb-16">
        <BrandPanel />

        <div className="w-full animate-enter [animation-delay:100ms] lg:max-w-md lg:justify-self-end">
          <div className="rounded-panel bg-surface-2 p-5 sm:p-8">
            <AuthContainer />
          </div>
          <p className="mt-5 px-1 text-xs text-fg-subtle">Sign-ins are rate limited and recorded in the audit log.</p>
        </div>
      </main>
    </div>
  );
}
