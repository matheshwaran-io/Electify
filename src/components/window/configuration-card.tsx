"use client";

import { useState } from "react";
import { Save, Loader2, AlertCircle } from "lucide-react";
import { updateWindowTimers } from "@/app/actions/tutor";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ConfigurationCard({ event }: { event: any }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [openDate, setOpenDate] = useState(event.openDate ? new Date(event.openDate).toISOString().slice(0, 16) : "");
  const [closeDate, setCloseDate] = useState(event.closeDate ? new Date(event.closeDate).toISOString().slice(0, 16) : "");

  // Mock states for UI only as per plan
  const [allowEditing, setAllowEditing] = useState(false);
  const [autoClose, setAutoClose] = useState(true);
  const [enableWaitlist, setEnableWaitlist] = useState(false);
  
  async function handleSave() {
    setIsSaving(true);
    try {
      await updateWindowTimers(
        event.id, 
        openDate ? new Date(openDate) : null,
        closeDate ? new Date(closeDate) : null
      );
      toast.success("Settings saved successfully!");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-panel p-6 shadow-1 col-span-1 lg:col-span-4 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-fg">Registration Configuration</h3>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary text-primary-fg px-4 py-2 rounded-control text-sm font-medium hover:bg-primary-strong transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 flex-1">
        <div className="space-y-4">
          <div>
            <label className="block text-2xs font-bold text-fg-muted mb-1 uppercase tracking-wider">Portal Opens</label>
            <input 
              type="datetime-local" 
              value={openDate} 
              onChange={(e) => setOpenDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface border border-border-strong rounded-control text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow text-fg"
            />
          </div>
          <div>
            <label className="block text-2xs font-bold text-fg-muted mb-1 uppercase tracking-wider">Portal Closes</label>
            <input 
              type="datetime-local" 
              value={closeDate} 
              onChange={(e) => setCloseDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface border border-border-strong rounded-control text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow text-fg"
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between p-3 rounded-control border border-border bg-surface-2 cursor-pointer hover:border-primary/30 transition-colors">
            <span className="text-sm font-medium text-fg">Allow Editing Before Close</span>
            <input 
              type="checkbox" 
              checked={allowEditing}
              onChange={(e) => setAllowEditing(e.target.checked)}
              className="w-4 h-4 text-primary-text rounded-badge border-border-strong focus-visible:ring-ring"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-control border border-border bg-surface-2 cursor-pointer hover:border-primary/30 transition-colors">
            <span className="text-sm font-medium text-fg">Auto Close Portal</span>
            <input 
              type="checkbox" 
              checked={autoClose}
              onChange={(e) => setAutoClose(e.target.checked)}
              className="w-4 h-4 text-primary-text rounded-badge border-border-strong focus-visible:ring-ring"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-control border border-border bg-surface-2 cursor-pointer hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-fg">Enable Waitlist</span>
              <div className="group relative">
                <AlertCircle className="w-3.5 h-3.5 text-warning-text" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-fg text-canvas text-2xs p-2 rounded-control opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                  Waitlist functionality is currently mocked.
                </div>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={enableWaitlist}
              onChange={(e) => setEnableWaitlist(e.target.checked)}
              className="w-4 h-4 text-primary-text rounded-badge border-border-strong focus-visible:ring-ring"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
