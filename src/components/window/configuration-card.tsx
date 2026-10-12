"use client";

import { useState, useEffect } from "react";
import { Info, Save, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { updateWindowTimers, toggleWindowStatus } from "@/app/actions/tutor";
import { deleteRegistrationEvent, resetRegistrationEvent } from "@/app/actions/coordinator";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { WindowEvent } from "./types";

/**
 * `<input type="datetime-local">` takes local wall-clock time format (YYYY-MM-DDTHH:mm).
 * Using local calendar getters avoids timezone and DST shift anomalies.
 */
function toLocalInput(d: Date | string | null) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
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
              <button
                type="button"
                data-inline
                aria-label={`About ${label}`}
                className="inline-flex size-5 items-center justify-center rounded-full text-fg-subtle hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Info className="size-3.5" />
              </button>
            </Tooltip>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="mt-0.5 shrink-0" />
    </div>
  );
}

export function ConfigurationCard({ event }: { event: WindowEvent }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [openDate, setOpenDate] = useState(() => toLocalInput(event.openDate));
  const [closeDate, setCloseDate] = useState(() => toLocalInput(event.closeDate));
  const [allowEditing, setAllowEditing] = useState(event.allowEditing ?? true);
  const [autoClose, setAutoClose] = useState(event.autoClose ?? true);

  // Sync state when event props update after a refresh or navigation
  useEffect(() => {
    setOpenDate(toLocalInput(event.openDate));
    setCloseDate(toLocalInput(event.closeDate));
    setAllowEditing(event.allowEditing ?? true);
    setAutoClose(event.autoClose ?? true);
  }, [event.openDate, event.closeDate, event.allowEditing, event.autoClose]);

  const invalidRange = Boolean(openDate && closeDate && new Date(closeDate) <= new Date(openDate));

  async function handleSave() {
    if (invalidRange) {
      toast.error("Closing time must be after the opening time.");
      return;
    }
    setIsSaving(true);
    try {
      await updateWindowTimers(
        event.id,
        openDate ? new Date(openDate) : null,
        closeDate ? new Date(closeDate) : null,
        {
          allowEditing,
          autoClose,
        }
      );
      toast.success("Settings saved successfully!");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusToggle(newStatus: "OPEN" | "PAUSED" | "CLOSED") {
    setIsUpdatingStatus(true);
    try {
      await toggleWindowStatus(event.id, newStatus);
      const actionName =
        newStatus === "OPEN"
          ? "Window resumed / opened"
          : newStatus === "PAUSED"
          ? "Window paused"
          : "Window closed";
      toast.success(`${actionName} successfully!`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  async function handleResetEvent() {
    setIsResetting(true);
    try {
      await resetRegistrationEvent(event.id);
      toast.success(`Reset registrations for "${event.name}". All student choices cleared.`);
      router.refresh();
    } catch (err: any) {
      const msg = err?.message || "Failed to reset event";
      toast.error(msg);
      throw err;
    } finally {
      setIsResetting(false);
    }
  }

  async function handleDeleteEvent() {
    setIsDeleting(true);
    try {
      await deleteRegistrationEvent(event.id);
      toast.success(`Deleted event "${event.name}" successfully.`);
      router.push("/faculty/events");
    } catch (err: any) {
      const msg = err?.message || "Failed to delete event";
      toast.error(msg);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }

  const isBusy = isSaving || isUpdatingStatus || isResetting || isDeleting;

  return (
    <section
      aria-label="Window settings"
      className="col-span-1 flex flex-col rounded-card border border-border bg-surface shadow-1 lg:col-span-4"
    >
      <div className="flex items-center justify-between px-4 pt-4 sm:px-5 sm:pt-5">
        <div>
          <h2 className="text-sm font-medium text-fg">Settings & Controls</h2>
          <p className="mt-0.5 text-xs text-fg-muted">Times are in your device&apos;s time zone.</p>
        </div>
        <Badge
          tone={
            event.status === "OPEN"
              ? "live"
              : event.status === "PAUSED"
              ? "warning"
              : event.status === "CLOSED"
              ? "neutral"
              : "outline"
          }
          dot={event.status === "OPEN"}
          size="sm"
        >
          {event.status}
        </Badge>
      </div>

      <div className="flex-1 space-y-4 px-4 py-4 sm:px-5">
        {event.groupCount === 0 && (
          <div className="rounded-control bg-warning/10 border border-warning/25 p-3 text-xs text-warning-text flex items-start gap-2">
            <Info className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">No elective baskets configured.</span>
              <p className="mt-0.5 text-fg-muted">
                Use an <a href="/faculty/templates" className="text-primary-text underline font-medium">Event Template</a> or visit <a href="/faculty/electives" className="text-primary-text underline font-medium">Electives</a> to populate course baskets before opening the window.
              </p>
            </div>
          </div>
        )}
        <Field label="Portal opens">
          <Input
            type="datetime-local"
            value={openDate}
            onChange={(e) => setOpenDate(e.target.value)}
            disabled={isBusy}
          />
        </Field>
        <Field
          label="Portal closes"
          error={invalidRange ? "Closing time must be after the opening time." : undefined}
        >
          <Input
            type="datetime-local"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
            disabled={isBusy}
          />
        </Field>

        <div className="divide-y divide-border border-t border-border">
          <ToggleRow
            label="Allow editing"
            description="Students can change choices until the window closes."
            checked={allowEditing}
            onChange={setAllowEditing}
          />
          <ToggleRow
            label="Auto close"
            description="The portal closes itself at the closing time."
            checked={autoClose}
            onChange={setAutoClose}
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-border bg-surface-2/50 px-4 py-3 sm:px-5">
        {event.status === "OPEN" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleStatusToggle("PAUSED")}
            loading={isUpdatingStatus}
            disabled={isSaving}
            className="w-full text-warning-text hover:bg-warning/10"
          >
            <Pause /> Pause window
          </Button>
        ) : event.status === "PAUSED" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleStatusToggle("OPEN")}
            loading={isUpdatingStatus}
            disabled={isSaving}
            className="w-full text-success-text hover:bg-success/10"
          >
            <Play /> Resume window
          </Button>
        ) : event.status === "CLOSED" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleStatusToggle("OPEN")}
            loading={isUpdatingStatus}
            disabled={isSaving}
            className="w-full"
          >
            <RotateCcw /> Re-open window
          </Button>
        ) : null}

        <Button
          onClick={handleSave}
          loading={isSaving}
          loadingText="Saving"
          disabled={invalidRange || isUpdatingStatus || isResetting || isDeleting}
          className="w-full"
        >
          <Save /> Save settings
        </Button>

        {/* Danger Zone: Reset Data & Delete Event */}
        <div className="pt-2.5 mt-1 border-t border-border">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle mb-2">
            Event Controls
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="destructive-soft"
              size="sm"
              onClick={() => setResetConfirmOpen(true)}
              disabled={isBusy}
              loading={isResetting}
              className="w-full text-xs"
            >
              <RotateCcw className="size-3.5" /> Reset data
            </Button>
            <Button
              type="button"
              variant="destructive-soft"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={isBusy}
              loading={isDeleting}
              className="w-full text-xs text-danger-text hover:bg-danger/10 hover:border-danger/25"
            >
              <Trash2 className="size-3.5" /> Delete event
            </Button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        tone="danger"
        title="Reset event registrations?"
        description="Every registration for this window will be deleted and seat quotas restored to maximum. Students must select their electives again. This action cannot be reversed."
        impact={[
          { label: "Event", value: event.name },
          { label: "Status", value: event.status },
          { label: "Registrations", value: "All student choices cleared", tone: "danger" },
        ]}
        requireText="RESET"
        confirmLabel="Reset registrations"
        onConfirm={handleResetEvent}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        tone="danger"
        title="Permanently delete this event?"
        description="This will permanently delete this registration event along with all configured elective baskets, subject quotas, student choices, and audit replay history."
        impact={[
          { label: "Event", value: event.name },
          { label: "Status", value: event.status },
          { label: "Allocations & Logs", value: "Permanently purged", tone: "danger" },
        ]}
        requireText="DELETE"
        confirmLabel="Delete event permanently"
        onConfirm={handleDeleteEvent}
      />
    </section>
  );
}
