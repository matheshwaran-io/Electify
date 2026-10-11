"use client";

import { useState } from "react";
import { Info, Save } from "lucide-react";
import { updateWindowTimers } from "@/app/actions/tutor";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import type { WindowEvent } from "./types";

/**
 * `<input type="datetime-local">` takes local wall-clock time. Slicing an ISO
 * string would show UTC, and saving would then shift the window by the UTC
 * offset every time, so convert to local first.
 */
function toLocalInput(d: Date | string | null) {
  if (!d) return "";
  const date = new Date(d);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  hint,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
          {label}
          {hint ? (
            <Tooltip content={hint}>
              <button type="button" data-inline aria-label={`About ${label}`} className="inline-flex size-5 items-center justify-center rounded-full text-fg-subtle hover:text-fg">
                <Info className="size-3.5" />
              </button>
            </Tooltip>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="mt-0.5" />
    </div>
  );
}

export function ConfigurationCard({ event }: { event: WindowEvent }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [openDate, setOpenDate] = useState(toLocalInput(event.openDate));
  const [closeDate, setCloseDate] = useState(toLocalInput(event.closeDate));

  const [allowEditing, setAllowEditing] = useState(event.allowEditing ?? true);
  const [autoClose, setAutoClose] = useState(event.autoClose ?? true);
  const [enableWaitlist, setEnableWaitlist] = useState(event.enableWaitlist ?? false);

  const invalidRange = Boolean(openDate && closeDate && new Date(closeDate) <= new Date(openDate));

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateWindowTimers(event.id, openDate ? new Date(openDate) : null, closeDate ? new Date(closeDate) : null, {
        allowEditing,
        autoClose,
        enableWaitlist,
      });
      toast.success("Settings saved successfully!");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section aria-label="Window settings" className="col-span-1 flex flex-col rounded-card border border-border bg-surface shadow-1 lg:col-span-4">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <h2 className="text-sm font-medium text-fg">Settings</h2>
        <p className="mt-0.5 text-xs text-fg-muted">Times are in your device&apos;s time zone.</p>
      </div>

      <div className="flex-1 space-y-4 px-4 py-4 sm:px-5">
        <Field label="Portal opens">
          <Input type="datetime-local" value={openDate} onChange={(e) => setOpenDate(e.target.value)} />
        </Field>
        <Field label="Portal closes" error={invalidRange ? "Closing time must be after the opening time." : undefined}>
          <Input type="datetime-local" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
        </Field>

        <div className="divide-y divide-border border-t border-border">
          <ToggleRow label="Allow editing" description="Students can change choices until the window closes." checked={allowEditing} onChange={setAllowEditing} />
          <ToggleRow label="Auto close" description="The portal closes itself at the closing time." checked={autoClose} onChange={setAutoClose} />
          <ToggleRow
            label="Waitlist"
            description="Students can join a waitlist for full electives."
            hint="When enabled, students can join the waitlist if an elective's seats are full."
            checked={enableWaitlist}
            onChange={setEnableWaitlist}
          />
        </div>
      </div>

      <div className="border-t border-border bg-surface-2/50 px-4 py-3 sm:px-5">
        <Button onClick={handleSave} loading={isSaving} loadingText="Saving" disabled={invalidRange} className="w-full">
          <Save /> Save settings
        </Button>
      </div>
    </section>
  );
}
