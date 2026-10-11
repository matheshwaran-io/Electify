"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, Download, Printer } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { StudentHeader } from "@/components/student/student-chrome";
import { downloadReceiptPdf } from "./receipt-pdf";

interface SuccessViewProps {
  student: {
    name: string;
    registerNumber: string;
    email: string;
    department?: string;
    degree?: string;
    section?: string;
  };
  event: {
    name: string;
  };
  registrations: {
    groupName: string;
    electiveName: string;
    submittedAt: Date;
  }[];
  allowRegistrationEdit: boolean;
  receiptNumber?: string;
}

export function SuccessView({ student, event, registrations, receiptNumber }: SuccessViewProps) {
  const [copied, setCopied] = React.useState(false);
  const [pdfPending, setPdfPending] = React.useState(false);

  const submittedAt = React.useMemo(() => {
    if (registrations.length === 0) return null;
    return new Date(Math.max(...registrations.map((r) => new Date(r.submittedAt).getTime())));
  }, [registrations]);

  const formattedDate = submittedAt?.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" }) ?? "";

  const copyReceipt = async () => {
    if (!receiptNumber) return;
    try {
      await navigator.clipboard.writeText(receiptNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy. Select the number and copy it manually.");
    }
  };

  const downloadPdf = async () => {
    setPdfPending(true);
    try {
      await downloadReceiptPdf({
        receiptNumber: receiptNumber ?? "N/A",
        eventName: event.name,
        submittedAt: submittedAt ?? new Date(),
        student,
        electives: registrations.map((r) => ({ groupName: r.groupName, electiveName: r.electiveName })),
      });
    } catch {
      toast.error("The PDF didn't generate. Try Print instead.");
    } finally {
      setPdfPending(false);
    }
  };

  const details: { label: string; value?: string; mono?: boolean }[] = [
    { label: "Name", value: student.name },
    { label: "Register number", value: student.registerNumber, mono: true },
    { label: "Email", value: student.email },
    { label: "Programme", value: student.degree },
    { label: "Department", value: student.department },
    { label: "Section", value: student.section },
  ];

  return (
    <div className="flex min-h-dvh flex-col print:block print:min-h-0">
      <StudentHeader className="print:hidden" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14 print:max-w-none print:p-0">
        {/* Confirmation */}
        <div className="mb-8 flex flex-col items-center text-center print:hidden">
          <SuccessMark />
          <h1 className="mt-7 text-4xl font-light tracking-display text-fg animate-enter [animation-delay:250ms]">You&apos;re registered</h1>
          <p className="mt-2 max-w-md text-fg-muted animate-enter [animation-delay:320ms]">
            Your seats for {event.name} are confirmed. Keep this receipt for your records.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 animate-enter [animation-delay:400ms]">
            <Button onClick={downloadPdf} loading={pdfPending} loadingText="Preparing PDF">
              <Download /> Download PDF
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </div>
        </div>

        {/* Receipt */}
        <article
          id="receipt"
          aria-label="Registration receipt"
          className="overflow-hidden rounded-card border border-border bg-surface shadow-2 animate-enter [animation-delay:450ms] print:rounded-none print:border-0 print:shadow-none print:animate-none"
        >
          <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div>
              <Logo size="sm" />
              <p className="mt-3 text-xs text-fg-muted">Registration receipt</p>
            </div>
            <div className="sm:text-right">
              <div className="flex items-center gap-1 sm:justify-end">
                <span className="font-mono text-sm font-medium text-fg">{receiptNumber}</span>
                <button
                  type="button"
                  onClick={copyReceipt}
                  aria-label={copied ? "Receipt number copied" : "Copy receipt number"}
                  className="inline-flex size-8 items-center justify-center rounded-badge text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg print:hidden"
                >
                  {copied ? <Check className="size-3.5 text-success-text" /> : <Copy className="size-3.5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-fg-muted" suppressHydrationWarning>
                {formattedDate}
              </p>
            </div>
          </header>

          <div className="space-y-6 p-5 sm:p-6">
            <div className="flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-4 py-2.5 text-sm">
              <Check className="size-4 text-success-text" strokeWidth={3} />
              <span className="font-medium text-success-text">Confirmed</span>
              <span className="text-fg-muted">for {event.name}</span>
            </div>

            <section aria-label="Student">
              <h2 className="mb-3 text-xs font-medium text-fg-subtle">Student</h2>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {details
                  .filter((d) => d.value)
                  .map((d) => (
                    <div key={d.label} className="min-w-0">
                      <dt className="text-xs text-fg-muted">{d.label}</dt>
                      <dd className={d.mono ? "mt-0.5 font-mono text-sm font-medium text-fg" : "mt-0.5 truncate text-sm font-medium text-fg"}>{d.value}</dd>
                    </div>
                  ))}
              </dl>
            </section>

            <section aria-label="Electives">
              <h2 className="mb-3 text-xs font-medium text-fg-subtle">Electives</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-control border border-border">
                {registrations.map((reg, index) => (
                  <li key={index} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span className="text-xs text-fg-muted sm:w-2/5">{reg.groupName}</span>
                    <span className="text-sm font-medium text-fg sm:flex-1 sm:text-right">{reg.electiveName || "Name unavailable"}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="hidden justify-between pt-16 print:flex">
              <span className="w-48 border-t border-border-strong pt-2 text-center text-xs text-fg-muted">Student signature</span>
              <span className="w-48 border-t border-border-strong pt-2 text-center text-xs text-fg-muted">Authorised signatory</span>
            </div>
          </div>

          <footer className="border-t border-border bg-surface-2/50 px-5 py-3.5 text-xs text-fg-muted sm:px-6">
            Computer generated receipt for {event.name}.
          </footer>
        </article>
      </main>
    </div>
  );
}

/**
 * The logo's gold dot and check, enlarged: "your choice is confirmed".
 * The tick draws itself once; static under reduced motion.
 */
function SuccessMark() {
  return (
    <div className="relative isolate size-24 animate-enter" aria-hidden>
      <div className="absolute inset-[6%] -z-10 rounded-full bg-brand-gold opacity-40 blur-2xl" />
      <svg viewBox="73 45 30 30" className="size-full">
        <circle cx={88} cy={60} r={15} fill="var(--brand-gold)" />
        <path
          d="M80.5 60.5L86 66L95.5 55"
          fill="none"
          stroke="var(--brand-midnight)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="23"
          strokeDashoffset="23"
          className="motion-safe:animate-[draw_420ms_var(--ease-gentle)_320ms_forwards] motion-reduce:[stroke-dashoffset:0]"
        />
      </svg>
    </div>
  );
}
