"use client";

import * as React from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand";
import { Wrench, Mail, Clock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function MaintenanceView() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center relative bg-canvas p-4 overflow-hidden">
      <header className="absolute inset-x-0 top-0 flex h-16 items-center justify-between px-5 pt-safe sm:px-8">
        <Logo />
        <ThemeToggle />
      </header>

      <div className="max-w-md text-center z-10 p-6 duration-500">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-card bg-warning text-on-accent shadow-3 dark:shadow-none mb-6 ring-4 ring-warning/20">
          <Wrench className="w-9 h-9" />
        </div>

        <h1 className="text-3xl font-light tracking-display mb-3">
          Under Maintenance
        </h1>
        <p className="text-fg-muted mb-6 font-medium leading-relaxed">
          Electify is currently undergoing scheduled updates to ensure a smooth elective registration experience. We will be back online shortly.
        </p>

        <div className="bg-warning/10 border border-warning/20 rounded-card p-4 mb-6 flex items-start gap-3 text-left">
          <Clock className="w-5 h-5 text-warning-text mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-warning-text">
              Estimated Duration
            </h3>
            <p className="text-xs text-warning-text mt-0.5 font-medium">
              Maintenance usually takes 15 to 30 minutes. Please refresh this page shortly.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Button
            variant="outline"
            className="rounded-control w-full sm:w-auto flex items-center justify-center gap-2"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
          <a
            href="mailto:support@electify.edu"
            className={buttonVariants({ variant: "ghost" }) + " rounded-control w-full sm:w-auto text-fg-muted hover:text-fg-muted flex items-center justify-center gap-2"}
          >
            <Mail className="w-4 h-4" /> Contact Support
          </a>
        </div>
      </div>
    </main>
  );
}
