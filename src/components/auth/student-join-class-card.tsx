"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  ShieldAlert,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { registerStudentWithClassCode, validateClassSignupCode } from "@/app/actions/auth";
import { transition } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";

const studentSignupSchema = z
  .object({
    code: z.string().min(1, "Class signup code is required"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .refine(
        (val) => val.toLowerCase().trim().endsWith("@srmist.edu.in"),
        "Must be an official @srmist.edu.in student email address"
      ),
    registerNumber: z
      .string()
      .min(5, "Register number must be at least 5 characters")
      .regex(/^[A-Za-z0-9]+$/, "Register number must be alphanumeric"),
    name: z.string().min(2, "Full name is required"),
    pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
    confirmPin: z.string().min(1, "Please confirm your 6-digit PIN"),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: "6-digit PINs do not match",
    path: ["confirmPin"],
  });

type StudentSignupFormData = z.infer<typeof studentSignupSchema>;

type ClassInfo = {
  code: string;
  sectionLabel: string;
  className: string;
  batchYear: string;
  programmeName: string;
  programmeCode: string;
  departmentName: string;
  tutorName: string;
  maxUses: number;
  usedCount: number;
  spotsRemaining: number;
};

export function StudentJoinClassCard({
  initialCode,
  onSwitchToLogin,
}: {
  initialCode?: string;
  onSwitchToLogin?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCode = initialCode || searchParams.get("code") || "";

  const [classCodeInput, setClassCodeInput] = React.useState(urlCode);
  const [isValidatingCode, setIsValidatingCode] = React.useState(false);
  const [classInfo, setClassInfo] = React.useState<ClassInfo | null>(null);
  const [codeError, setCodeError] = React.useState<string | null>(null);

  const [shownPin, setShownPin] = React.useState(false);
  const [shownConfirm, setShownConfirm] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<StudentSignupFormData>({
    resolver: zodResolver(studentSignupSchema),
    defaultValues: {
      code: urlCode,
    },
  });

  // Debounced class code verification
  React.useEffect(() => {
    const trimmed = classCodeInput.trim().toUpperCase();
    if (!trimmed) {
      setClassInfo(null);
      setCodeError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidatingCode(true);
      setCodeError(null);
      try {
        const res = await validateClassSignupCode(trimmed);
        if (res.valid && res.data) {
          setClassInfo(res.data);
          setValue("code", trimmed, { shouldValidate: true });
        } else {
          setClassInfo(null);
          setCodeError(res.error || "Invalid class signup code.");
        }
      } catch {
        setClassInfo(null);
        setCodeError("Could not verify class code. Please check your network.");
      } finally {
        setIsValidatingCode(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [classCodeInput, setValue]);

  const onSubmit = async (data: StudentSignupFormData) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const result = await registerStudentWithClassCode({
        code: data.code,
        email: data.email,
        registerNumber: data.registerNumber,
        name: data.name,
        pin: data.pin,
        confirmPin: data.confirmPin,
      });

      if (!result.success) {
        setFormError(result.error || "Unable to register student account.");
        setIsSubmitting(false);
        return;
      }

      toast.success("Welcome to Electify! Account created successfully.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setFormError("Could not connect to the server. Please check your connection.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 space-y-1.5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
          <Sparkles className="size-3" /> Student Class Onboarding
        </div>
        <h2 className="text-3xl font-light tracking-display text-fg">Join your class</h2>
        <p className="text-sm text-fg-muted">
          Enter your class signup code to connect with your assigned cohort and tutor.
        </p>
      </div>

      <AnimatePresence>
        {formError ? (
          <motion.div
            key="form-error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition.fade}
            className="overflow-hidden"
          >
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-control border border-danger/25 bg-danger/8 px-3.5 py-3 text-sm text-danger-text"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Class Code Input */}
        <Field label="Class signup code" error={errors.code?.message || codeError || undefined}>
          <div className="relative">
            <Input
              value={classCodeInput}
              onChange={(e) => setClassCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. EF-MCA-F-7X9K"
              className="font-mono text-base uppercase tracking-wider"
              disabled={isSubmitting}
              autoComplete="off"
              spellCheck={false}
              inputSize="lg"
            />
            {isValidatingCode && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <div className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              </div>
            )}
          </div>
        </Field>

        {/* Resolved Class Badge Card */}
        <AnimatePresence>
          {classInfo ? (
            <motion.div
              key="class-badge"
              initial={{ opacity: 0, scale: 0.98, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -4 }}
              className="rounded-control border border-brand/20 bg-brand/5 p-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-brand/10 pb-2.5">
                <div className="flex items-center gap-1.5 text-brand">
                  <CheckCircle2 className="size-4" />
                  <span className="font-semibold uppercase tracking-wider text-[11px]">Class Verified</span>
                </div>
                <Badge tone="primary" size="sm">
                  {classInfo.spotsRemaining} / {classInfo.maxUses} spots open
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-fg">
                <div>
                  <span className="text-fg-subtle text-[11px] block">Assigned Class</span>
                  <span className="font-medium text-sm text-fg">{classInfo.className}</span>
                </div>
                <div>
                  <span className="text-fg-subtle text-[11px] block">Department</span>
                  <span className="font-medium text-fg truncate block" title={classInfo.departmentName}>
                    {classInfo.departmentName}
                  </span>
                </div>
                <div>
                  <span className="text-fg-subtle text-[11px] block">Programme</span>
                  <span className="font-medium text-fg">{classInfo.programmeName}</span>
                </div>
                <div>
                  <span className="text-fg-subtle text-[11px] block">Class Tutor</span>
                  <span className="font-medium text-fg truncate block">{classInfo.tutorName}</span>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* SRM Student Email */}
        <Field label="SRM student email" error={errors.email?.message}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="jd1234@srmist.edu.in"
            leading={<Mail />}
            disabled={isSubmitting}
            inputSize="lg"
            {...register("email")}
          />
        </Field>

        {/* University Registration Number */}
        <Field label="University registration number" error={errors.registerNumber?.message}>
          <Input
            type="text"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="e.g. RA2532241010001"
            leading={<GraduationCap />}
            className="font-mono tracking-wide"
            disabled={isSubmitting}
            inputSize="lg"
            {...register("registerNumber")}
          />
        </Field>

        {/* Full Name */}
        <Field label="Full name (as per university records)" error={errors.name?.message}>
          <Input
            type="text"
            autoComplete="name"
            placeholder="e.g. Rohan Patel"
            leading={<User />}
            disabled={isSubmitting}
            inputSize="lg"
            {...register("name")}
          />
        </Field>

        {/* 6-Digit PIN Fields */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Create 6-digit PIN" error={errors.pin?.message}>
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
                  aria-label={shownPin ? "Hide PIN" : "Show PIN"}
                >
                  {shownPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
              className="font-mono tracking-widest text-center"
              disabled={isSubmitting}
              inputSize="lg"
              {...register("pin")}
            />
          </Field>

          <Field label="Confirm 6-digit PIN" error={errors.confirmPin?.message}>
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
                  aria-label={shownConfirm ? "Hide Confirm PIN" : "Show Confirm PIN"}
                >
                  {shownConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
              className="font-mono tracking-widest text-center"
              disabled={isSubmitting}
              inputSize="lg"
              {...register("confirmPin")}
            />
          </Field>
        </div>

        {/* Security Warning Callout */}
        <div className="flex items-start gap-2.5 rounded-control border border-border bg-surface-3/40 p-3 text-xs text-fg-muted">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p>
            <strong className="font-semibold text-fg">Security notice:</strong> Never share your personal
            6-digit PIN with your class tutor or another student.
          </p>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full mt-2"
          loading={isSubmitting}
          loadingText="Enrolling into class..."
          disabled={!classInfo}
        >
          Join class & create account <ArrowRight className="size-4" />
        </Button>

        {/* Back to sign in link */}
        <p className="text-center text-sm text-fg-muted pt-2">
          Already registered?{" "}
          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              Sign in with your PIN
            </button>
          ) : (
            <Link
              href="/login"
              className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              Sign in with your PIN
            </Link>
          )}
        </p>
      </form>
    </div>
  );
}
