import { cn } from "@/lib/utils";
import { seatLabel, type StudentSeatAvailability } from "@/lib/seats";
import { Meter } from "@/components/ui/data-display";

/**
 * Seats this student could take right now, from the database at render time.
 * Shown as information only: the registration transaction re-checks capacity
 * and is the only thing that can hold a seat.
 */
export function SeatAvailability({
  availability,
  size = "sm",
  className,
}: {
  availability: StudentSeatAvailability;
  size?: "sm" | "md";
  className?: string;
}) {
  const { available, max, state, sectionLimited } = availability;
  const tone = state === "full" ? "danger" : state === "low" ? "warning" : "primary";
  return (
    <div className={cn("min-w-0", className)}>
      <p
        className={cn(
          "font-medium",
          size === "md" ? "text-base" : "text-sm",
          state === "full" ? "text-danger-text" : state === "low" ? "text-warning-text" : "text-fg"
        )}
      >
        {seatLabel(availability)}
      </p>
      <Meter value={max - available} max={max} tone={tone} label={`${max - available} of ${max} seats taken`} className="mt-1.5 h-1" />
      <p className="mt-1 text-xs text-fg-subtle">
        <span className="font-mono tabular-nums">{max - available}</span> of <span className="font-mono tabular-nums">{max}</span> taken
        {sectionLimited ? " · your class quota" : ""}
      </p>
    </div>
  );
}
