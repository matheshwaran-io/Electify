"use client";

const statusStyles: Record<string, string> = {
  // Events
  DRAFT:        "bg-fg-subtle/15 text-fg-subtle border-border-strong",
  PUBLISHED:    "bg-primary/15 text-primary-text border-primary/20",
  OPEN:         "bg-success/15 text-success-text border-success/20",
  CLOSED:       "bg-warning/15 text-warning-text border-warning/20",
  VERIFICATION: "bg-primary/15 text-primary-text border-primary/20",
  FINALIZED:    "bg-success/15 text-success-text border-success/20",
  ARCHIVED:     "bg-fg-subtle/15 text-fg-subtle border-border-strong",
  // Invite
  ACTIVE:       "bg-success/15 text-success-text border-success/20",
  USED:         "bg-fg-subtle/15 text-fg-subtle border-border-strong",
  EXPIRED:      "bg-danger/15 text-danger-text border-danger/20",
  REVOKED:      "bg-danger/15 text-danger-text border-danger/20",
  // Roles
  SYSTEM_ADMIN:       "bg-danger/15 text-danger-text border-danger/20",
  COURSE_COORDINATOR: "bg-primary/15 text-primary-text border-primary/20",
  CLASS_TUTOR:        "bg-primary/15 text-primary-text border-primary/20",
  STUDENT:            "bg-fg-subtle/15 text-fg-subtle border-border-strong",
};

const ROLE_DISPLAY: Record<string, string> = {
  SYSTEM_ADMIN: "System Administrator",
  COURSE_COORDINATOR: "Course Coordinator",
  CLASS_TUTOR: "Class Tutor",
  STUDENT: "Student",
};

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? "bg-fg-subtle/15 text-fg-subtle border-border-strong";
  const label = ROLE_DISPLAY[status] ?? status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {label}
    </span>
  );
}
