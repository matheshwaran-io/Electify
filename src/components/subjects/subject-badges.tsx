import { BadgeCheck, CircleDashed, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { Provenance, SubjectContent } from "@/lib/subjects/content-schema";

const PROVENANCE = {
  OFFICIAL: { label: "Official", tone: "success" as const, icon: BadgeCheck },
  PROPOSED: { label: "Proposed guidance", tone: "neutral" as const, icon: PencilLine },
  UNVERIFIED: { label: "Not yet verified", tone: "warning" as const, icon: CircleDashed },
};

/** Says where a section came from, so guidance is never mistaken for an academic requirement. */
export function ProvenanceBadge({ provenance, className }: { provenance: Provenance; className?: string }) {
  const meta = PROVENANCE[provenance.status];
  const Icon = meta.icon;
  return (
    <Badge size="sm" tone={meta.tone} className={className}>
      <Icon aria-hidden /> {meta.label}
    </Badge>
  );
}

/** One line under a section: source and last-verified date when known. */
export function ProvenanceNote({ provenance }: { provenance: Provenance }) {
  const parts = [provenance.source, provenance.verifiedAt ? `verified ${formatDate(provenance.verifiedAt)}` : provenance.status === "OFFICIAL" ? null : "not verified by faculty"];
  const text = parts.filter(Boolean).join(" · ");
  return text ? <p className="mt-3 text-xs text-fg-subtle">Source: {text}</p> : null;
}

const LEVELS = { BEGINNER: 1, MODERATE: 2, ADVANCED: 3 } as const;
const LEVEL_LABEL = { BEGINNER: "Beginner", MODERATE: "Moderate", ADVANCED: "Advanced" } as const;

/** Three-step difficulty pill. Anything not faculty-approved is labelled an estimate. */
export function DifficultyPill({ difficulty, className }: { difficulty: NonNullable<SubjectContent["difficulty"]>; className?: string }) {
  const n = LEVELS[difficulty.level];
  const official = difficulty.provenance.status === "OFFICIAL";
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-medium text-fg-muted", className)}>
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-2.5 w-1.5 rounded-full", i <= n ? "bg-fg" : "bg-border-strong/50")} />
        ))}
      </span>
      <span>
        {LEVEL_LABEL[difficulty.level]}
        {official ? "" : " (estimate)"}
      </span>
    </span>
  );
}
