import { Badge, type BadgeTone } from "@/components/ui/badge"

/** Every status string the backend emits, mapped to meaning. */
const STATUS: Record<string, { tone: BadgeTone; label: string; dot?: boolean }> = {
  // Registration events
  DRAFT: { tone: "neutral", label: "Draft" },
  PUBLISHED: { tone: "primary", label: "Published" },
  OPEN: { tone: "live", label: "Open", dot: true },
  ACTIVE: { tone: "success", label: "Active" },
  CLOSED: { tone: "neutral", label: "Closed" },
  VERIFICATION: { tone: "warning", label: "In verification" },
  FINALIZED: { tone: "success", label: "Finalized" },
  ARCHIVED: { tone: "outline", label: "Archived" },
  // Student registrations
  CONFIRMED: { tone: "success", label: "Confirmed" },
  NOT_REGISTERED: { tone: "warning", label: "Pending" },
  RESET_BY_COORDINATOR: { tone: "outline", label: "Reset" },
  CANCELLED: { tone: "outline", label: "Cancelled" },
  // Invite codes
  USED: { tone: "neutral", label: "Used" },
  EXPIRED: { tone: "warning", label: "Expired" },
  REVOKED: { tone: "danger", label: "Revoked" },
  // Roles (identity, not state: neutral on purpose)
  SYSTEM_ADMIN: { tone: "outline", label: "System admin" },
  COURSE_COORDINATOR: { tone: "outline", label: "Course coordinator" },
  CLASS_TUTOR: { tone: "outline", label: "Class tutor" },
  STUDENT: { tone: "outline", label: "Student" },
}

export function statusLabel(status: string) {
  return STATUS[status]?.label ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

export function StatusBadge({ status, size }: { status: string; size?: "sm" | "md" }) {
  const meta = STATUS[status]
  return (
    <Badge tone={meta?.tone ?? "neutral"} size={size} dot={meta?.dot}>
      {statusLabel(status)}
    </Badge>
  )
}
