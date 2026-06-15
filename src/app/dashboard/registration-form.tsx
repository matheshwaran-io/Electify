"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { registerElectives } from "@/app/actions/register";
import { PremiumButton } from "@/components/premium/premium-button";
import { OccupancyRing } from "@/components/premium/occupancy-ring";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, CheckCircle2, AlertTriangle, ArrowRight, Loader2, BookOpen, Sparkles } from "lucide-react";
import { Component as Loader } from "@/components/ui/loader-2";

interface Elective {
  id: string;
  groupNumber: number;
  name: string;
  totalSeats: number;
  availableSeats: number;
  isActive: boolean;
  isFull: boolean;
}

interface Student {
  id: string;
  name: string;
  registerNumber: string;
  isEligible: boolean;
  hasSubmitted: boolean;
}

interface Settings {
  showLiveSeats: boolean;
  allowRegistrationEdit: boolean;
}

interface RegistrationFormProps {
  student: Student;
  electives: Elective[];
  settings: Settings;
  initialRegistration?: {
    electiveGroup1Id: string;
    electiveGroup2Id: string;
  } | null;
}

export function RegistrationForm({
  student,
  electives,
  settings,
  initialRegistration,
}: RegistrationFormProps) {
  const router = useRouter();

  // Selected elective IDs
  const [selectedG1, setSelectedG1] = React.useState<string>(
    initialRegistration?.electiveGroup1Id || ""
  );
  const [selectedG2, setSelectedG2] = React.useState<string>(
    initialRegistration?.electiveGroup2Id || ""
  );

  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Group electives
  const g1Electives = React.useMemo(() => electives.filter((e) => e.groupNumber === 1), [electives]);
  const g2Electives = React.useMemo(() => electives.filter((e) => e.groupNumber === 2), [electives]);

  // Selected elective objects
  const selectedG1Object = React.useMemo(() => electives.find((e) => e.id === selectedG1), [electives, selectedG1]);
  const selectedG2Object = React.useMemo(() => electives.find((e) => e.id === selectedG2), [electives, selectedG2]);

  const canSubmit = selectedG1 !== "" && selectedG2 !== "" && student.isEligible;

  const handleRegister = async () => {
    setIsSubmitting(true);
    setIsConfirmOpen(false);

    try {
      const response = await registerElectives(selectedG1, selectedG2);
      if (response.success) {
        toast.success("Electives registered successfully!");
        router.push("/dashboard/success");
        router.refresh();
      } else {
        toast.error(response.error || "Failed to register. Please check seat availability.");
        setIsSubmitting(false);
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  const renderElectiveCard = (elective: Elective, isSelected: boolean, onSelect: () => void) => {
    const isFull = elective.availableSeats <= 0;
    const isInitiallySelected =
      initialRegistration?.electiveGroup1Id === elective.id ||
      initialRegistration?.electiveGroup2Id === elective.id;

    const isDisabled = isFull && !isInitiallySelected;
    const takenSeats = elective.totalSeats - elective.availableSeats;
    const occupancyPercentage = (takenSeats / elective.totalSeats) * 100;

    return (
      <motion.div
        key={elective.id}
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        whileTap={!isDisabled && student.isEligible ? { scale: 0.985 } : undefined}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        onClick={() => {
          if (!isDisabled && student.isEligible) onSelect();
        }}
        className={`relative overflow-hidden cursor-pointer rounded-cards border-2 p-4 sm:p-6 flex flex-col justify-between min-h-[160px] sm:min-h-[200px] transition-all duration-300 ${
          isSelected
            ? "border-indigo-600 dark:border-indigo-500 bg-gradient-to-b from-indigo-50/50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-indigo-950/40 shadow-lg shadow-indigo-500/10 dark:shadow-indigo-500/5 ring-1 ring-indigo-500/25"
            : isDisabled
            ? "opacity-50 bg-slate-100/50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-900 cursor-not-allowed"
            : "border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md active:scale-[0.98]"
        }`}
      >
        {/* Glow behind selected card */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 blur-xl pointer-events-none"
            />
          )}
        </AnimatePresence>

        <div className="space-y-3 relative z-10">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-buttons ${isSelected ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                COURSE
              </span>
            </div>
            {isSelected && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider bg-indigo-600 dark:bg-indigo-500 text-white px-2.5 py-0.5 rounded-full shadow-md shadow-indigo-500/20"
              >
                <Check className="w-3 h-3" /> Selected
              </motion.span>
            )}
            {isDisabled && (
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-rose-500 dark:bg-rose-600 text-white px-2.5 py-0.5 rounded-full shadow-md shadow-rose-500/20">
                Full
              </span>
            )}
          </div>

          <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg leading-snug line-clamp-2">
            {elective.name}
          </h3>
        </div>

        {/* Dynamic occupancy layout */}
        <div className="flex justify-between items-end relative z-10 border-t border-slate-200/50 dark:border-slate-800/50 pt-4 mt-2">
          {settings.showLiveSeats ? (
            <div className="space-y-1.5 flex-1 pr-4">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider">Seats Taken</span>
                <span className={isFull ? "text-rose-500" : "text-slate-700 dark:text-slate-300"}>
                  {takenSeats} / {elective.totalSeats}
                </span>
              </div>
              {/* Dynamic progress track */}
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${occupancyPercentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full bg-gradient-to-r ${
                    isFull
                      ? "from-rose-500 to-rose-600"
                      : occupancyPercentage >= 75
                      ? "from-amber-500 to-amber-600"
                      : "from-indigo-500 to-cyan-500"
                  }`}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <span className="text-xs font-semibold text-slate-400">Availability Status</span>
              <span className={`block font-bold mt-0.5 ${isFull ? "text-rose-500" : "text-emerald-500"}`}>
                {isFull ? "Registration Closed" : "Open for Registration"}
              </span>
            </div>
          )}

          {settings.showLiveSeats && (
            <div className="shrink-0">
              <OccupancyRing value={occupancyPercentage} size={42} strokeWidth={4} />
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-10">
      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md">
          <Loader />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400 mt-4 animate-pulse">
            Securing your seats. Please wait...
          </p>
        </div>
      )}

      {!student.isEligible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4 bg-rose-500/10 border border-rose-500/20 p-5 rounded-cards text-rose-800 dark:text-rose-400 shadow-lg"
        >
          <div className="p-2 bg-rose-500/15 border border-rose-500/30 rounded-buttons text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 dark:text-white">Registration Blocked</h4>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Your account is marked as not eligible for registration. Please clear pending requirements or contact the MCA elective coordinator to restore eligibility.
            </p>
          </div>
        </motion.div>
      )}

      {/* Group 1 Electives */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Elective Group 1
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 uppercase tracking-widest">
              Required
            </span>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Choose One Course</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {g1Electives.map((e) =>
            renderElectiveCard(e, selectedG1 === e.id, () => setSelectedG1(e.id))
          )}
        </div>
      </div>

      {/* Group 2 Electives */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Elective Group 2
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 uppercase tracking-widest">
              Required
            </span>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Choose One Course</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {g2Electives.map((e) =>
            renderElectiveCard(e, selectedG2 === e.id, () => setSelectedG2(e.id))
          )}
        </div>
      </div>

      {/* Submit Section */}
      <div className="flex flex-col gap-4 pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-start sm:items-center gap-2 text-slate-500 text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse shrink-0 mt-0.5 sm:mt-0" />
          <span>Double check your selections. You cannot change them after submission.</span>
        </div>
        <PremiumButton
          size="lg"
          variant={canSubmit ? "primary" : "secondary"}
          disabled={!canSubmit || isSubmitting}
          className="w-full sm:w-auto sm:self-end min-h-[52px] px-8 flex items-center justify-center gap-2 shadow-lg"
          onClick={() => setIsConfirmOpen(true)}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Submitting Choices...
            </>
          ) : (
            <>
              Verify and Register <ArrowRight className="w-4 h-4" />
            </>
          )}
        </PremiumButton>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[450px] rounded-cards p-6 border border-white/10 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md shadow-2xl">
          <DialogHeader className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 border border-indigo-500/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Confirm Electives</DialogTitle>
            <DialogDescription className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Please confirm your final choices. Once submitted, your registration is locked and editing is disabled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 border border-indigo-500/15 bg-indigo-500/5 rounded-cards">
              <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Group 1 Elective</span>
              <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mt-1">{selectedG1Object?.name}</p>
            </div>
            <div className="p-4 border border-indigo-500/15 bg-indigo-500/5 rounded-cards">
              <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Group 2 Elective</span>
              <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mt-1">{selectedG2Object?.name}</p>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-3">
            <PremiumButton
              variant="primary"
              className="w-full justify-center shadow-lg shadow-indigo-500/20 min-h-[48px]"
              onClick={handleRegister}
            >
              Submit Choices
            </PremiumButton>
            <PremiumButton
              variant="outline"
              className="w-full justify-center min-h-[48px]"
              onClick={() => setIsConfirmOpen(false)}
            >
              Cancel
            </PremiumButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
