"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus, Check, Link2, Plus, Search, Trash2 } from "lucide-react";
import {
  addCohortsToSession,
  createAcademicSession,
  linkEventToSession,
  removeCohortFromSession,
  setAcademicSessionStatus,
  setCohortDates,
  setEventClasses,
  updateCohortTerm,
  type CohortCandidate,
  type ReconciliationReport,
  type SessionCohort,
  type SessionOverview,
} from "@/app/actions/academic-sessions";
import { cn } from "@/lib/utils";
import { PageHeader, Section } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Selected = { session: { id: string; label: string; status: string }; cohorts: SessionCohort[]; candidates: CohortCandidate[] };

const STATUS_TONE: Record<string, "success" | "neutral" | "outline"> = { ACTIVE: "success", PLANNED: "neutral", ARCHIVED: "outline" };
const YEAR_OPTIONS = [{ value: "", label: "Not set" }, ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `Year ${n}` }))];
const SEM_OPTIONS = [{ value: "", label: "Not set" }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }))];

function toNum(v: string) {
  return v ? Number(v) : null;
}

/** Runs a server action, toasts the outcome and refreshes the page data. */
function useAction() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = React.useCallback(
    (fn: () => Promise<{ success: boolean; error?: string }>, ok: string, after?: () => void) =>
      startTransition(async () => {
        const res = await fn();
        if (!res.success) {
          toast.error(res.error ?? "That didn't work.");
          return;
        }
        toast.success(ok);
        after?.();
        router.refresh();
      }),
    [router]
  );
  return { run, pending };
}

export function AcademicSessionsClient({
  isAdmin,
  sessions,
  selected,
  selectedError,
  report,
}: {
  isAdmin: boolean;
  sessions: SessionOverview[];
  selected: Selected | null;
  selectedError: string | null;
  report: ReconciliationReport | null;
}) {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Academic sessions"
        description="Academic sessions (e.g. 2026–2027) hold the cohorts that study in them. A cohort keeps its admission year; its study year and semester are set per session."
      />

      <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <SessionList isAdmin={isAdmin} sessions={sessions} selectedId={selected?.session.id ?? null} />
        <div className="min-w-0 space-y-10">
          {selected ? (
            <SessionCohorts isAdmin={isAdmin} selected={selected} />
          ) : (
            <EmptyState
              title={selectedError ?? (sessions.length ? "Pick a session" : "No academic sessions yet")}
              description={isAdmin ? "Create the first academic session to start adding cohorts." : "Ask an administrator to create an academic session."}
              className="rounded-panel bg-surface-2"
            />
          )}
          {report ? <Reconciliation isAdmin={isAdmin} report={report} sessions={sessions} /> : null}
        </div>
      </div>
    </div>
  );
}

