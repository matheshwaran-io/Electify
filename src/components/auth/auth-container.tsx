"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { login, registerStaff } from "@/app/actions/auth";
import { toast } from "sonner";
import { User, UserCog, Eye, EyeOff, Mail, Lock, Check, KeyRound, Building, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { press, spring, transition } from "@/lib/motion";

// --- Schemas ---
const studentLoginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  registerNumber: z.string().min(1, "Register number is required"),
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

export function AuthContainer() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"STUDENT" | "STAFF">("STUDENT");
  const [authMode, setAuthMode] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Dynamic hierarchy
  type SectionData = { id: string; label: string };
  type BatchData = { id: string; year: string; sections: SectionData[] };
  type ProgData = { id: string; name: string; code: string; batches: BatchData[] };
  type DeptData = { id: string; name: string; code: string; programmes: ProgData[] };
  type FacultyData = { id: string; name: string; code: string; departments: DeptData[] };
  const [hierarchy, setHierarchy] = useState<FacultyData[]>([]);

  useEffect(() => {
    import("@/app/actions/auth").then((mod) => {
      mod.getPublicHierarchy().then((data) => {
        setHierarchy(data.faculties);
      });
    });
  }, []);

  // Authentication progress state (Custom apple/SaaS progress bar)
  const [authState, setAuthState] = useState<"idle" | "authenticating" | "verified" | "error">("idle");
  const [authProgress, setAuthProgress] = useState(0);

  // Student Login Form
  const { register: registerStudent, handleSubmit: handleStudentSubmit, formState: { errors: studentErrors } } = useForm<StudentLoginData>({
    resolver: zodResolver(studentLoginSchema),
  });

  // Staff Login Form
  const { register: registerStaffLogin, handleSubmit: handleStaffLoginSubmit, formState: { errors: staffLoginErrors } } = useForm<StaffLoginData>({
    resolver: zodResolver(staffLoginSchema),
  });

  // Staff Register Form
  const { register: registerStaffForm, handleSubmit: handleStaffRegisterSubmit, formState: { errors: staffRegisterErrors }, watch } = useForm<StaffRegisterData>({
    resolver: zodResolver(staffRegisterSchema),
    defaultValues: {
      inviteCode: "",
      name: "",
      email: "",
      faculty: "",
      department: "",
      degree: "",
    },
  });

  const selectedFacultyId = watch("faculty");
  const selectedDeptId = watch("department");

  const currentDepts = hierarchy.find(f => f.id === selectedFacultyId)?.departments || [];
  const currentProgs = currentDepts.find(d => d.id === selectedDeptId)?.programmes || [];



  const runAuthMockAnimation = async (submitCallback: () => Promise<{ success: boolean; error?: string; role?: string }>) => {
    setAuthState("authenticating");
    setAuthProgress(0);

    // Animate progress bar to ~80% while the real API call runs in parallel
    const progressInterval = setInterval(() => {
      setAuthProgress((prev) => {
        if (prev >= 80) {
          clearInterval(progressInterval);
          return 80;
        }
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 100);

    // Fire the actual API call
    const result = await submitCallback();

    // Stop progress animation and complete the bar
    clearInterval(progressInterval);
    setAuthProgress(100);

    if (result.success) {
      // Only show "verified" after the server confirmed success
      setAuthState("verified");
      await new Promise((resolve) => setTimeout(resolve, 700));
      toast.success("Welcome back!");
      if (result.role === "STUDENT") {
        router.push("/dashboard");
      } else if (result.role === "COURSE_COORDINATOR") {
        router.push("/faculty/portal-select");
      } else {
        router.push("/faculty/dashboard");
      }
      router.refresh();
    } else {
      setAuthState("error");
      toast.error(result.error || "Authentication failed.");
      setTimeout(() => setAuthState("idle"), 2000);
    }
  };

  const onStudentLogin = (data: StudentLoginData) => {
    runAuthMockAnimation(() =>
      login({
        identifier: data.email.toLowerCase().trim(),
        password: data.registerNumber.toUpperCase().trim(),
      })
    );
  };

  const onStaffLogin = (data: StaffLoginData) => {
    runAuthMockAnimation(() =>
      login({
        identifier: data.email.toLowerCase().trim(),
        password: data.password,
      })
    );
  };

  const onStaffRegister = (data: StaffRegisterData) => {
    runAuthMockAnimation(() =>
      registerStaff({
        inviteCode: data.inviteCode,
        name: data.name,
        email: data.email.toLowerCase().trim(),
        facultyId: data.faculty,
        departmentId: data.department,
        programmeId: data.degree,
        password: data.password,
      })
    );
  };

  return (
    <div className="w-full space-y-6 text-fg z-10 relative">
      
      {/* Segmented Control Selector (Student vs Staff) */}
      <div className="bg-surface-2 p-1 rounded-card border border-border flex relative">
        <button
          onClick={() => {
            setAccountType("STUDENT");
            setAuthMode("LOGIN");
            setAuthState("idle");
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-control transition-all relative z-10",
            accountType === "STUDENT" ? "text-fg" : "text-fg-muted hover:text-fg-muted"
          )}
        >
          {accountType === "STUDENT" && (
            <motion.div
              layoutId="activeAccountType"
              className="absolute inset-0 bg-surface border border-border shadow-1 rounded-control -z-10"
              transition={spring.snappy}
            />
          )}
          <User className="w-3.5 h-3.5 text-primary-text" />
          Student Login
        </button>

        <button
          onClick={() => {
            setAccountType("STAFF");
            setAuthState("idle");
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-control transition-all relative z-10",
            accountType === "STAFF" ? "text-fg" : "text-fg-muted hover:text-fg-muted"
          )}
        >
          {accountType === "STAFF" && (
            <motion.div
              layoutId="activeAccountType"
              className="absolute inset-0 bg-surface border border-border shadow-1 rounded-control -z-10"
              transition={spring.snappy}
            />
          )}
          <UserCog className="w-3.5 h-3.5 text-primary-text" />
          Staff Login
        </button>
      </div>

      {/* Staff Login / Register Slider */}
      {accountType === "STAFF" && (
        <div className="bg-surface-2 p-1 rounded-control border border-border flex relative max-w-50 mx-auto">
          <button
            onClick={() => { setAuthMode("LOGIN"); setAuthState("idle"); }}
            className={cn(
              "flex-1 py-1 text-xs font-semibold rounded-control transition-all relative z-10",
              authMode === "LOGIN" ? "text-fg" : "text-fg-muted hover:text-fg-subtle"
            )}
          >
            {authMode === "LOGIN" && (
              <motion.div
                layoutId="activeAuthMode"
                className="absolute inset-0 bg-surface border border-border rounded-control -z-10"
                transition={spring.snappy}
              />
            )}
            Sign In
          </button>
          <button
            onClick={() => { setAuthMode("REGISTER"); setAuthState("idle"); }}
            className={cn(
              "flex-1 py-1 text-xs font-semibold rounded-control transition-all relative z-10",
              authMode === "REGISTER" ? "text-fg" : "text-fg-muted hover:text-fg-subtle"
            )}
          >
            {authMode === "REGISTER" && (
              <motion.div
                layoutId="activeAuthMode"
                className="absolute inset-0 bg-surface border border-border rounded-control -z-10"
                transition={spring.snappy}
              />
            )}
            Register
          </button>
        </div>
      )}

      {/* Container wrapper for layered depth elements behind the card */}
      <div className="relative group">
        
        {/* Depth Orb (5% opacity) */}

        {/* ── Main Glass Authentication Panel (Static) ─────── */}
        <div
          className="bg-surface p-8 rounded-panel border border-border shadow-2 relative overflow-hidden z-10"
        >

          <AnimatePresence mode="wait">
            {/* STUDENT LOGIN */}
            {accountType === "STUDENT" && (
              <motion.form
                key="student-login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={transition.fade}
                onSubmit={handleStudentSubmit(onStudentLogin)}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-lg font-bold text-fg tracking-tight">Student Sign In</h2>
                  <p className="text-xs text-fg-muted mt-1">
                    Sign in with your official SRM email and register number.
                  </p>
                </div>

                {/* SRM Email Input */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    placeholder="SRM Email (e.g. jd1234@srmist.edu.in)"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStudent("email")}
                  />
                  {studentErrors.email && (
                    <p className="text-2xs text-danger-text mt-1 pl-2">{studentErrors.email.message}</p>
                  )}
                </div>

                {/* Register Number Input */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Register Number (e.g. RA2682242010126)"
                    className="w-full pl-10 pr-11 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStudent("registerNumber")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted transition-colors z-10"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {studentErrors.registerNumber && (
                    <p className="text-2xs text-danger-text mt-1 pl-2">{studentErrors.registerNumber.message}</p>
                  )}
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <AuthSubmitButton authState={authState} progress={authProgress} label="Sign In to Electify" />
                </div>
              </motion.form>
            )}

            {/* STAFF LOGIN */}
            {accountType === "STAFF" && authMode === "LOGIN" && (
              <motion.form
                key="staff-login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={transition.fade}
                onSubmit={handleStaffLoginSubmit(onStaffLogin)}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-lg font-bold text-fg tracking-tight">Staff Sign In</h2>
                  <p className="text-xs text-fg-muted mt-1">
                    Coordinator / Tutor console access.
                  </p>
                </div>

                {/* Email Input */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    placeholder="Staff Email"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStaffLogin("email")}
                  />
                  {staffLoginErrors.email && (
                    <p className="text-2xs text-danger-text mt-1 pl-2">{staffLoginErrors.email.message}</p>
                  )}
                </div>

                {/* Password Input */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    className="w-full pl-10 pr-11 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStaffLogin("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted transition-colors z-10"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {staffLoginErrors.password && (
                    <p className="text-2xs text-danger-text mt-1 pl-2">{staffLoginErrors.password.message}</p>
                  )}
                </div>

                <div className="pt-2">
                  <AuthSubmitButton authState={authState} progress={authProgress} label="Verify Credentials" />
                </div>
              </motion.form>
            )}

            {/* STAFF REGISTER */}
            {accountType === "STAFF" && authMode === "REGISTER" && (
              <motion.form
                key="staff-register"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={transition.fade}
                onSubmit={handleStaffRegisterSubmit(onStaffRegister)}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-bold text-fg tracking-tight">Create Staff Account</h2>
                  <p className="text-xs text-fg-muted mt-1">
                    Register with your official SRMist email and valid Invite Code.
                  </p>
                </div>

                {/* Invite Code */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                    <KeyRound className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Invite Code (e.g. ELC-CC-...)"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStaffForm("inviteCode")}
                  />
                  {staffRegisterErrors.inviteCode && (
                    <p className="text-2xs text-danger-text mt-1 pl-2">{staffRegisterErrors.inviteCode.message}</p>
                  )}
                </div>

                {/* Full Name */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStaffForm("name")}
                  />
                  {staffRegisterErrors.name && (
                    <p className="text-2xs text-danger-text mt-1 pl-2">{staffRegisterErrors.name.message}</p>
                  )}
                </div>

                {/* SRM Email */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    placeholder="yourname@srmist.edu.in"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStaffForm("email")}
                  />
                  {staffRegisterErrors.email && (
                    <p className="text-2xs text-danger-text mt-1 pl-2">{staffRegisterErrors.email.message}</p>
                  )}
                </div>

                {/* Faculty Selector */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                    <Building className="w-3.5 h-3.5" />
                  </div>
                  <select
                    className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium appearance-none cursor-pointer"
                    disabled={authState !== "idle"}
                    {...registerStaffForm("faculty")}
                  >
                    <option value="">Select Faculty</option>
                    {hierarchy.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-fg-subtle text-2xs">▼</div>
                  {staffRegisterErrors.faculty && (
                    <p className="text-2xs text-danger-text mt-1 pl-2">{staffRegisterErrors.faculty.message}</p>
                  )}
                </div>

                {/* Department & Degree (Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                      <UserCog className="w-3.5 h-3.5" />
                    </div>
                    <select
                      className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium appearance-none cursor-pointer"
                      disabled={authState !== "idle" || !selectedFacultyId}
                      {...registerStaffForm("department")}
                    >
                      <option value="">Select Department</option>
                      {currentDepts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-fg-subtle text-2xs">▼</div>
                    {staffRegisterErrors.department && (
                      <p className="text-2xs text-danger-text mt-1 pl-2">{staffRegisterErrors.department.message}</p>
                    )}
                  </div>

                  <div className="space-y-1 relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                      <GraduationCap className="w-3.5 h-3.5" />
                    </div>
                    <select
                      className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium appearance-none cursor-pointer"
                      disabled={authState !== "idle" || !selectedDeptId}
                      {...registerStaffForm("degree")}
                    >
                      <option value="">Select Programme</option>
                      {currentProgs.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-fg-subtle text-2xs">▼</div>
                    {staffRegisterErrors.degree && (
                      <p className="text-2xs text-danger-text mt-1 pl-2">{staffRegisterErrors.degree.message}</p>
                    )}
                  </div>
                </div>


                {/* Password & Confirm Password (Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium"
                      disabled={authState !== "idle"}
                      {...registerStaffForm("password")}
                    />
                    {staffRegisterErrors.password && (
                      <p className="text-2xs text-danger-text mt-1 pl-2">{staffRegisterErrors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-1 relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle group-focus-within/input:text-primary-text transition-colors z-10">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm"
                      className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border-strong rounded-control text-xs text-fg placeholder-fg-subtle focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/5 hover:border-border-strong transition-all font-medium"
                      disabled={authState !== "idle"}
                      {...registerStaffForm("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted transition-colors z-10"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {staffRegisterErrors.confirmPassword && (
                      <p className="text-2xs text-danger-text mt-1 pl-2">{staffRegisterErrors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <AuthSubmitButton authState={authState} progress={authProgress} label="Create Account" />
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Custom Progress/Loading Authentication Submit Button
function AuthSubmitButton({
  authState,
  progress,
  label,
}: {
  authState: "idle" | "authenticating" | "verified" | "error";
  progress: number;
  label: string;
}) {
  return (
    <motion.button
      type="submit"
      disabled={authState !== "idle"}
      className="w-full relative py-3 px-6 rounded-control bg-brand text-primary-fg text-xs font-bold disabled:opacity-90 overflow-hidden select-none transition-all flex items-center justify-center ring-1 ring-border"
      whileTap={authState === "idle" ? press : undefined}
    >
      <AnimatePresence mode="wait">
        {authState === "idle" && (
          <motion.span
            key="idle-label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="uppercase tracking-wider"
          >
            {label}
          </motion.span>
        )}

        {authState === "authenticating" && (
          <motion.div
            key="authenticating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center w-full gap-1.5"
          >
            <div className="text-2xs font-extrabold uppercase tracking-wider text-fg-muted">
              Authenticating...
            </div>
            {/* SaaS Progress Bar design: [■■■■■■░░░░] */}
            <div className="flex items-center gap-1 font-mono text-2xs text-fg-subtle">
              <span>[</span>
              {Array.from({ length: 10 }).map((_, idx) => {
                const step = idx * 10;
                const isFilled = progress >= step;
                return (
                  <span
                    key={idx}
                    className={cn(
                      "inline-block w-1.5 h-2.5 transition-colors",
                      isFilled ? "bg-fg" : "bg-surface-3"
                    )}
                  />
                );
              })}
              <span>]</span>
              <span className="ml-1 text-fg font-bold">{Math.min(100, progress)}%</span>
            </div>
          </motion.div>
        )}

        {authState === "verified" && (
          <motion.div
            key="verified"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-success-text"
          >
            <Check className="w-3.5 h-3.5 stroke-[3px]" />
            <span className="font-bold text-xs tracking-wider uppercase">Verified ✓</span>
          </motion.div>
        )}

        {authState === "error" && (
          <motion.span
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-danger-text font-extrabold text-xs uppercase tracking-wider"
          >
            Failed
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
