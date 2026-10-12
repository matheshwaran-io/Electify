"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { requestStudentPinReset, completeStudentPinReset } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const completeSchema = z
  .object({
    registerNumber: z.string().min(1, "Register number is required"),
    resetToken: z.string().min(4, "Authorization code is required"),
    newPin: z.string().regex(/^\d{6}$/, "New PIN must be exactly 6 digits"),
    confirmPin: z.string().min(1, "Please confirm your new PIN"),
  })
  .refine((data) => data.newPin === data.confirmPin, {
    message: "PINs do not match",
    path: ["confirmPin"],
  });

type CompleteFormData = z.infer<typeof completeSchema>;

export function StudentPinResetModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = React.useState<"request" | "complete">("request");
  const [requestIdentifier, setRequestIdentifier] = React.useState("");
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [requestSuccessMessage, setRequestSuccessMessage] = React.useState<string | null>(null);
  const [requestError, setRequestError] = React.useState<string | null>(null);

  const [isCompleting, setIsCompleting] = React.useState(false);
  const [completeError, setCompleteError] = React.useState<string | null>(null);
  const [shownPin, setShownPin] = React.useState(false);
  const [shownConfirm, setShownConfirm] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset: resetCompleteForm,
    formState: { errors: completeErrors },
  } = useForm<CompleteFormData>({
    resolver: zodResolver(completeSchema),
  });

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestIdentifier.trim()) {
      setRequestError("Please enter your SRM email or register number.");
      return;
    }

    setIsRequesting(true);
    setRequestError(null);
    setRequestSuccessMessage(null);

    try {
      const res = await requestStudentPinReset(requestIdentifier.trim());
      if (res.success) {
        setRequestSuccessMessage(res.message);
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
      const res = await completeStudentPinReset({
        registerNumber: data.registerNumber.trim().toUpperCase(),
        resetToken: data.resetToken.trim().toUpperCase(),
        newPin: data.newPin.trim(),
        confirmPin: data.confirmPin.trim(),
      });

      if (res.success) {
        toast.success(res.message || "PIN updated successfully! You can now sign in.");
        onOpenChange(false);
        resetCompleteForm();
      } else {
        setCompleteError(res.error || "Failed to complete PIN reset.");
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
              <DialogTitle>Reset your 6-digit PIN</DialogTitle>
              <DialogDescription>
                University security policy requires class tutor authorization to reset student credentials.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5 pt-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList variant="pill" className="grid w-full grid-cols-2">
              <TabsTrigger value="request">1. Request authorization</TabsTrigger>
              <TabsTrigger value="complete">2. Enter code & new PIN</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "request" ? (
            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <p className="text-sm text-fg-muted">
                Submit a reset request to your assigned class tutor. Your tutor will verify your identity and give you an authorization code.
              </p>

              {requestError && (
                <div role="alert" className="flex items-start gap-2 rounded-control border border-danger/25 bg-danger/8 p-3 text-sm text-danger-text">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{requestError}</span>
                </div>
              )}

              {requestSuccessMessage ? (
                <div className="space-y-3 rounded-control border border-brand/20 bg-brand/5 p-4 text-sm text-fg">
                  <div className="flex items-center gap-2 text-brand font-semibold">
                    <CheckCircle2 className="size-4" /> Request Submitted
                  </div>
                  <p className="text-fg-muted text-xs leading-relaxed">{requestSuccessMessage}</p>
                  <Button
                    type="button"
                    variant="brand"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setTab("complete")}
                  >
                    I have my authorization code <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <Field label="SRM email or register number">
                    <Input
                      type="text"
                      value={requestIdentifier}
                      onChange={(e) => setRequestIdentifier(e.target.value)}
                      placeholder="e.g. RA2532241010001 or jd1234@srmist.edu.in"
                      leading={<Mail />}
                      disabled={isRequesting}
                      inputSize="lg"
                    />
                  </Field>

                  <Button
                    type="submit"
                    variant="brand"
                    size="lg"
                    className="w-full"
                    loading={isRequesting}
                    loadingText="Sending request..."
                  >
                    Notify class tutor
                  </Button>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleSubmit(handleCompleteSubmit)} className="space-y-4">
              <p className="text-sm text-fg-muted">
                Enter your university register number, the 6-character code provided by your tutor, and choose a new personal PIN.
              </p>

              {completeError && (
                <div role="alert" className="flex items-start gap-2 rounded-control border border-danger/25 bg-danger/8 p-3 text-sm text-danger-text">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{completeError}</span>
                </div>
              )}

              <Field label="University register number" error={completeErrors.registerNumber?.message}>
                <Input
                  type="text"
                  placeholder="e.g. RA2532241010001"
                  autoCapitalize="characters"
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
                  placeholder="e.g. RST-7X9K"
                  autoCapitalize="characters"
                  className="font-mono tracking-widest text-center uppercase"
                  leading={<KeyRound />}
                  disabled={isCompleting}
                  inputSize="lg"
                  {...register("resetToken")}
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="New 6-digit PIN" error={completeErrors.newPin?.message}>
                  <Input
                    type={shownPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    leading={<Lock />}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShownPin((s) => !s)}
                        className="inline-flex size-9 items-center justify-center text-fg-subtle hover:text-fg"
                      >
                        {shownPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    }
                    className="font-mono tracking-widest text-center"
                    disabled={isCompleting}
                    inputSize="lg"
                    {...register("newPin")}
                  />
                </Field>

                <Field label="Confirm new PIN" error={completeErrors.confirmPin?.message}>
                  <Input
                    type={shownConfirm ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    leading={<KeyRound />}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShownConfirm((s) => !s)}
                        className="inline-flex size-9 items-center justify-center text-fg-subtle hover:text-fg"
                      >
                        {shownConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    }
                    className="font-mono tracking-widest text-center"
                    disabled={isCompleting}
                    inputSize="lg"
                    {...register("confirmPin")}
                  />
                </Field>
              </div>

              <Button
                type="submit"
                variant="brand"
                size="lg"
                className="w-full mt-2"
                loading={isCompleting}
                loadingText="Updating PIN..."
              >
                Update PIN & sign in
              </Button>
            </form>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