function SessionList({ isAdmin, sessions, selectedId }: { isAdmin: boolean; sessions: SessionOverview[]; selectedId: string | null }) {
  const { run, pending } = useAction();
  const [startYear, setStartYear] = React.useState(String(new Date().getFullYear()));
  const [status, setStatus] = React.useState<"ACTIVE" | "PLANNED">("ACTIVE");
  const [archiving, setArchiving] = React.useState<SessionOverview | null>(null);
  const year = Number(startYear);

  return (
    <Section title="Sessions">
      <ul className="space-y-2">
        {[...sessions].reverse().map((s) => (
          <li key={s.id}>
            <div className={cn("rounded-card border bg-surface p-3 shadow-1", s.id === selectedId ? "border-primary/40" : "border-border")}>
              <Link href={`/faculty/academic-sessions?session=${s.id}`} className="flex items-center justify-between gap-2" aria-current={s.id === selectedId ? "page" : undefined}>
                <span className="text-lg font-light tabular-nums text-fg">{s.label}</span>
                <Badge size="sm" tone={STATUS_TONE[s.status] ?? "neutral"}>
                  {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                </Badge>
              </Link>
              <p className="mt-1 text-xs text-fg-muted">
                {s.cohortCount} cohort{s.cohortCount === 1 ? "" : "s"} · {s.eventCount} event{s.eventCount === 1 ? "" : "s"}
                {s.unconfirmedCount ? ` · ${s.unconfirmedCount} to confirm` : ""}
              </p>
              {isAdmin ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.status !== "ACTIVE" ? (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setAcademicSessionStatus(s.id, "ACTIVE"), `${s.label} is active`)}>
                      Activate
                    </Button>
                  ) : null}
                  {s.status !== "ARCHIVED" ? (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => setArchiving(s)}>
                      Archive
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {isAdmin ? (
        <form
          className="space-y-3 rounded-card border border-dashed border-border-strong p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createAcademicSession({ startYear: year, status }), `Academic session ${year}–${year + 1} created`);
          }}
        >
          <p className="text-sm font-medium text-fg">New session</p>
          <Field label="Starts in" description={Number.isInteger(year) && year > 1999 ? `Creates ${year}–${year + 1}` : "Enter a year"}>
            <Input type="number" inputMode="numeric" min={2000} max={2100} value={startYear} onChange={(e) => setStartYear(e.target.value)} />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "ACTIVE" | "PLANNED")}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "PLANNED", label: "Planned" },
              ]}
            />
          </Field>
          <Button type="submit" size="sm" className="w-full" loading={pending}>
            <CalendarPlus /> Create session
          </Button>
        </form>
      ) : null}

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Archive ${archiving?.label ?? ""}?`}
        description="Staff can no longer open this session. Its events, registrations and reports are kept and stay unchanged."
        impact={archiving ? [{ label: "Cohorts", value: archiving.cohortCount }, { label: "Events", value: archiving.eventCount }] : []}
        confirmLabel="Archive session"
        onConfirm={async () => {
          if (!archiving) return;
          const res = await setAcademicSessionStatus(archiving.id, "ARCHIVED");
          if (!res.success) throw new Error(res.error);
          toast.success(`${archiving.label} archived`);
          setArchiving(null);
          window.location.reload();
        }}
      />
    </Section>
  );
}

function SessionCohorts({ isAdmin, selected }: { isAdmin: boolean; selected: Selected }) {
  const { session, cohorts, candidates } = selected;
  const [adding, setAdding] = React.useState(false);
  const [datesFor, setDatesFor] = React.useState<SessionCohort | null>(null);
  const archived = session.status === "ARCHIVED";

  return (
    <Section
      title={`Cohorts in ${session.label}`}
      description="Only cohorts listed here appear in this session's workspace. Their classes, events and students stay separate from every other cohort."
      action={
        !archived ? (
          <Button size="sm" onClick={() => setAdding(true)} disabled={candidates.length === 0}>
            <Plus /> Add cohorts
          </Button>
        ) : null
      }
    >
      {cohorts.length === 0 ? (
        <EmptyState
          compact
          title="No cohorts in this session yet"
          description={candidates.length ? "Add the cohorts that study in this session." : "No cohort's recorded years cover this session."}
          className="rounded-panel bg-surface-2"
        />
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface shadow-1">
          {cohorts.map((c) => (
            <CohortRow key={c.termId} cohort={c} archived={archived} onDates={() => setDatesFor(c)} />
          ))}
        </ul>
      )}
      <AddCohortsDialog open={adding} onOpenChange={setAdding} session={session} candidates={candidates} />
      <CohortDatesDialog cohort={datesFor} onClose={() => setDatesFor(null)} />
      {!isAdmin ? <p className="text-xs text-fg-subtle">You can manage cohorts of your own programme.</p> : null}
    </Section>
  );
}

function CohortRow({ cohort: c, archived, onDates }: { cohort: SessionCohort; archived: boolean; onDates: () => void }) {
  const { run, pending } = useAction();
  const [year, setYear] = React.useState(c.studyYear ? String(c.studyYear) : "");
  const [sem, setSem] = React.useState(c.semester ? String(c.semester) : "");
  const dirty = year !== (c.studyYear ? String(c.studyYear) : "") || sem !== (c.semester ? String(c.semester) : "");

  return (
    <li className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="font-medium text-fg">
          {c.programmeName} · {c.years}
        </p>
        <p className="mt-0.5 text-sm text-fg-muted">
          Classes {c.classes.length ? c.classes.join(", ") : "none"} · {c.studentCount} student{c.studentCount === 1 ? "" : "s"} · {c.eventCount} event
          {c.eventCount === 1 ? "" : "s"}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {!c.datesConfirmed ? (
            <button type="button" onClick={onDates} className="inline-flex">
              <Badge size="sm" tone="warning">
                <AlertTriangle className="size-3" /> Cohort years not confirmed
              </Badge>
            </button>
          ) : (
            <button type="button" onClick={onDates} className="text-xs text-fg-subtle underline-offset-2 hover:text-fg hover:underline">
              Edit cohort years
            </button>
          )}
          {!c.confirmed ? (
            <Badge size="sm" tone="warning">
              Study stage not confirmed
            </Badge>
          ) : null}
        </div>
      </div>
      {!archived ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-32">
            <Select aria-label="Study year" size="sm" value={year} onValueChange={setYear} options={YEAR_OPTIONS} />
          </div>
          <div className="w-36">
            <Select aria-label="Semester" size="sm" value={sem} onValueChange={setSem} options={SEM_OPTIONS} />
          </div>
          <Button
            size="sm"
            variant={dirty || !c.confirmed ? "primary" : "secondary"}
            disabled={pending || (!dirty && c.confirmed)}
            onClick={() => run(() => updateCohortTerm(c.termId, { studyYear: toNum(year), semester: toNum(sem) }), "Study stage saved")}
          >
            <Check /> {c.confirmed && !dirty ? "Confirmed" : "Confirm"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Remove ${c.programmeName} ${c.years} from this session`}
            disabled={pending || c.eventCount > 0}
            onClick={() => run(() => removeCohortFromSession(c.termId), "Cohort removed from the session")}
          >
            <Trash2 />
          </Button>
        </div>
      ) : (
        <p className="text-sm text-fg-muted">{c.stage}</p>
      )}
    </li>
  );
}

