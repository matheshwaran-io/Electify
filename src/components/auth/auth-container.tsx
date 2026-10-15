"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Eye, EyeOff, GraduationCap, KeyRound, Mail, UserCog, ShieldCheck } from "lucide-react";
import { login, registerStaff, studentLogin, upgradeStudentPassword, studentSSOLogin } from "@/app/actions/auth";
import { normalizeRegisterNumber, passwordProblem, REGISTER_NUMBER_PATTERN } from "@/lib/password-policy";
import { transition, variants } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { StudentJoinClassCard } from "./student-join-class-card";
import { StudentPasswordResetModal } from "./student-password-reset-modal";
import { PasswordChecklist, PasswordInput } from "./password-input";

// --- Schemas ---
const studentLoginSchema = z.object({
  registerNumber: z
    .string()
    .trim()
    .min(1, "Enter your register number")
    .refine((v) => !v.includes("@"), "Use your register number, not your email")
    .refine((v) => REGISTER_NUMBER_PATTERN.test(normalizeRegisterNumber(v)), "Enter a valid register number, e.g. RA2532241010001"),
  password: z.string().min(1, "Enter your password"),
});

const staffLoginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const staffRegisterSchema = z
  .object({
    inviteCode: z.string().min(1, "Invite code is required"),
    name: z.string().min(2, "Full name is required"),
    email: z.string().min(1, "Email is required").email("Invalid email address")
      .refine(val => val.endsWith("@srmist.edu.in"), "Must be an official @srmist.edu.in email address"),
    faculty: z.string().min(1, "Faculty is required"),
    department: z.string().min(1, "Department is required"),
    degree: z.string().min(1, "Degree is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type StudentLoginData = z.infer<typeof studentLoginSchema>;
type StaffLoginData = z.infer<typeof staffLoginSchema>;
type StaffRegisterData = z.infer<typeof staffRegisterSchema>;

type SectionData = { id: string; label: string };
type BatchData = { id: string; year: string; sections: SectionData[] };
type ProgData = { id: string; name: string; code: string; batches: BatchData[] };
type DeptData = { id: string; name: string; code: string; programmes: ProgData[] };
type FacultyData = { id: string; name: string; code: string; departments: DeptData[] };

type Status = "idle" | "submitting" | "success";
type Result = { success: boolean; error?: string; role?: string; requiresPasswordUpgrade?: boolean; upgradeTicket?: string };
type Upgrade = { ticket: string; registerNumber: string };

/** Server messages stay authoritative; a few get friendlier wording. */
function friendly(error?: string) {
  if (!error) return "We couldn't sign you in. Check your details and try again.";
  if (error === "Invalid credentials.") return "Those details don't match our records. Check them and try again.";
  if (error === "Invalid credentials format.") return "Enter your credentials to continue.";
  return error;
}

export function AuthContainer() {
  const router = useRouter();
  const [accountType, setAccountType] = React.useState<"STUDENT" | "STAFF">("STUDENT");
  const [authMode, setAuthMode] = React.useState<"LOGIN" | "REGISTER" | "JOIN_CLASS">("LOGIN");
  const [status, setStatus] = React.useState<Status>("idle");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [resetModalOpen, setResetModalOpen] = React.useState(false);
  const [ssoModalOpen, setSsoModalOpen] = React.useState(false);
  const [ssoRegisterNumber, setSsoRegisterNumber] = React.useState("");
  const [ssoError, setSsoError] = React.useState<string | null>(null);
  const [upgrade, setUpgrade] = React.useState<Upgrade | null>(null);

  // Runs the real server action; the button reflects its true progress.
  const submit = async (call: () => Promise<Result>) => {
    setStatus("submitting");
    setFormError(null);
    try {
      const result = await call();
      if (!result.success && result.requiresPasswordUpgrade) {
        // Not signed in yet: the student chooses a new password first.
        setStatus("idle");
        return;
      }
      if (!result.success) {
        setFormError(friendly(result.error));
        setStatus("idle");
        return;
      }
      setStatus("success");
      if (result.role === "STUDENT") {
        router.push("/dashboard");
      } else {
        // Staff pick the academic session first (skipped when there is only one).
        router.push("/faculty/session-select");
      }
      router.refresh();
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
      setStatus("idle");
    }
  };

  const switchType = (type: "STUDENT" | "STAFF") => {
    setAccountType(type);
    setAuthMode("LOGIN");
    setUpgrade(null);
    setFormError(null);
  };

  const view =
    accountType === "STUDENT"
      ? authMode === "JOIN_CLASS"
        ? "join_class"
        : upgrade
          ? "upgrade"
          : "student"
      : authMode === "LOGIN"
        ? "staff"
        : "register";

  const busy = status !== "idle";

  return (
    <div className="w-full">
      {view !== "join_class" && (
        <div className="mb-8 space-y-2">
          <h2 className="text-3xl font-light tracking-display text-fg">
            {view === "register" ? "Create a staff account" : view === "upgrade" ? "Choose a new password" : "Sign in"}
          </h2>
          <p className="text-sm text-fg-muted">
            {view === "student"
              ? "Use your register number and password."
              : view === "upgrade"
                ? "Student sign-in now uses a password instead of a PIN or the temporary password you were given. Choose your own to continue."
                : view === "staff"
                  ? "For class tutors, course coordinators and administrators."
                  : "You'll need the invite code your administrator sent you."}
          </p>
        </div>
      )}

      {view === "student" || view === "staff" ? (
        <Tabs value={accountType} onValueChange={(v) => switchType(v as "STUDENT" | "STAFF")} className="mb-6">
          <TabsList variant="pill" className="grid w-full grid-cols-2">
            <TabsTrigger value="STUDENT" disabled={busy}>
              <GraduationCap /> Student
            </TabsTrigger>
            <TabsTrigger value="STAFF" disabled={busy}>
              <UserCog /> Staff
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAuthMode("LOGIN");
            setUpgrade(null);
            setFormError(null);
          }}
          disabled={busy}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" /> Back to sign in
        </button>
      )}

      <AnimatePresence>
        {formError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition.fade}
            className="overflow-hidden"
          >
            <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-control border border-danger/25 bg-danger/8 px-3.5 py-3 text-sm text-danger-text">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} variants={variants.rise} initial="hidden" animate="visible" exit="exit">
          {view === "student" && (
            <StudentForm
              status={status}
              onSubmit={submit}
              onJoinClass={() => {
                setAuthMode("JOIN_CLASS");
                setFormError(null);
              }}
              onForgotPassword={() => setResetModalOpen(true)}
              onUpgradeRequired={(u) => {
                setFormError(null);
                setUpgrade(u);
              }}
              onSSOClick={() => {
                setSsoError(null);
                setSsoModalOpen(true);
              }}
            />
          )}
          {view === "upgrade" && upgrade && <UpgradePasswordForm upgrade={upgrade} status={status} onSubmit={submit} />}
          {view === "join_class" && (
            <StudentJoinClassCard
              onSwitchToLogin={() => {
                setAuthMode("LOGIN");
                setFormError(null);
              }}
            />
          )}
          {view === "staff" && (
            <StaffLoginForm
              status={status}
              onSubmit={submit}
              onRegister={() => {
                setAuthMode("REGISTER");
                setFormError(null);
              }}
            />
          )}
          {view === "register" && <StaffRegisterForm status={status} onSubmit={submit} />}
        </motion.div>
      </AnimatePresence>

      {/* Tutor-authorized password reset */}
      <StudentPasswordResetModal open={resetModalOpen} onOpenChange={setResetModalOpen} />

      {/* Student Institutional SSO Modal */}
      {ssoModalOpen && (
        <Dialog open={ssoModalOpen} onOpenChange={setSsoModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-500" />
                SRM Student Institutional SSO
              </DialogTitle>
              <DialogDescription>
                Authenticate with your university registration number.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4 pt-2">
              <div className="rounded-control border border-border bg-surface-2 p-3 text-xs text-fg-muted space-y-1">
                <p className="font-medium text-fg flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                  Single Session Policy
                </p>
                <p>
                  Multiple simultaneous logins are strictly restricted. Signing in here will immediately terminate any active session on other browsers or devices.
                </p>
              </div>

              <Field label="SRM Student Register Number" error={ssoError || undefined}>
                <Input
                  type="text"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="e.g. RA2532241010001"
                  value={ssoRegisterNumber}
                  onChange={(e) => {
                    setSsoRegisterNumber(e.target.value);
                    setSsoError(null);
                  }}
                  leading={<GraduationCap />}
                  className="font-mono tracking-wide"
                  inputSize="lg"
                  disabled={status === "submitting"}
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSsoModalOpen(false)}
                disabled={status === "submitting"}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="brand"
                loading={status === "submitting"}
                loadingText="Verifying SSO"
                onClick={async () => {
                  const reg = ssoRegisterNumber.trim();
                  if (!reg) {
                    setSsoError("Enter your SRM Register Number");
                    return;
                  }
                  await submit(async () => {
                    const res = await studentSSOLogin({ registerNumber: reg });
                    if (!res.success) {
                      setSsoError(res.error || "SSO Verification Failed");
                    } else {
                      setSsoModalOpen(false);
                    }
                    return res;
                  });
                }}
              >
                Authenticate via SSO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

type FormProps = { status: Status; onSubmit: (call: () => Promise<Result>) => Promise<void> };

function SubmitButton({ status, label }: { status: Status; label: string }) {
  return (
    <Button type="submit" variant="brand" size="lg" className="w-full" loading={status === "submitting"} loadingText="Signing in" disabled={status === "success"}>
      {status === "success" ? (
        <>
          <Check className="size-4" strokeWidth={3} /> Signed in
        </>
      ) : (
        <>
          {label} <ArrowRight className="size-4 transition-transform duration-150 group-hover/button:translate-x-0.5" />
        </>
      )}
    </Button>
  );
}

function RevealToggle({ shown, onToggle, label }: { shown: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={shown}
      className="inline-flex size-9 items-center justify-center rounded-full text-fg-subtle transition-colors hover:text-fg"
    >
      {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}

function StudentForm({
  status,
  onSubmit,
  onJoinClass,
  onForgotPassword,
  onUpgradeRequired,
  onSSOClick,
}: FormProps & {
  onJoinClass: () => void;
  onForgotPassword: () => void;
  onUpgradeRequired: (upgrade: Upgrade) => void;
  onSSOClick: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<StudentLoginData>({ resolver: zodResolver(studentLoginSchema) });
  const busy = status !== "idle";

  return (
    <form
      noValidate
      onSubmit={handleSubmit((data) =>
        onSubmit(async () => {
          const registerNumber = normalizeRegisterNumber(data.registerNumber);
          const result = await studentLogin({ registerNumber, password: data.password });
          if (result.requiresPasswordUpgrade && result.upgradeTicket) {
            onUpgradeRequired({ ticket: result.upgradeTicket, registerNumber });
          }
          return result;
        })
      )}
      className="space-y-4"
    >
      <Field label="Register number" error={errors.registerNumber?.message}>
        <Input
          type="text"
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="e.g. RA2532241010001"
          leading={<GraduationCap />}
          className="font-mono tracking-wide"
          disabled={busy}
          inputSize="lg"
          {...register("registerNumber")}
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <PasswordInput autoComplete="current-password" placeholder="Your password" disabled={busy} inputSize="lg" {...register("password")} />
      </Field>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onForgotPassword}
          disabled={busy}
          className="inline-flex min-h-10 items-center text-xs text-fg-subtle underline-offset-2 transition-colors hover:text-fg hover:underline"
        >
          Forgot password? Ask your class tutor
        </button>
      </div>

      <SubmitButton status={status} label="Sign in" />

      {/* Institutional SSO & Single Active Session Enforcement */}
      <div className="relative my-3 pt-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-surface-2 px-2 text-fg-subtle font-mono text-[10px]">Institutional Access</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onSSOClick}
        disabled={busy}
        className="w-full border-border text-fg hover:bg-surface-3 flex items-center justify-center gap-2 text-xs font-medium h-10"
      >
        <ShieldCheck className="size-4 text-emerald-500" />
        SRM Student Institutional SSO
      </Button>

      <p className="text-[11px] text-fg-subtle text-center">
        Single session enforced. Multiple simultaneous logins are strictly restricted.
      </p>

      <div className="pt-2 text-center text-sm text-fg-muted">
        Need to onboard with your class?{" "}
        <button
          type="button"
          onClick={onJoinClass}
          disabled={busy}
          className="font-medium text-fg underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-fg"
        >
          Join your class with code
        </button>
      </div>
    </form>
  );
}

const upgradeSchema = z
  .object({ registerNumber: z.string(), newPassword: z.string(), confirmPassword: z.string() })
  .superRefine((data, ctx) => {
    const problem = passwordProblem(data.newPassword, { registerNumber: data.registerNumber });
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["newPassword"] });
    else if (data.newPassword !== data.confirmPassword) ctx.addIssue({ code: "custom", message: "Passwords do not match", path: ["confirmPassword"] });
  });
type UpgradeData = z.infer<typeof upgradeSchema>;

/** Shown after a student signs in with a legacy PIN or temporary password. */
function UpgradePasswordForm({ upgrade, status, onSubmit }: FormProps & { upgrade: Upgrade }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<UpgradeData>({
    resolver: zodResolver(upgradeSchema),
    defaultValues: { registerNumber: upgrade.registerNumber, newPassword: "", confirmPassword: "" },
  });
  const busy = status !== "idle";
  const newPassword = watch("newPassword");

  return (
    <form
      noValidate
      onSubmit={handleSubmit((data) =>
        onSubmit(() => upgradeStudentPassword({ ticket: upgrade.ticket, newPassword: data.newPassword, confirmPassword: data.confirmPassword }))
      )}
      className="space-y-4"
    >
      <p className="rounded-control border border-border bg-surface px-3.5 py-2.5 text-sm text-fg-muted">
        Signing in as <span className="font-mono font-medium text-fg">{upgrade.registerNumber}</span>
      </p>
      {/* Lets password managers pair the new password with the account. */}
      <input type="text" autoComplete="username" value={upgrade.registerNumber} readOnly hidden />

      <Field label="New password" error={errors.newPassword?.message}>
        <PasswordInput autoComplete="new-password" revealLabel="new password" disabled={busy} inputSize="lg" autoFocus {...register("newPassword")} />
      </Field>
      <PasswordChecklist password={newPassword} registerNumber={upgrade.registerNumber} />
      <Field label="Confirm new password" error={errors.confirmPassword?.message}>
        <PasswordInput autoComplete="new-password" revealLabel="confirmation" disabled={busy} inputSize="lg" {...register("confirmPassword")} />
      </Field>

      <SubmitButton status={status} label="Save password and continue" />
    </form>
  );
}

function StaffLoginForm({ status, onSubmit, onRegister }: FormProps & { onRegister: () => void }) {
  const [shown, setShown] = React.useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<StaffLoginData>({ resolver: zodResolver(staffLoginSchema) });
  const busy = status !== "idle";

  return (
    <form
      noValidate
      onSubmit={handleSubmit((data) =>
        onSubmit(() =>
          login({
            identifier: data.email.toLowerCase().trim(),
            password: data.password,
          })
        )
      )}
      className="space-y-5"
    >
      <Field label="Work email" error={errors.email?.message}>
        <Input type="email" autoComplete="username" inputMode="email" placeholder="name@srmist.edu.in" leading={<Mail />} disabled={busy} inputSize="lg" {...register("email")} />
      </Field>
      <Field label="Password" error={errors.password?.message}>
        <Input
          type={shown ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Your password"
          leading={<KeyRound />}
          trailing={<RevealToggle shown={shown} onToggle={() => setShown((s) => !s)} label="password" />}
          className="placeholder:text-fg-muted/70"
          disabled={busy}
          inputSize="lg"
          {...register("password")}
        />
      </Field>
      <SubmitButton status={status} label="Sign in" />
      <p className="text-center text-sm text-fg-muted">
        Have an invite code?{" "}
        <button type="button" data-inline onClick={onRegister} disabled={busy} className="font-medium text-fg underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-fg">
          Create a staff account
        </button>
      </p>
    </form>
  );
}

function StaffRegisterForm({ status, onSubmit }: FormProps) {
  const [shown, setShown] = React.useState(false);
  const [hierarchy, setHierarchy] = React.useState<FacultyData[] | null>(null);
  const busy = status !== "idle";

  React.useEffect(() => {
    import("@/app/actions/auth").then((mod) => {
      mod.getPublicHierarchy().then((data) => setHierarchy(data.faculties));
    });
  }, []);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<StaffRegisterData>({
    resolver: zodResolver(staffRegisterSchema),
    defaultValues: { inviteCode: "", name: "", email: "", faculty: "", department: "", degree: "" },
  });

  const facultyId = watch("faculty");
  const deptId = watch("department");
  const depts = hierarchy?.find((f) => f.id === facultyId)?.departments ?? [];
  const progs = depts.find((d) => d.id === deptId)?.programmes ?? [];

  return (
    <form
      noValidate
      onSubmit={handleSubmit((data) =>
        onSubmit(() =>
          registerStaff({
            inviteCode: data.inviteCode,
            name: data.name,
            email: data.email.toLowerCase().trim(),
            facultyId: data.faculty,
            departmentId: data.department,
            programmeId: data.degree,
            password: data.password,
          })
        )
      )}
      className="space-y-4"
    >
      <Field label="Invite code" error={errors.inviteCode?.message}>
        <Input placeholder="ELC-CC-XXXX" autoComplete="off" spellCheck={false} className="font-mono uppercase" leading={<KeyRound />} disabled={busy} {...register("inviteCode")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.name?.message}>
          <Input autoComplete="name" disabled={busy} {...register("name")} />
        </Field>
        <Field label="Work email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="name@srmist.edu.in" disabled={busy} {...register("email")} />
        </Field>
      </div>
      <Field label="Faculty" error={errors.faculty?.message}>
        <Controller
          control={control}
          name="faculty"
          render={({ field }) => (
            <Select
              value={field.value || null}
              onValueChange={(v) => {
                field.onChange(v);
                setValue("department", "");
                setValue("degree", "");
              }}
              options={(hierarchy ?? []).map((f) => ({ value: f.id, label: f.name }))}
              placeholder={hierarchy ? "Select faculty" : "Loading"}
              disabled={busy || !hierarchy}
            />
          )}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department" error={errors.department?.message}>
          <Controller
            control={control}
            name="department"
            render={({ field }) => (
              <Select
                value={field.value || null}
                onValueChange={(v) => {
                  field.onChange(v);
                  setValue("degree", "");
                }}
                options={depts.map((d) => ({ value: d.id, label: d.name }))}
                placeholder="Select department"
                disabled={busy || !facultyId}
              />
            )}
          />
        </Field>
        <Field label="Programme" error={errors.degree?.message}>
          <Controller
            control={control}
            name="degree"
            render={({ field }) => (
              <Select
                value={field.value || null}
                onValueChange={field.onChange}
                options={progs.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Select programme"
                disabled={busy || !deptId}
              />
            )}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" error={errors.password?.message} description="At least 6 characters.">
          <Input
            type={shown ? "text" : "password"}
            autoComplete="new-password"
            trailing={<RevealToggle shown={shown} onToggle={() => setShown((s) => !s)} label="passwords" />}
            disabled={busy}
            {...register("password")}
          />
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          <Input type={shown ? "text" : "password"} autoComplete="new-password" disabled={busy} {...register("confirmPassword")} />
        </Field>
      </div>
      <div className="pt-1">
        <Button type="submit" variant="brand" size="lg" className="w-full" loading={status === "submitting"} loadingText="Creating account" disabled={status === "success"}>
          {status === "success" ? (
            <>
              <Check className="size-4" strokeWidth={3} /> Account created
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </div>
    </form>
  );
}
