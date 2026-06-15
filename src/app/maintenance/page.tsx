"use client";

import * as React from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wrench, Mail, Clock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center relative bg-gradient-to-br from-amber-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] rounded-full bg-amber-200/20 dark:bg-amber-900/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] rounded-full bg-slate-200/40 dark:bg-slate-900/10 blur-[120px] pointer-events-none" />

      {/* Header Utilities */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-md text-center z-10 p-6 animate-in fade-in zoom-in duration-500">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 text-white shadow-xl shadow-amber-500/20 dark:shadow-none mb-6 ring-4 ring-amber-50 dark:ring-amber-950 animate-bounce">
          <Wrench className="w-9 h-9" />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight mb-3">
          Under Maintenance
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium leading-relaxed">
          Electify is currently undergoing scheduled updates to ensure a smooth elective registration experience. We will be back online shortly.
        </p>

        <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3 text-left">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
              Estimated Duration
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5 font-medium">
              Maintenance usually takes 15 to 30 minutes. Please refresh this page shortly.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Button
            variant="outline"
            className="rounded-xl w-full sm:w-auto flex items-center justify-center gap-2"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
          <a
            href="mailto:support@electify.edu"
            className={buttonVariants({ variant: "ghost" }) + " rounded-xl w-full sm:w-auto text-slate-500 hover:text-slate-700 dark:text-slate-400 flex items-center justify-center gap-2"}
          >
            <Mail className="w-4 h-4" /> Contact Support
          </a>
        </div>
      </div>
    </main>
  );
}