function AddCohortsDialog({
  open,
  onOpenChange,
  session,
  candidates,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: Selected["session"];
  candidates: CohortCandidate[];
}) {
  const { run, pending } = useAction();
  const [query, setQuery] = React.useState("");
  const [chosen, setChosen] = React.useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();
  const shown = candidates.filter((c) => !q || `${c.programmeName} ${c.programmeCode} ${c.years}`.toLowerCase().includes(q)).slice(0, 100);
  const picked = candidates.filter((c) => chosen[c.batchId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add cohorts to {session.label}</DialogTitle>
          <DialogDescription>
            These cohorts&apos; recorded years cover this session. The study year shown is a suggestion from the admission year; confirm it against the
            official calendar.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a programme" leading={<Search />} aria-label="Find a programme" />
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-control border border-border">
            {shown.map((c) => (
              <li key={c.batchId}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
                  <Checkbox checked={Boolean(chosen[c.batchId])} onCheckedChange={(v) => setChosen((s) => ({ ...s, [c.batchId]: Boolean(v) }))} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">
                      {c.programmeName} · {c.years}
                    </span>
                    <span className="block text-xs text-fg-muted">
                      {c.classes.length} class{c.classes.length === 1 ? "" : "es"} · {c.studentCount} students
                      {c.suggestedStudyYear ? ` · suggested Year ${c.suggestedStudyYear}` : ""}
                      {!c.datesConfirmed ? " · years not confirmed" : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
            {shown.length === 0 ? <li className="px-3 py-6 text-center text-sm text-fg-muted">No cohorts match</li> : null}
          </ul>
          {candidates.length > shown.length ? <p className="text-xs text-fg-subtle">Showing {shown.length} of {candidates.length}. Search to narrow the list.</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={picked.length === 0}
            loading={pending}
            onClick={() =>
              run(
                () => addCohortsToSession(session.id, picked.map((c) => ({ batchId: c.batchId, studyYear: c.suggestedStudyYear, semester: null }))),
                `${picked.length} cohort${picked.length === 1 ? "" : "s"} added to ${session.label}`,
                () => {
                  setChosen({});
                  onOpenChange(false);
                }
              )
            }
          >
            Add {picked.length || ""} cohort{picked.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CohortDatesDialog({ cohort, onClose }: { cohort: SessionCohort | null; onClose: () => void }) {
  const { run, pending } = useAction();
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  React.useEffect(() => {
    setStart(cohort?.admissionYear ? String(cohort.admissionYear) : "");
    setEnd(cohort?.expectedEndYear ? String(cohort.expectedEndYear) : "");
  }, [cohort]);

  return (
    <Dialog open={cohort !== null} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Cohort years</DialogTitle>
          <DialogDescription>
            {cohort?.programmeName}. The admission year never changes with the academic session. Confirm both years from the official records.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid grid-cols-2 gap-3">
          <Field label="Admission year">
            <Input type="number" inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Expected completion">
            <Input type="number" inputMode="numeric" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              cohort &&
              run(() => setCohortDates(cohort.batchId, { admissionYear: Number(start), expectedEndYear: Number(end) }), "Cohort years confirmed", onClose)
            }
          >
            Confirm years
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Reconciliation({ isAdmin, report, sessions }: { isAdmin: boolean; report: ReconciliationReport; sessions: SessionOverview[] }) {
  const items = [
    { label: "Events not linked to a session", value: report.eventsWithoutSession.length },
    { label: "Events not open to any class", value: report.eventsWithoutClasses.length },
    { label: "Cohorts with unconfirmed years (with students)", value: report.unconfirmedCohortDates },
    { label: "Cohort study stages to confirm", value: report.unconfirmedTerms },
    { label: "Students without a class", value: report.studentsWithoutClass },
    { label: "Student signup codes without a class", value: report.studentCodesWithoutClass },
    ...(isAdmin ? [{ label: "Event targets archived by the migration", value: report.archivedTargets }] : []),
  ];
  const clean = items.every((i) => i.value === 0);

  return (
    <Section
      title="Needs reconciliation"
      description="Records the migration could not map with confidence. Nothing here was guessed: each item waits for an explicit decision."
    >
      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
          <div key={i.label} className={cn("rounded-control border p-3", i.value ? "border-warning/30 bg-warning/5" : "border-border bg-surface")}>
            <dt className="text-xs text-fg-muted">{i.label}</dt>
            <dd className="mt-1 text-xl font-light tabular-nums text-fg">{i.value}</dd>
          </div>
        ))}
      </dl>
      {clean ? <p className="text-sm text-fg-muted">Everything is reconciled.</p> : null}

      {report.eventsWithoutSession.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-fg">Link events to a session</h3>
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {report.eventsWithoutSession.map((e) => (
              <LinkEventRow key={e.id} event={e} sessions={sessions} isAdmin={isAdmin} />
            ))}
          </ul>
        </div>
      ) : null}

      {report.eventsWithoutClasses.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-fg">Choose the classes each event is for</h3>
          <p className="text-xs text-fg-muted">Students only see events that target their class. These events target none, so no student can reach them.</p>
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {report.eventsWithoutClasses.map((e) => (
              <TargetClassesRow key={e.id} event={e} />
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

function LinkEventRow({ event, sessions, isAdmin }: { event: ReconciliationReport["eventsWithoutSession"][number]; sessions: SessionOverview[]; isAdmin: boolean }) {
  const { run, pending } = useAction();
  const [sessionId, setSessionId] = React.useState("");
  return (
    <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{event.name}</p>
        <p className="text-xs text-fg-muted">
          {event.cohort} · label &ldquo;{event.academicYear || "none"}&rdquo; · {event.status}
        </p>
      </div>
      {isAdmin ? (
        <div className="flex gap-2">
          <div className="w-40">
            <Select
              aria-label="Academic session"
              size="sm"
              value={sessionId}
              onValueChange={setSessionId}
              placeholder="Session"
              options={sessions.filter((s) => s.status !== "ARCHIVED").map((s) => ({ value: s.id, label: s.label }))}
            />
          </div>
          <Button size="sm" disabled={!sessionId} loading={pending} onClick={() => run(() => linkEventToSession(event.id, sessionId), "Event linked")}>
            <Link2 /> Link
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function TargetClassesRow({ event }: { event: ReconciliationReport["eventsWithoutClasses"][number] }) {
  const { run, pending } = useAction();
  const [chosen, setChosen] = React.useState<string[]>([]);
  return (
    <li className="space-y-2 p-3">
      <p className="text-sm font-medium text-fg">{event.name}</p>
      <p className="text-xs text-fg-muted">
        {event.cohort}
        {event.sessionLabel ? ` · ${event.sessionLabel}` : ""} · {event.status}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {event.classes.map((c) => (
          <label key={c.id} className="inline-flex items-center gap-1.5 text-sm text-fg">
            <Checkbox
              checked={chosen.includes(c.id)}
              onCheckedChange={(v) => setChosen((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)))}
            />
            Class {c.label}
          </label>
        ))}
        <Button size="sm" disabled={chosen.length === 0} loading={pending} onClick={() => run(() => setEventClasses(event.id, chosen), "Event classes saved")}>
          Save classes
        </Button>
      </div>
    </li>
  );
}
