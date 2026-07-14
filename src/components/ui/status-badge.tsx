"use client";

const statusStyles: Record<string, string> = {
  // Events
  DRAFT:        "bg-gray-500/15 text-gray-400 border-gray-500/25",
  PUBLISHED:    "bg-blue-500/15 text-blue-400 border-blue-500/25",
  OPEN:         "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  CLOSED:       "bg-orange-500/15 text-orange-400 border-orange-500/25",
  VERIFICATION: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  FINALIZED:    "bg-teal-500/15 text-teal-400 border-teal-500/25",
  ARCHIVED:     "bg-slate-500/15 text-slate-400 border-slate-500/25",
  // Invite
  ACTIVE:       "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  USED:         "bg-gray-500/15 text-gray-400 border-gray-500/25",
  EXPIRED:      "bg-red-500/15 text-red-400 border-red-500/25",
  REVOKED:      "bg-red-500/15 text-red-400 border-red-500/25",
  // Roles
  SYSTEM_ADMIN:       "bg-red-500/15 text-red-400 border-red-500/25",
  COURSE_COORDINATOR: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  CLASS_TUTOR:        "bg-blue-500/15 text-blue-400 border-blue-500/25",
  STUDENT:            "bg-gray-500/15 text-gray-400 border-gray-500/25",
};

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? "bg-gray-500/15 text-gray-400 border-gray-500/25";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
