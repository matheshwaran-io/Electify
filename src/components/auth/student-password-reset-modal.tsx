"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, ArrowRight, CheckCircle2, GraduationCap, KeyRound, ShieldCheck } from "lucide-react";
import { requestStudentPasswordReset, completeStudentPasswordReset } from "@/app/actions/auth";
import { normalizeRegisterNumber, passwordProblem, REGISTER_NUMBER_PATTERN } from "@/lib/password-policy";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PasswordChecklist, PasswordInput } from "./password-input";

const registerNumberField = z
  .string()
  .min(1, "Register number is required")
  .refine((v) => REGISTER_NUMBER_PATTERN.test(normalizeRegisterNumber(v)), "Enter a valid register number, e.g. RA2532241010001");

const completeSchema = z
  .object({
    registerNumber: registerNumberField,
    resetToken: z.string().trim().min(4, "Authorization code is required"),
    newPassword: z.string().min(1, "Choose a new password"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .superRefine((data, ctx) => {
    const problem = passwordProblem(data.newPassword, { registerNumber: data.registerNumber });
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["newPassword"] });
    else if (data.newPassword !== data.confirmPassword) ctx.addIssue({ code: "custom", message: "Passwords do not match", path: ["confirmPassword"] });
  });

type CompleteFormData = z.infer<typeof completeSchema>;

/** Tutor-authorized password reset: request a code, then use it to set a new password. */
export function StudentPasswordResetModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = React.useState<"request" | "complete">("request");
  const [requestRegisterNumber, setRequestRegisterNumber] = React.useState("");
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [requestSuccessMessage, setRequestSuccessMessage] = React.useState<string | null>(null);
  const [requestError, setRequestError] = React.useState<string | null>(null);

  const [isCompleting, setIsCompleting] = React.useState(false);
  const [completeError, setCompleteError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset: resetCompleteForm,
    formState: { errors: completeErrors },
  } = useForm<CompleteFormData>({
    resolver: zodResolver(completeSchema),
    defaultValues: { registerNumber: "", resetToken: "", newPassword: "", confirmPassword: "" },
  });
  const newPassword = watch("newPassword");
  const completeRegisterNumber = watch("registerNumber");

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const registerNumber = normalizeRegisterNumber(requestRegisterNumber);
    if (!REGISTER_NUMBER_PATTERN.test(registerNumber)) {
      setRequestError("Enter your register number, e.g. RA2532241010001.");
      return;
    }

    setIsRequesting(true);
    setRequestError(null);
    setRequestSuccessMessage(null);

    try {
      const res = await requestStudentPasswordReset(registerNumber);
      if (res.success) {
        setRequestSuccessMessage(res.message);
        setValue("registerNumber", registerNumber);
      } else {
        setRequestError(res.message || "Could not submit reset request.");
      }
    } catch {
      setRequestError("Server connection error. Please try again.");
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCompleteSubmit = async (data: CompleteFormData) => {
    setIsCompleting(true);
    setCompleteError(null);

    try {
      const res = await completeStudentPasswordReset({
        registerNumber: normalizeRegisterNumber(data.registerNumber),
        resetToken: data.resetToken.trim().toUpperCase(),
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });

      if (res.success) {
        toast.success(res.message || "Password updated. You can now sign in.");
        onOpenChange(false);
        resetCompleteForm();
      } else {
        setCompleteError(res.error || "Failed to reset your password.");
      }
    } catch {
      setCompleteError("Server connection error. Please try again.");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-control bg-brand/10 text-brand">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <DialogTitle>Reset your password</DialogTitle>
              <DialogDescription>Your class tutor confirms it&apos;s you before you can choose a new password.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5 pt-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "request" | "complete")} className="w-full">
            <TabsList variant="pill" className="grid w-full grid-cols-2">
              <TabsTrigger value="request">1. Ask your tutor</TabsTrigger>
              <TabsTrigger value="complete">2. Set new password</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "request" ? (
            <form onSubmit={handleRequestSubmit} className="space-y-4" noValidate>
              <p className="text-sm text-fg-muted">
                Send a reset request to your class tutor. They&apos;ll check it&apos;s you and give you an authorization code.
              </p>

              {requestError && (
                <div role="alert" className="flex items-start gap-2 rounded-control border border-danger/25 bg-danger/8 p-3 text-sm text-danger-text">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{requestError}</span>
                </div>
              )}

              {requestSuccessMessage ? (
                <div role="status" className="space-y-3 rounded-control border border-brand/20 bg-brand/5 p-4 text-sm text-fg">
                  <div className="flex items-center gap-2 font-semibold text-brand">
                    <CheckCircle2 className="size-4" /> Request sent
                  </div>
                  <p className="text-xs leading-relaxed text-fg-muted">{requestSuccessMessage}</p>
                  <Button type="button" variant="brand" size="sm" className="mt-2 w-full" onClick={() => setTab("complete")}>
                    I have my authorization code <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <Field label="Register number">
                    <Input
                      type="text"
                      value={requestRegisterNumber}
                      onChange={(e) => setRequestRegisterNumber(e.target.value)}
                      placeholder="e.g. RA2532241010001"
                      autoComplete="username"
                      autoCapitalize="characters"
                      spellCheck={false}
                      className="font-mono tracking-wide"
                      leading={<GraduationCap />}
                      disabled={isRequesting}
                      inputSize="lg"
                    />
                  </Field>

                  <Button type="submit" variant="brand" size="lg" className="w-full" loading={isRequesting} loadingText="Sending request">
                    Notify class tutor
                  </Button>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleSubmit(handleCompleteSubmit)} className="space-y-4" noValidate>
              <p className="text-sm text-fg-muted">Enter your register number, the code from your tutor, and a new password.</p>

              {completeError && (
                <div role="alert" className="flex items-start gap-2 rounded-control border border-danger/25 bg-danger/8 p-3 text-sm text-danger-text">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{completeError}</span>
                </div>
              )}

              <Field label="Register number" error={completeErrors.registerNumber?.message}>
                <Input
                  type="text"
                  placeholder="e.g. RA2532241010001"
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="font-mono tracking-wide uppercase"
                  leading={<GraduationCap />}
                  disabled={isCompleting}
                  inputSize="lg"
                  {...register("registerNumber")}
                />
              </Field>

              <Field label="Tutor authorization code" error={completeErrors.resetToken?.message}>
                <Input
                  type="text"
                  placeholder="e.g. RST-7X9K2M"
                  autoComplete="one-time-code"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="font-mono uppercase tracking-widest"
                  leading={<KeyRound />}
                  disabled={isCompleting}
                  inputSize="lg"
                  {...register("resetToken")}
                />
              </Field>

              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="New password" error={completeErrors.newPassword?.message}>
                    <PasswordInput autoComplete="new-password" revealLabel="new password" disabled={isCompleting} inputSize="lg" {...register("newPassword")} />
                  </Field>
                  <Field label="Confirm new password" error={completeErrors.confirmPassword?.message}>
                    <PasswordInput autoComplete="new-password" revealLabel="confirmation" disabled={isCompleting} inputSize="lg" {...register("confirmPassword")} />
                  </Field>
                </div>
                <PasswordChecklist password={newPassword} registerNumber={completeRegisterNumber} />
              </div>

              <Button type="submit" variant="brand" size="lg" className="mt-2 w-full" loading={isCompleting} loadingText="Updating password">
                Update password
              </Button>
            </form>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
