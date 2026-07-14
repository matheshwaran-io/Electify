"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, Archive, Loader2, Database, Users, BookOpen } from "lucide-react";
import { resetSectionRegistrationEvent } from "@/app/actions/tutor";
import { deleteAllRegistrations, deleteAllStudents, deleteAllSubjects, resetAllSeats, archiveEvent } from "@/app/actions/database";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DatabaseClient({ events, role }: { events: any[], role: string }) {
  const router = useRouter();
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const isAdminOrCoord = role === "SYSTEM_ADMIN" || role === "COURSE_COORDINATOR";

  const event = events[0];

  async function handleAction(actionKey: string, actionFn: () => Promise<void>, requiresEvent: boolean = true) {
    if (requiresEvent && !event) {
      toast.error("No active registration event found.");
      return;
    }
    if (resetConfirmText !== "CONFIRM") {
      toast.error("Please type CONFIRM to proceed.");
      return;
    }
    
    setIsProcessing(true);
    try {
      await actionFn();
      toast.success(`Action successful.`);
      setResetConfirmText("");
      setActiveAction(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Operation failed.");
    } finally {
      setIsProcessing(false);
    }
  }

  function renderActionCard({
    key, title, desc, icon: Icon, colorClass, actionFn, requiresEvent = true, hidden = false
  }: {
    key: string, title: string, desc: string, icon: any, colorClass: string, actionFn: () => Promise<void>, requiresEvent?: boolean, hidden?: boolean
  }) {
    if (hidden) return null;
    
    const isActive = activeAction === key;

    return (
      <div className={`bg-[var(--card)] border ${isActive ? colorClass : 'border-[var(--border)]'} rounded-xl p-4 flex flex-col justify-between transition-colors`}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`w-4 h-4 ${isActive ? colorClass.replace('border-', 'text-') : 'text-[var(--muted-foreground)]'}`} />
            <h4 className="font-bold text-sm text-[var(--foreground)]">{title}</h4>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">{desc}</p>
        </div>
        
        {!isActive ? (
          <button 
            onClick={() => setActiveAction(key)}
            className={`w-full border border-[var(--border)] text-[var(--muted-foreground)] hover:${colorClass.replace('border-', 'text-')} px-4 py-2 rounded-lg text-xs font-bold transition-colors`}
          >
            Select Action
          </button>
        ) : (
          <div className="space-y-2">
            <input
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="Type CONFIRM"
              className="w-full px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs outline-none focus:ring-1 focus:ring-red-500"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => handleAction(key, actionFn, requiresEvent)}
                disabled={isProcessing}
                className="flex-1 bg-red-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Execute"}
              </button>
              <button 
                onClick={() => { setActiveAction(null); setResetConfirmText(""); }}
                disabled={isProcessing}
                className="flex-1 bg-[var(--muted)] text-[var(--foreground)] px-4 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">Database Management</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Perform destructive actions and data resets.</p>
      </div>

      <div className="border-2 border-red-500/20 bg-red-500/5 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-red-500">Danger Zone</h3>
            <p className="text-xs text-[var(--muted-foreground)]">These actions are permanent and cannot be undone.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Section Level Actions (Available to Tutors too) */}
          {renderActionCard({
            key: "reset_section",
            title: "Reset Section Data",
            desc: "Clears all registrations for your assigned section for the current event.",
            icon: Users,
            colorClass: "border-orange-500",
            actionFn: async () => await resetSectionRegistrationEvent(event.id)
          })}
          
          {renderActionCard({
            key: "archive_event",
            title: "Archive Event",
            desc: "Mark the event as finalized and read-only. Available to all admins.",
            icon: Archive,
            colorClass: "border-amber-500",
            actionFn: async () => await archiveEvent(event.id)
          })}

          {/* Admin Level Actions */}
          {renderActionCard({
            key: "delete_registrations",
            title: "Delete All Registrations",
            desc: "Hard deletes all registrations and resets seats across all sections.",
            icon: Trash2,
            colorClass: "border-red-500",
            actionFn: async () => await deleteAllRegistrations(event.id),
            hidden: !isAdminOrCoord
          })}

          {renderActionCard({
            key: "reset_seats",
            title: "Reset All Seats",
            desc: "Drops all registrations and resets subject seat limits to maximum.",
            icon: Database,
            colorClass: "border-red-500",
            actionFn: async () => await resetAllSeats(event.id),
            hidden: !isAdminOrCoord
          })}

          {renderActionCard({
            key: "delete_students",
            title: "Delete All Students",
            desc: "Hard deletes all student accounts. Will cascade to registrations.",
            icon: Users,
            colorClass: "border-red-500",
            actionFn: async () => await deleteAllStudents(),
            requiresEvent: false,
            hidden: !isAdminOrCoord
          })}

          {renderActionCard({
            key: "delete_subjects",
            title: "Delete All Subjects",
            desc: "Hard deletes all electives assigned to this event.",
            icon: BookOpen,
            colorClass: "border-red-500",
            actionFn: async () => await deleteAllSubjects(event.id),
            hidden: !isAdminOrCoord
          })}
          
        </div>
      </div>
    </div>
  );
}
