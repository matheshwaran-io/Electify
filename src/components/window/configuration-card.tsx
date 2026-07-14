"use client";

import { useState } from "react";
import { format } from "date-fns";
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
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-sm col-span-1 lg:col-span-4 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-[var(--foreground)]">Registration Configuration</h3>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 flex-1">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-[var(--muted-foreground)] mb-1 uppercase tracking-wider">Portal Opens</label>
            <input 
              type="datetime-local" 
              value={openDate} 
              onChange={(e) => setOpenDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow text-[var(--foreground)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--muted-foreground)] mb-1 uppercase tracking-wider">Portal Closes</label>
            <input 
              type="datetime-local" 
              value={closeDate} 
              onChange={(e) => setCloseDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow text-[var(--foreground)]"
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] cursor-pointer hover:border-indigo-500/30 transition-colors">
            <span className="text-sm font-medium text-[var(--foreground)]">Allow Editing Before Close</span>
            <input 
              type="checkbox" 
              checked={allowEditing}
              onChange={(e) => setAllowEditing(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] cursor-pointer hover:border-indigo-500/30 transition-colors">
            <span className="text-sm font-medium text-[var(--foreground)]">Auto Close Portal</span>
            <input 
              type="checkbox" 
              checked={autoClose}
              onChange={(e) => setAutoClose(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--background)] cursor-pointer hover:border-indigo-500/30 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">Enable Waitlist</span>
              <div className="group relative">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-gray-900 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                  Waitlist functionality is currently mocked.
                </div>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={enableWaitlist}
              onChange={(e) => setEnableWaitlist(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
