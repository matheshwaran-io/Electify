"use client";

import { useState, useEffect } from "react";
import { Users, Check } from "lucide-react";
import { getAllAvailableSections, claimTutorSection } from "@/app/actions/tutor";
import { toast } from "sonner";

type SectionData = { id: string; label: string; batch: string; programme: string };

export function TutorSectionOnboarding({ isManageMode = false }: { isManageMode?: boolean }) {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getAllAvailableSections()
      .then(data => {
        setSections(data);
        setIsLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load sections");
        setIsLoading(false);
      });
  }, []);

  const handleClaim = async () => {
    if (selectedIds.length === 0) return;
    setIsSaving(true);
    try {
      toast.loading("Assigning sections...", { id: "claim" });
      await claimTutorSection(selectedIds);
      toast.success("Successfully assigned!", { id: "claim" });
      window.location.reload(); // Reload to refresh session and server components fully
    } catch (err: any) {
      toast.error(err.message || "Failed to assign sections", { id: "claim" });
      setIsSaving(false);
    }
  };

  const toggleSection = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 5) {
        toast.error("You can only select up to 5 sections.");
        return prev;
      }
      return [...prev, id];
    });
  };

  // Group by programme > batch
  const grouped = sections.reduce((acc, sec) => {
    const key = `${sec.programme} (${sec.batch})`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(sec);
    return acc;
  }, {} as Record<string, SectionData[]>);

  return (
    <div className="space-y-6 flex flex-col items-center justify-center min-h-[60vh] text-center w-full">
      <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4 ring-8 ring-canvas">
        <Users className="w-8 h-8 text-primary-text" />
      </div>
      <h2 className="text-2xl font-bold text-fg">
        {isManageMode ? "Manage Your Sections" : "Welcome to Electify"}
      </h2>
      <p className="text-fg-muted max-w-md">
        {isManageMode 
          ? "Select additional sections you are tutoring. You can manage up to 5 in total." 
          : "You haven't been assigned an active section yet. Please select up to 5 sections you are tutoring below get started."}
      </p>

      <div className="w-full max-w-lg mt-8 bg-surface border border-border rounded-card p-6 shadow-3 text-left">
        {isLoading ? (
          <div className="py-12 text-center text-fg-muted">Loading available sections...</div>
        ) : sections.length === 0 ? (
          <div className="py-12 text-center text-fg-muted">No sections available in the system.</div>
        ) : (
          <div className="space-y-6 max-h-75 overflow-y-auto scrollbar-thin pr-2">
            {Object.entries(grouped).map(([groupName, secs]) => (
              <div key={groupName} className="space-y-3">
                <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider sticky top-0 bg-surface py-1 z-10">{groupName}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {secs.map(sec => {
                    const isSelected = selectedIds.includes(sec.id);
                    return (
                      <button
                        key={sec.id}
                        onClick={() => toggleSection(sec.id)}
                        className={`flex items-center gap-2 p-3 rounded-control border text-sm font-semibold transition-all text-left ${
                          isSelected 
                            ? "bg-primary border-primary text-primary-fg" 
                            : "bg-surface-2/30 border-border text-fg-muted hover:border-primary/30 hover:text-fg"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-border bg-surface/20" : "border-border-strong"}`}>
                          {isSelected && <Check className="w-2.5 h-2.5 text-primary-fg" strokeWidth={3} />}
                        </div>
                        Sec {sec.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={selectedIds.length === 0 || isSaving || isLoading}
          className="w-full mt-6 py-3.5 bg-primary hover:bg-primary-strong disabled:opacity-50 disabled:hover:bg-primary-strong text-primary-fg rounded-control font-bold text-sm transition-all"
        >
          {isSaving ? "Assigning..." : "Assign to me"}
        </button>
      </div>
    </div>
  );
}
