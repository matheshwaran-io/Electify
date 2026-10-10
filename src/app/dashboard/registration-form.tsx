"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { registerElectives } from "@/app/actions/register";
import { PremiumButton } from "@/components/premium/premium-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, CheckCircle2, ArrowRight } from "lucide-react";

interface Elective {
  id: string;
  groupId: string;
  courseCode: string | null;
  name: string;
  maxSeats: number;
  availableSeats: number;
  isActive: boolean;
  isFull: boolean;
}

interface Group {
  id: string;
  name: string;
  minChoices: number;
  maxChoices: number;
}

interface Student {
  id: string;
  name: string;
  registerNumber: string;
  isEligible: boolean;
  hasSubmitted: boolean;
}

interface Event {
  id: string;
  name: string;
  status: string;
  openDate: Date | null;
  closeDate: Date | null;
}

interface RegistrationFormProps {
  event: Event;
  student: Student;
  groups: Group[];
  electives: Elective[];
  initialRegistrations: { electiveId: string; groupId: string }[];
}

export function RegistrationForm({
  event,
  student,
  groups,
  electives,
  initialRegistrations,
}: RegistrationFormProps) {
  const router = useRouter();

  // Live seat counts state
  const [localElectives, setLocalElectives] = React.useState<Elective[]>(electives);

  // Setup Supabase Realtime subscription
  React.useEffect(() => {
    let channel: any;
    import("@/lib/supabase").then((mod) => {
      channel = mod.supabase
        .channel("table-db-changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "electives",
          },
          (payload) => {
            const newRow = payload.new as any;
            if (newRow && newRow.id) {
              setLocalElectives((prev) =>
                prev.map((e) =>
                  e.id === newRow.id
                    ? {
                        ...e,
                        availableSeats: Number(newRow.available_seats),
                        isFull: Number(newRow.available_seats) <= 0,
                        isActive: newRow.is_active,
                      }
                    : e
                )
              );
            }
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) {
        import("@/lib/supabase").then((mod) => {
          mod.supabase.removeChannel(channel);
        });
      }
    };
  }, []);

  // State: mapping from groupId to an array of selected electiveIds
  const [selections, setSelections] = React.useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const group of groups) {
      initial[group.id] = initialRegistrations
        .filter((r) => r.groupId === group.id)
        .map((r) => r.electiveId);
    }
    return initial;
  });

  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const canSubmit = React.useMemo(() => {
    return groups.every(
      (g) =>
        (selections[g.id]?.length || 0) >= g.minChoices &&
        (selections[g.id]?.length || 0) <= g.maxChoices
    ) && student.isEligible;
  }, [groups, selections, student.isEligible]);

  const handleSelect = React.useCallback((groupId: string, electiveId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    setSelections((prev) => {
      const current = prev[groupId] || [];
      
      // If already selected, deselect it
      if (current.includes(electiveId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== electiveId) };
      }

      // If maxChoices is 1, just replace
      if (group.maxChoices === 1) {
        return { ...prev, [groupId]: [electiveId] };
      }

      // If we haven't reached maxChoices, add it
      if (current.length < group.maxChoices) {
        return { ...prev, [groupId]: [...current, electiveId] };
      }

      // Otherwise do nothing
      return prev;
    });
  }, [groups]);

  const handleRegister = async () => {
    setIsSubmitting(true);
    setIsConfirmOpen(false);

    try {
      const payload = groups.flatMap((g) =>
        (selections[g.id] || []).map((eid) => ({
          groupId: g.id,
          electiveId: eid,
        }))
      );

      const response = await registerElectives(event.id, payload);
      
      if (response.success) {
        toast.success("Registration confirmed successfully.");
        router.push("/dashboard/success");
      } else {
        toast.error(response.error || "Failed to register. Please check seat availability.");
        setIsSubmitting(false);
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };



  return (
    <div className="space-y-12">
      {groups.map((group) => {
        const groupElectives = localElectives.filter((e) => e.groupId === group.id);
        const selectedForGroup = selections[group.id] || [];

        return (
          <div key={group.id} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-medium text-fg">
                  {group.name}
                </h2>
                <p className="text-sm text-fg-muted mt-1">
                  Select {group.minChoices === group.maxChoices ? group.minChoices : `${group.minChoices} to ${group.maxChoices}`} elective{group.maxChoices !== 1 && 's'}.
                </p>
              </div>
              <div className="flex items-center">
                {selectedForGroup.length >= group.minChoices && selectedForGroup.length <= group.maxChoices ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-success-text">
                    <CheckCircle2 className="w-4 h-4" /> Valid Selection
                  </span>
                ) : (
                  <span className="text-xs font-medium text-fg-subtle">
                    Selection Required
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {groupElectives.map((elective) => {
                const isSelected = selectedForGroup.includes(elective.id);
                const isInitiallySelected = initialRegistrations.some(r => r.electiveId === elective.id);
                return (
                  <ElectiveCard
                    key={elective.id}
                    elective={elective}
                    isSelected={isSelected}
                    isInitiallySelected={isInitiallySelected}
                    isEligible={student.isEligible}
                    onSelect={handleSelect}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="sticky bottom-0 z-40 pt-4 sm:pt-6 pb-6 sm:pb-6 pointer-events-none">
        <div className="bg-surface/80 backdrop-blur-xl border-t sm:border border-border sm:rounded-card p-4 sm:p-5 shadow-2 flex flex-col sm:flex-row items-center justify-between gap-4 -mx-4 sm:mx-0 pointer-events-auto transition-all">
          <div className="w-full sm:w-auto text-center sm:text-left">
            <h3 className="font-semibold text-sm text-fg">Ready to submit?</h3>
            <p className="text-xs text-fg-muted font-medium mt-0.5">
              Review your choices before confirming.
            </p>
          </div>
          <PremiumButton
            onClick={() => setIsConfirmOpen(true)}
            disabled={!canSubmit || isSubmitting || !student.isEligible}
            className="w-full sm:w-auto"
          >
            <span className="flex items-center gap-2">
              {isSubmitting ? "Processing..." : student.hasSubmitted ? "Update Selections" : "Confirm Selections"}
              <ArrowRight className="w-4 h-4" />
            </span>
          </PremiumButton>
        </div>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-106.25 p-6 bg-surface border border-border shadow-3 rounded-card">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-medium text-fg">
              Confirm Registration
            </DialogTitle>
            <DialogDescription className="text-sm text-fg-muted pt-2">
              Once submitted you cannot modify your electives.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-6 max-h-[60vh] overflow-y-auto pr-2">
            {groups.map(group => {
              const sel = selections[group.id] || [];
              if (sel.length === 0) return null;
              
              return (
                <div key={group.id} className="border-l-2 border-border pl-3">
                  <p className="text-xs font-medium text-fg-muted mb-2">{group.name}</p>
                  <ul className="space-y-1.5">
                    {sel.map(eid => {
                      const elective = localElectives.find(e => e.id === eid);
                      return (
                        <li key={eid} className="font-medium text-fg text-sm">
                          {elective?.courseCode ? `${elective.courseCode} - ` : ""}{elective?.name}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-3 sm:gap-2 mt-6 border-t border-border pt-4">
            <PremiumButton variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isSubmitting}>
              Cancel
            </PremiumButton>
            <PremiumButton onClick={handleRegister} disabled={isSubmitting} isLoading={isSubmitting}>
              {!isSubmitting && "Confirm"}
            </PremiumButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ElectiveCardProps {
  elective: Elective;
  isSelected: boolean;
  isInitiallySelected: boolean;
  isEligible: boolean;
  onSelect: (groupId: string, electiveId: string) => void;
}

const ElectiveCard = React.memo(function ElectiveCard({
  elective,
  isSelected,
  isInitiallySelected,
  isEligible,
  onSelect,
}: ElectiveCardProps) {
  const isFull = elective.availableSeats <= 0;
  const isDisabled = isFull && !isInitiallySelected;

  return (
    <div
      onClick={() => {
        if (!isDisabled && isEligible) onSelect(elective.groupId, elective.id);
      }}
      className={`relative overflow-hidden cursor-pointer rounded-card p-5 flex flex-col justify-between min-h-35 transition-colors border ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : isDisabled
          ? "opacity-50 bg-surface-2 border-border cursor-not-allowed"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <div className="space-y-3 relative z-10">
        <div className="flex justify-between items-start gap-4">
          <div>
            {elective.courseCode && (
              <p className="text-2xs font-semibold tracking-widest text-fg-muted mb-1">{elective.courseCode}</p>
            )}
            <h3 className={`font-medium text-sm leading-tight ${isSelected ? 'text-fg' : 'text-fg-muted'}`}>
              {elective.name}
            </h3>
          </div>
          {isSelected && (
            <div className="bg-primary text-primary-fg rounded-full p-0.5 shrink-0">
              <Check className="w-3 h-3" strokeWidth={3} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs">
          <span className="text-fg-muted mr-1">Available:</span>
          <span className={`font-medium ${isFull ? 'text-danger-text' : 'text-fg'}`}>
            {elective.availableSeats} / {elective.maxSeats}
          </span>
        </div>
        {isFull && !isInitiallySelected && (
          <span className="text-2xs font-medium text-danger-text bg-danger/10 px-2 py-0.5 rounded-badge">
            Full
          </span>
        )}
      </div>
    </div>
  );
});
