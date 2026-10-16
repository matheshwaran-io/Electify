"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  Printer,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  XCircle,
  Info,
  BookOpen,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { StudentPresencePing } from "@/components/student/student-presence-ping";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { StudentHeader } from "@/components/student/student-chrome";
import { OccupancyRing, seatState } from "@/components/ui/data-display";
import { downloadReceiptPdf } from "../success/receipt-pdf";
import {
  changeStudentElective,
  cancelStudentElective,
  cancelEntireRegistration,
  finalizeStudentRegistration,
} from "@/app/actions/register";
import { formatDateTime, formatRemaining } from "@/lib/format";

export interface AlternativeElective {
  id: string;
  groupId: string;
  name: string;
  courseCode: string | null;
  credits: number;
  description: string | null;
  maxSeats: number;
  availableSeats: number;
  isFull: boolean;
  sectionAvailableSeats?: number;
  sectionMaxSeats?: number;
}

export interface RegistrationChoice {
  id: string;
  groupId: string;
  groupName: string;
  electiveId: string;
  electiveName: string;
  courseCode: string | null;
  credits: number;
  status: string; // "CONFIRMED" | "CANCELLED"
  isLocked?: boolean;
  submittedAt: Date | string;
  availableSeats: number;
  maxSeats: number;
  isFull: boolean;
  sectionAvailableSeats?: number;
  sectionMaxSeats?: number;
  alternatives: AlternativeElective[];
}

export interface MyRegistrationProps {
  event: {
    id: string;
    name: string;
    openDate: Date | string | null;
    closeDate: Date | string | null;
    status: string;
    allowEditing: boolean;
    autoClose?: boolean;
    isOpen: boolean;
    reason?: string;
    sessionLabel?: string | null;
    semester?: number | null;
    classLabel?: string | null;
  };
  registration: {
    id: string;
    status: string; // "CONFIRMED" | "CANCELLED" | "RESET_BY_COORDINATOR"
    isFinalized?: boolean;
    receiptNumber: string | null;
    submittedAt: Date | string | null;
    receiptSnapshot: any;
  };
  student: {
    name: string;
    registerNumber: string;
    email: string;
    department?: string;
    degree?: string;
    section?: string;
  };
  choices: RegistrationChoice[];
  serverNow: number;
}

