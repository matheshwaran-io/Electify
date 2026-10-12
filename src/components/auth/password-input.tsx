"use client";

import * as React from "react";
import { Check, Circle, Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { passwordRules } from "@/lib/password-policy";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "trailing"> & {
  /** What the reveal button calls this field, e.g. "password" or "new password". */
  revealLabel?: string;
};

/** Password field with a show/hide toggle. Works with react-hook-form's register(). */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { revealLabel = "password", leading = <Lock />, ...props },
  ref
) {
  const [shown, setShown] = React.useState(false);
  return (
    <Input
      ref={ref}
      type={shown ? "text" : "password"}
      leading={leading}
      spellCheck={false}
      autoCapitalize="none"
      trailing={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? `Hide ${revealLabel}` : `Show ${revealLabel}`}
          aria-pressed={shown}
          className="inline-flex size-9 items-center justify-center rounded-full text-fg-subtle transition-colors hover:text-fg"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
      {...props}
    />
  );
});

/** Live checklist of the password rules, so students see what's missing while they type. */
export function PasswordChecklist({ password, registerNumber, className }: { password: string; registerNumber?: string; className?: string }) {
  const rules = passwordRules(password, { registerNumber });
  return (
    <ul className={cn("grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2", className)} aria-label="Password requirements">
      {rules.map((rule) => {
        const met = password.length > 0 && rule.ok;
        return (
          <li key={rule.id} className={cn("flex items-center gap-1.5 transition-colors", met ? "text-success-text" : "text-fg-subtle")}>
            {met ? <Check className="size-3.5 shrink-0" strokeWidth={3} aria-hidden /> : <Circle className="size-3 shrink-0" aria-hidden />}
            <span>
              {rule.label}
              <span className="sr-only">{met ? " (met)" : " (not met)"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