export function MyRegistrationClient({
  event,
  registration: initialRegistration,
  student,
  choices: initialChoices,
  serverNow,
}: MyRegistrationProps) {
  const router = useRouter();

  const registration = initialRegistration;
  const choices = initialChoices;
  const [copied, setCopied] = React.useState(false);
  const [pdfPending, setPdfPending] = React.useState(false);
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = React.useState(false);

  const isFinalized = Boolean(
    registration.isFinalized ||
    (registration.receiptNumber && registration.receiptNumber !== "PENDING")
  );

  // Modal states
  const [changeModalChoice, setChangeModalChoice] = React.useState<RegistrationChoice | null>(null);
  const [selectedReplacementId, setSelectedReplacementId] = React.useState<string | null>(null);
  const [changePending, setChangePending] = React.useState(false);

  const [cancelModalChoice, setCancelModalChoice] = React.useState<RegistrationChoice | null>(null);
  const [cancelAllOpen, setCancelAllOpen] = React.useState(false);

  // Closing countdown timer
  const [now, setNow] = React.useState(serverNow);
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const closeTime = event.closeDate ? new Date(event.closeDate).getTime() : null;
  const timeRemainingMs = closeTime ? Math.max(0, closeTime - now) : null;
  const isWindowActive =
    event.isOpen && (!closeTime || timeRemainingMs === null || timeRemainingMs > 0);

  const submittedAtDate = registration.submittedAt ? new Date(registration.submittedAt) : null;

  const copyReceipt = async () => {
    if (!registration.receiptNumber) return;
    try {
      await navigator.clipboard.writeText(registration.receiptNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy. Select the number and copy it manually.");
    }
  };

  const handleConfirmFinalize = async () => {
    try {
      const res = await finalizeStudentRegistration(event.id);
      if (!res.success) {
        toast.error(res.error || "Failed to finalize registration.");
        return;
      }

      toast.success(
        res.receiptNumber
          ? `Registration finalized! Receipt ${res.receiptNumber} generated.`
          : "Registration finalized successfully!"
      );
      setFinalizeConfirmOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to finalize registration.");
    }
  };

  const handlePrint = () => {
    if (!isFinalized || !registration.receiptNumber) {
      toast.info("Finish your registration first to print your official receipt.");
      return;
    }
    window.print();
  };

  const downloadPdf = async () => {
    if (!isFinalized || !registration.receiptNumber) {
      toast.info("Finish your registration first to download your official PDF.");
      return;
    }
    setPdfPending(true);
    try {
      await downloadReceiptPdf({
        receiptNumber: registration.receiptNumber,
        eventName: event.name,
        submittedAt: submittedAtDate ?? new Date(),
        student,
        academic: { classLabel: event.classLabel, academicSession: event.sessionLabel, semester: event.semester },
        electives: choices
          .filter((c) => c.status === "CONFIRMED")
          .map((c) => ({
            groupName: c.groupName,
            electiveName: c.courseCode ? `${c.courseCode} - ${c.electiveName}` : c.electiveName,
          })),
      });
    } catch {
      toast.error("The PDF didn't generate. Try Print instead.");
    } finally {
      setPdfPending(false);
    }
  };

  // ── Handler: Change Elective ──
  const openChangeModal = (choice: RegistrationChoice) => {
    setChangeModalChoice(choice);
    setSelectedReplacementId(null);
  };

  const handleConfirmChange = async () => {
    if (!changeModalChoice || !selectedReplacementId) return;

    const replacement = changeModalChoice.alternatives.find((a) => a.id === selectedReplacementId);
    if (!replacement) return;

    if (replacement.availableSeats <= 0) {
      toast.error(`${replacement.name} is full. Choose another elective.`);
      return;
    }

    setChangePending(true);
    try {
      const res = await changeStudentElective(
        event.id,
        changeModalChoice.groupId,
        changeModalChoice.electiveId,
        selectedReplacementId
      );

      if (!res.success) {
        toast.error(res.error || "Failed to change elective.");
        router.refresh(); // seat counts may have changed under us
        return;
      }

      toast.success(`Switched to ${replacement.courseCode || replacement.name}. Seat confirmed.`);

      setChangeModalChoice(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setChangePending(false);
    }
  };

  // ── Handler: Cancel Individual Elective ──
  const handleConfirmCancelChoice = async () => {
    if (!cancelModalChoice) return;
    try {
      const res = await cancelStudentElective(
        event.id,
        cancelModalChoice.groupId,
        cancelModalChoice.electiveId
      );

      if (!res.success) {
        toast.error(res.error || "Failed to cancel elective.");
        return;
      }

      toast.success(
        `Cancelled elective ${cancelModalChoice.courseCode || cancelModalChoice.electiveName}.`
      );
      setCancelModalChoice(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel elective.");
    }
  };

  // ── Handler: Cancel Entire Registration ──
  const handleConfirmCancelAll = async () => {
    try {
      const res = await cancelEntireRegistration(event.id);
      if (!res.success) {
        toast.error(res.error || "Failed to cancel registration.");
        return;
      }

      toast.success("Registration cancelled. All confirmed seats have been released.");
      setCancelAllOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel registration.");
    }
  };

  const selectedAlternative = changeModalChoice?.alternatives.find(
    (a) => a.id === selectedReplacementId
  );
  const selectedIsFull = selectedAlternative ? selectedAlternative.availableSeats <= 0 : false;

  const isAllCancelled = registration.status === "CANCELLED";

  return (
    <div className="flex min-h-dvh flex-col print:block print:min-h-0 bg-canvas">
      <StudentPresencePing eventId={event.id} stage="SUBMITTED" />
      <StudentHeader className="print:hidden">
        <Link
          href={`/dashboard/subjects?event=${encodeURIComponent(event.id)}`}
          className="inline-flex h-8 items-center rounded-control px-2.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          Subjects
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/dashboard/electives?event=${encodeURIComponent(event.id)}`)}
          className="text-xs"
        >
          <BookOpen className="size-3.5" /> Course Browser
        </Button>
      </StudentHeader>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:p-0">
        {/* Top Header & Live Status */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">{event.name}</span>
              <StatusBadge status={registration.status} size="sm" />
              {isFinalized ? (
                <Badge tone="success" size="sm" dot>Finalized</Badge>
              ) : (
                <Badge tone="warning" size="sm" dot>Pending Finalization</Badge>
              )}
            </div>
            <h1 className="mt-1 text-3xl font-light tracking-display text-fg">My Registration</h1>
            <p className="mt-0.5 text-sm text-fg-muted">
              {student.name} · <span className="font-mono">{student.registerNumber}</span> · {event.classLabel || `Section ${student.section || "N/A"}`}
              {event.sessionLabel ? ` · Academic session ${event.sessionLabel}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:self-start">
            {isFinalized ? (
              <>
                <Button variant="outline" size="sm" onClick={downloadPdf} loading={pdfPending}>
                  <Download className="size-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="size-3.5" /> Print
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={() => setFinalizeConfirmOpen(true)}
                  className="bg-primary text-primary-fg hover:bg-primary/90 font-medium shadow-sm"
                >
                  <Check className="size-3.5 mr-1" /> Finish Registration
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info("Finish your registration first to download your official PDF proof.")}
                  className="opacity-50 cursor-not-allowed"
                >
                  <Download className="size-3.5" /> PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info("Finish your registration first to print your official receipt.")}
                  className="opacity-50 cursor-not-allowed"
                >
                  <Printer className="size-3.5" /> Print
                </Button>
                {!isAllCancelled && isWindowActive && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setCancelAllOpen(true)}
                  >
                    <XCircle className="size-3.5" /> Cancel Registration
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Window Banner: Closing Time & Policies */}
        <div className="mb-6 rounded-card border border-border bg-surface shadow-1 overflow-hidden print:hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex size-9 items-center justify-center rounded-control bg-primary/10 text-primary-text">
                <Clock className="size-4.5" />
              </div>
              <div>
                <p className="text-xs text-fg-muted">Registration Window Closing Time</p>
                <p className="text-sm font-medium text-fg">
                  {event.closeDate ? formatDateTime(event.closeDate) : "Open-ended"}
                  {timeRemainingMs !== null && timeRemainingMs > 0 && (
                    <span className="ml-2 font-mono text-xs text-primary-text font-semibold">
                      ({formatRemaining(timeRemainingMs)} remaining)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isFinalized ? (
                <Badge tone="success" size="sm" dot>Registration Finalized</Badge>
              ) : isWindowActive ? (
                <Badge tone="live" dot size="sm">Window Open</Badge>
              ) : (
                <Badge tone="neutral" size="sm">Window Closed</Badge>
              )}
              {isFinalized ? (
                <Badge tone="neutral" size="sm">Choices Locked</Badge>
              ) : event.allowEditing ? (
                <Badge tone="neutral" size="sm">Changes Allowed</Badge>
              ) : (
                <Badge tone="warning" size="sm">Changes Locked</Badge>
              )}
            </div>
          </div>

          {!isFinalized && isWindowActive && !isAllCancelled && (
            <div className="border-t border-border bg-primary/10 px-4 py-2.5 text-xs text-primary-text flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Info className="size-4 shrink-0" />
                <span>
                  <strong>Selections are provisional.</strong> You can change subjects freely. When satisfied, click <strong>Finish Registration</strong> to lock your choices and generate your official receipt & PDF.
                </span>
              </div>
              <Button size="sm" onClick={() => setFinalizeConfirmOpen(true)} className="shrink-0 text-xs h-7 px-2.5">
                Finish Now
              </Button>
            </div>
          )}

          {isFinalized && (
            <div className="border-t border-border bg-success/10 px-4 py-2.5 text-xs text-success-text flex items-center gap-2">
              <Check className="size-4 shrink-0 text-success-text" />
              <span>Registration completed. Your elective choices are officially locked and your official receipt is generated below.</span>
            </div>
          )}

          {!isWindowActive && (
            <div className="border-t border-border bg-surface-2 px-4 py-2.5 text-xs text-fg-muted flex items-center gap-2">
              <ShieldAlert className="size-4 text-warning-text shrink-0" />
              <span>The registration window has closed. Choices and cancellations cannot be modified.</span>
            </div>
          )}

          {isWindowActive && !event.allowEditing && !isFinalized && (
            <div className="border-t border-border bg-warning/10 px-4 py-2.5 text-xs text-warning-text flex items-center gap-2">
              <Info className="size-4 shrink-0" />
              <span>Faculty has disabled student modifications for this event.</span>
            </div>
          )}
        </div>

        {/* Cancelled Banner if entire registration was cancelled */}
        {isAllCancelled && (
          <div className="mb-6 rounded-card border border-border bg-surface-2 p-5 text-center print:hidden">
            <div className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-fg-muted/10 text-fg-muted mb-2">
              <XCircle className="size-5" />
            </div>
            <h2 className="text-base font-medium text-fg">Registration Cancelled</h2>
            <p className="mt-1 text-xs text-fg-muted max-w-md mx-auto">
              Your elective registration has been cancelled and any reserved seats were released.
              {isWindowActive && " You may select new electives before the window closes."}
            </p>
            {isWindowActive && (
              <div className="mt-4">
                <Button onClick={() => router.push(`/dashboard/electives?event=${encodeURIComponent(event.id)}`)}>
                  Select Electives
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Selected Electives List */}
        <section aria-label="Selected Electives" className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-fg">Selected Electives</h2>
            <span className="text-xs text-fg-muted">{choices.length} registered groups</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {choices.map((choice) => {
              const isChoiceCancelled = choice.status === "CANCELLED";
              const isChoiceConfirmed = choice.status === "CONFIRMED";

              return (
                <div
                  key={choice.id}
                  className="rounded-card border border-border bg-surface p-5 shadow-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-badge border border-border bg-surface-2 px-2 py-0.5 text-2xs font-medium text-fg-muted">
                        {choice.groupName}
                      </span>
                      {choice.courseCode && (
                        <span className="font-mono text-xs font-semibold text-fg-muted">
                          {choice.courseCode}
                        </span>
                      )}
                      <span className="rounded-badge border border-border px-1.5 py-px text-2xs text-fg-muted">
                        {choice.credits} credits
                      </span>
                      {isChoiceConfirmed && (
                        <Badge tone="success" size="sm" dot>Confirmed</Badge>
                      )}
                      {isChoiceCancelled && (
                        <Badge tone="outline" size="sm">Cancelled</Badge>
                      )}
                    </div>

                    <h3 className="mt-2 text-base font-medium text-fg leading-snug">
                      {choice.electiveName}
                    </h3>

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-fg-muted">
                      {isChoiceConfirmed && (
                        <span className="text-success-text font-medium flex items-center gap-1">
                          <Check className="size-3.5" /> Confirmed Seat Reserved
                        </span>
                      )}
                      {isChoiceCancelled && (
                        <span className="text-fg-muted flex items-center gap-1">
                          <XCircle className="size-3.5" /> Seat Released
                        </span>
                      )}
                      {choice.submittedAt && (
                        <span>
                          Registered: {formatDateTime(choice.submittedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions per elective */}
                  {!isChoiceCancelled && isWindowActive && event.allowEditing && !isFinalized && (
                    <div className="flex items-center gap-2 shrink-0 border-t border-border pt-3 sm:border-t-0 sm:pt-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openChangeModal(choice)}
                      >
                        <ArrowRightLeft className="size-3.5" /> Change
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCancelModalChoice(choice)}
                        className="text-danger-text hover:bg-danger/10"
                      >
                        <XCircle className="size-3.5" /> Cancel
                      </Button>
                    </div>
                  )}

                  {!isChoiceCancelled && isFinalized && (
                    <div className="flex items-center gap-1 shrink-0 text-xs text-fg-muted border-t border-border pt-3 sm:border-t-0 sm:pt-0">
                      <span className="inline-flex items-center gap-1 rounded-badge border border-border bg-surface-2 px-2.5 py-1 text-2xs font-medium text-fg-muted">
                        <Lock className="size-3 text-fg-subtle" /> Choice Locked
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Formal Receipt Section (A4 Compatible / Printable) */}
        {isFinalized && registration.receiptNumber ? (
          <article
            id="receipt"
            aria-label="Registration receipt"
            className="rounded-card border border-border bg-surface shadow-2 overflow-hidden print:rounded-none print:border-0 print:shadow-none"
          >
            <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6 bg-surface-2/40">
              <div>
                <Logo size="sm" />
                <p className="mt-3 text-xs text-fg-muted">Official Registration Receipt</p>
              </div>
              <div className="sm:text-right">
                <div className="flex items-center gap-1 sm:justify-end">
                  <span className="font-mono text-sm font-semibold text-fg">
                    {registration.receiptNumber}
                  </span>
                  <button
                    type="button"
                    onClick={copyReceipt}
                    aria-label="Copy receipt number"
                    className="inline-flex size-7 items-center justify-center rounded-badge text-fg-muted hover:bg-surface-2 hover:text-fg print:hidden"
                  >
                    {copied ? <Check className="size-3.5 text-success-text" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  {submittedAtDate ? formatDateTime(submittedAtDate) : "N/A"}
                </p>
              </div>
            </header>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="flex items-center gap-2 rounded-full border border-border bg-surface-2/50 px-4 py-2.5 text-sm">
                <StatusBadge status={registration.status} size="sm" />
                <span className="font-medium text-fg">Status for {event.name}</span>
              </div>

              <section aria-label="Student Information">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Student Details</h3>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-fg-muted">Full Name</dt>
                    <dd className="mt-0.5 text-sm font-medium text-fg">{student.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-muted">Register Number</dt>
                    <dd className="mt-0.5 font-mono text-sm font-medium text-fg">{student.registerNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-muted">Email</dt>
                    <dd className="mt-0.5 text-sm font-medium text-fg">{student.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-muted">Programme / Degree</dt>
                    <dd className="mt-0.5 text-sm font-medium text-fg">{student.degree || "N/A"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-muted">Department</dt>
                    <dd className="mt-0.5 text-sm font-medium text-fg">{student.department || "N/A"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fg-muted">Section</dt>
                    <dd className="mt-0.5 text-sm font-medium text-fg">{student.section || "N/A"}</dd>
                  </div>
                </dl>
              </section>

              <section aria-label="Elective Course Allotment">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Elective Course Allotment</h3>
                <ul className="divide-y divide-border overflow-hidden rounded-control border border-border">
                  {choices.map((c, i) => (
                    <li key={i} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span className="text-xs text-fg-muted sm:w-1/3">{c.groupName}</span>
                      <span className="text-sm font-medium text-fg sm:flex-1">
                        {c.courseCode ? `${c.courseCode} - ` : ""}{c.electiveName}
                      </span>
                      <span className="text-right sm:w-1/4">
                        <StatusBadge status={c.status} size="sm" />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="hidden justify-between pt-16 print:flex">
                <span className="w-48 border-t border-border-strong pt-2 text-center text-xs text-fg-muted">Student signature</span>
                <span className="w-48 border-t border-border-strong pt-2 text-center text-xs text-fg-muted">Authorised signatory</span>
              </div>
            </div>

            <footer className="border-t border-border bg-surface-2/50 px-5 py-3 text-xs text-fg-muted sm:px-6">
              Computer generated document from Electify portal. Valid without physical signature.
            </footer>
          </article>
        ) : (
          <article
            id="receipt-pending"
            aria-label="Official receipt pending finalization"
            className="rounded-card border border-dashed border-border bg-surface shadow-1 p-6 sm:p-8 text-center print:hidden"
          >
            <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary-text mb-3">
              <Clock className="size-6" />
            </div>
            <h3 className="text-lg font-medium text-fg">Official Electify Receipt & PDF Pending</h3>
            <p className="mt-1 text-xs text-fg-muted max-w-lg mx-auto">
              Your elective seats are currently reserved in provisional status. You can review or change your choices above. Once you are finished, click <strong>Finish Registration</strong> below to permanently lock your choices and generate your official verifiable Electify receipt and downloadable PDF.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => setFinalizeConfirmOpen(true)}
                className="bg-primary text-primary-fg hover:bg-primary/90 font-medium"
              >
                <Check className="size-3.5 mr-1" /> Finish Registration & Generate Receipt
              </Button>
            </div>
            <p className="mt-3 text-2xs text-fg-subtle">
              Note: If not finished manually, your registration will be automatically finalized and locked when the window closes.
            </p>
          </article>
        )}
      </main>

      {/* ── Dialog: Change Elective ── */}
      {changeModalChoice && (
        <Dialog open={true} onOpenChange={() => !changePending && setChangeModalChoice(null)}>
          <DialogContent size="lg">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="inline-flex size-8 items-center justify-center rounded-control bg-primary/10 text-primary-text">
                  <ArrowRightLeft className="size-4" />
                </div>
                <div>
                  <DialogTitle>Change Elective</DialogTitle>
                  <DialogDescription>
                    Group: {changeModalChoice.groupName}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <div className="rounded-control border border-border bg-surface-2/50 p-3 text-xs">
                <span className="text-fg-muted">Current selection: </span>
                <span className="font-medium text-fg">
                  {changeModalChoice.courseCode ? `${changeModalChoice.courseCode} - ` : ""}
                  {changeModalChoice.electiveName}
                </span>
                <span className="ml-2">
                  <StatusBadge status={changeModalChoice.status} size="sm" />
                </span>
              </div>

              <div>
                <p className="text-xs font-medium text-fg-muted mb-2">Available Alternatives in this Group:</p>

                {changeModalChoice.alternatives.length === 0 ? (
                  <p className="text-sm text-fg-muted italic">No alternative electives found in this group.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {changeModalChoice.alternatives.map((alt) => {
                      const isSelected = selectedReplacementId === alt.id;
                      const isFull = alt.availableSeats <= 0;
                      const ringState = seatState(alt.availableSeats, alt.maxSeats);

                      return (
                        <button
                          type="button"
                          key={alt.id}
                          onClick={() => setSelectedReplacementId(alt.id)}
                          disabled={isFull}
                          aria-pressed={isSelected}
                          className={`w-full text-left rounded-control border p-3 transition-colors flex items-center justify-between gap-3 disabled:cursor-not-allowed disabled:opacity-60 ${
                            isSelected
                              ? "border-primary bg-primary/[0.04] ring-1 ring-primary"
                              : "border-border bg-surface hover:border-border-strong"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {alt.courseCode && (
                                <span className="font-mono text-xs font-semibold text-fg-muted">
                                  {alt.courseCode}
                                </span>
                              )}
                              <span className="rounded-badge border border-border px-1.5 py-px text-2xs text-fg-muted">
                                {alt.credits} cr
                              </span>
                              {isFull ? (
                                <Badge tone="neutral" size="sm">Full</Badge>
                              ) : (
                                <Badge tone="success" size="sm">{alt.availableSeats} seats left</Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm font-medium text-fg truncate">{alt.name}</p>
                          </div>

                          <OccupancyRing
                            filled={alt.maxSeats - alt.availableSeats}
                            total={alt.maxSeats}
                            state={ringState}
                            size={32}
                            stroke={3}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Explanations of Consequences */}
              {selectedAlternative && (
                <div className="rounded-control border border-border p-3 space-y-2 bg-surface-2/30">
                  <p className="text-xs font-semibold text-fg">Consequences of confirming this change:</p>

                  {!selectedIsFull ? (
                    <div className="text-xs text-fg-muted space-y-1">
                      <p className="text-success-text font-medium flex items-center gap-1.5">
                        <Check className="size-3.5" />
                        A confirmed seat will be reserved in {selectedAlternative.courseCode || selectedAlternative.name}.
                      </p>
                      <p>
                        Your seat in {changeModalChoice.electiveName} is released only after the new seat is secured, in the same step.
                      </p>
                    </div>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-danger-text">
                      <AlertTriangle className="size-4 shrink-0" />
                      {selectedAlternative.name} is full. Choose another elective; your current seat is kept.
                    </p>
                  )}
                </div>
              )}
            </DialogBody>

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setChangeModalChoice(null)}
                disabled={changePending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmChange}
                disabled={
                  !selectedReplacementId ||
                  selectedIsFull ||
                  changePending
                }
                loading={changePending}
              >
                Confirm Change
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Confirm Dialog: Cancel Individual Elective ── */}
      {cancelModalChoice && (
        <ConfirmDialog
          open={true}
          onOpenChange={() => setCancelModalChoice(null)}
          title={`Cancel Elective: ${cancelModalChoice.courseCode || cancelModalChoice.electiveName}`}
          tone="danger"
          confirmLabel="Cancel Elective"
          cancelLabel="Keep Elective"
          onConfirm={handleConfirmCancelChoice}
          description="Are you sure you want to cancel this elective registration?"
          impact={[
            {
              label: "Elective",
              value: cancelModalChoice.electiveName,
            },
            {
              label: "Seat",
              value: "Released to other students",
              tone: "danger",
            },
          ]}
        >
          <div className="text-xs text-fg-muted space-y-2 pt-2">
            <p>
              Your seat in <span className="font-medium text-fg">{cancelModalChoice.electiveName}</span> is released immediately and any student can take it.
            </p>
          </div>
        </ConfirmDialog>
      )}

      {/* ── Confirm Dialog: Cancel Entire Registration ── */}
      <ConfirmDialog
        open={cancelAllOpen}
        onOpenChange={setCancelAllOpen}
        title="Cancel Entire Registration"
        tone="danger"
        confirmLabel="Cancel Entire Registration"
        cancelLabel="Keep My Registration"
        requireText="CANCEL"
        onConfirm={handleConfirmCancelAll}
        description="This action will cancel your elective registration across all elective groups."
        impact={[
          {
            label: "Registration Status",
            value: "Will be set to CANCELLED",
            tone: "danger",
          },
          {
            label: "Affected Electives",
            value: `${choices.filter((c) => c.status !== "CANCELLED").length} courses`,
            tone: "warning",
          },
        ]}
      >
        <p className="text-xs text-fg-muted">
          All your confirmed seats are released back to the general pool. If the registration window is still open, you may submit a new registration.
        </p>
      </ConfirmDialog>

      {/* ── Confirm Dialog: Finish Registration ── */}
      <ConfirmDialog
        open={finalizeConfirmOpen}
        onOpenChange={setFinalizeConfirmOpen}
        title="Finish and Lock Registration?"
        confirmLabel="Finish & Lock Registration"
        cancelLabel="Keep Editing"
        tone="default"
        onConfirm={handleConfirmFinalize}
        description="Finalizing your registration will permanently lock your elective choices and generate your official Electify receipt with a verifiable number and downloadable PDF proof."
        impact={[
          {
            label: "Registration Status",
            value: "Will be locked permanently",
            tone: "neutral",
          },
          {
            label: "Selected Electives",
            value: `${choices.filter((c) => c.status === "CONFIRMED").length} confirmed courses`,
            tone: "neutral",
          },
          {
            label: "Official Receipt & PDF",
            value: "Will be generated immediately",
            tone: "neutral",
          },
        ]}
      >
        <p className="text-xs text-fg-muted">
          Once finished, your elective choices are locked and cannot be changed or cancelled. If you need to make changes later, you will have to request your class tutor to unlock your registration.
        </p>
      </ConfirmDialog>
    </div>
  );
}
