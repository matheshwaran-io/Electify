"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { login, registerStaff } from "@/app/actions/auth";
import { toast } from "sonner";
import { User, UserCog, Eye, EyeOff, Mail, Lock, Check, Layers, KeyRound, Barcode, Building, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
    employeeId: z.string().min(1, "Employee ID is required"),
    name: z.string().min(2, "Full name is required"),
    email: z.string().min(1, "Email is required").email("Invalid email address")
      .refine(val => val.endsWith("@srmist.edu.in"), "Must be an official @srmist.edu.in email address"),
    faculty: z.string().min(1, "Faculty is required"),
    department: z.string().min(1, "Department is required"),
    degree: z.string().min(1, "Degree is required"),
    section: z.string().optional(),
    role: z.enum(["COURSE_COORDINATOR", "CLASS_TUTOR"]),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.role !== "CLASS_TUTOR" || (data.section && data.section.trim().length > 0), {
    message: "Section is required for Class Tutors",
    path: ["section"],
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
      role: "CLASS_TUTOR",
      inviteCode: "",
      employeeId: "",
      name: "",
      email: "",
      faculty: "",
      department: "",
      degree: "",
      section: "",
    },
  });

  const selectedRole = watch("role");
  const selectedFacultyId = watch("faculty");
  const selectedDeptId = watch("department");
  const selectedProgId = watch("degree");

  const currentDepts = hierarchy.find(f => f.id === selectedFacultyId)?.departments || [];
  const currentProgs = currentDepts.find(d => d.id === selectedDeptId)?.programmes || [];
  const currentSections = currentProgs.find(p => p.id === selectedProgId)?.batches.flatMap(b => b.sections) || [];

  // Animate the progress bar when authenticating
  useEffect(() => {
    if (authState === "authenticating") {
      setAuthProgress(0);
      const interval = setInterval(() => {
        setAuthProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setAuthState("verified");
            return 100;
          }
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [authState]);

  const runAuthMockAnimation = async (submitCallback: () => Promise<{ success: boolean; error?: string; role?: string }>) => {
    setAuthState("authenticating");
    setAuthProgress(0);

    // Wait until progress bar is full
    await new Promise((resolve) => {
      const checkProgress = setInterval(() => {
        setAuthProgress((prev) => {
          if (prev >= 100) {
            clearInterval(checkProgress);
            resolve(true);
            return 100;
          }
          return prev + Math.floor(Math.random() * 20) + 10;
        });
      }, 120);
    });

    setAuthState("verified");
    await new Promise((resolve) => setTimeout(resolve, 800));

    const result = await submitCallback();

    if (result.success) {
      toast.success("Welcome back!");
      if (result.role === "STUDENT") {
        router.push("/dashboard");
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
        email: data.email.toLowerCase().trim(),
        password: data.registerNumber.toUpperCase().trim(),
      })
    );
  };

  const onStaffLogin = (data: StaffLoginData) => {
    runAuthMockAnimation(() =>
      login({
        email: data.email.toLowerCase().trim(),
        password: data.password,
      })
    );
  };

  const onStaffRegister = (data: StaffRegisterData) => {
    runAuthMockAnimation(() =>
      registerStaff({
        inviteCode: data.inviteCode,
        employeeId: data.employeeId,
        name: data.name,
        email: data.email.toLowerCase().trim(),
        section: data.role === "CLASS_TUTOR" ? data.section : undefined,
        password: data.password,
      })
    );
  };

  return (
    <div className="w-full space-y-6 text-slate-800 dark:text-slate-200 z-10 relative">
      
      {/* Segmented Control Selector (Student vs Staff) */}
      <div className="bg-slate-100/50 dark:bg-white/[0.02] backdrop-blur-2xl p-1 rounded-2xl border border-slate-200/60 dark:border-white/[0.06] flex relative shadow-[0_15px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.3)] transition-all">
        <button
          onClick={() => {
            setAccountType("STUDENT");
            setAuthMode("LOGIN");
            setAuthState("idle");
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all relative z-10",
            accountType === "STUDENT" ? "text-slate-900 dark:text-slate-100" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          {accountType === "STUDENT" && (
            <motion.div
              layoutId="activeAccountType"
              className="absolute inset-0 bg-white dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/[0.06] shadow-sm dark:shadow-inner rounded-xl -z-10"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <User className="w-3.5 h-3.5 text-[#4F8CFF]" />
          Student Login
        </button>

        <button
          onClick={() => {
            setAccountType("STAFF");
            setAuthState("idle");
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all relative z-10",
            accountType === "STAFF" ? "text-slate-900 dark:text-slate-100" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          {accountType === "STAFF" && (
            <motion.div
              layoutId="activeAccountType"
              className="absolute inset-0 bg-white dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/[0.06] shadow-sm dark:shadow-inner rounded-xl -z-10"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <UserCog className="w-3.5 h-3.5 text-[#6D5DFE]" />
          Staff Login
        </button>
      </div>

      {/* Staff Login / Register Slider */}
      {accountType === "STAFF" && (
        <div className="bg-slate-100/30 dark:bg-white/[0.01] backdrop-blur-2xl p-1 rounded-xl border border-slate-200/40 dark:border-white/[0.04] flex relative max-w-[200px] mx-auto">
          <button
            onClick={() => { setAuthMode("LOGIN"); setAuthState("idle"); }}
            className={cn(
              "flex-1 py-1 text-[11px] font-semibold rounded-[8px] transition-all relative z-10",
              authMode === "LOGIN" ? "text-slate-900 dark:text-slate-100" : "text-slate-500 hover:text-slate-300"
            )}
          >
            {authMode === "LOGIN" && (
              <motion.div
                layoutId="activeAuthMode"
                className="absolute inset-0 bg-white dark:bg-white/[0.05] border border-slate-200/40 dark:border-white/[0.06] rounded-[8px] -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            Sign In
          </button>
          <button
            onClick={() => { setAuthMode("REGISTER"); setAuthState("idle"); }}
            className={cn(
              "flex-1 py-1 text-[11px] font-semibold rounded-[8px] transition-all relative z-10",
              authMode === "REGISTER" ? "text-slate-900 dark:text-slate-100" : "text-slate-500 hover:text-slate-300"
            )}
          >
            {authMode === "REGISTER" && (
              <motion.div
                layoutId="activeAuthMode"
                className="absolute inset-0 bg-white dark:bg-white/[0.05] border border-slate-200/40 dark:border-white/[0.06] rounded-[8px] -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            Register
          </button>
        </div>
      )}

      {/* Container wrapper for layered depth elements behind the card */}
      <div className="relative group">
        
        {/* Depth Orb (5% opacity) */}
        <div className="absolute top-[-20px] left-[-30px] w-48 h-48 bg-gradient-to-br from-indigo-500 to-[#3B2EFF] rounded-full blur-[80px] opacity-[0.03] dark:opacity-[0.05] pointer-events-none" />

        {/* Depth Thin Ring (5% opacity) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] rounded-full border border-slate-900/5 dark:border-white/5 opacity-5 pointer-events-none" />

        {/* Depth Rotating Wireframe (5% opacity) */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center opacity-5"
        >
          <svg className="w-[380px] h-[380px] text-slate-900 dark:text-white" viewBox="0 0 100 100">
            <rect x="15" y="15" width="70" height="70" rx="12" fill="none" stroke="currentColor" strokeWidth="0.1" />
            <polygon points="50,15 85,50 50,85 15,50" fill="none" stroke="currentColor" strokeWidth="0.08" />
          </svg>
        </motion.div>

        {/* ── Main Glass Authentication Panel (Floats 3px, 22s duration) ─────── */}
        <motion.div
          animate={{
            y: [-3, 3, -3],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-[40px] p-8 rounded-[32px] border border-white/40 dark:border-white/[0.08] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] relative overflow-hidden z-10 transition-all duration-300"
        >
          {/* Glass sweep reflection layer (sweeps every 15s) */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.05] dark:opacity-8 z-20"
            style={{
              background: "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)",
              backgroundSize: "200% 100%",
            }}
          >
            <motion.div
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              className="w-full h-full"
              style={{
                background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.08) 50%, transparent 65%)",
              }}
            />
          </div>

          <AnimatePresence mode="wait">
            {/* STUDENT LOGIN */}
            {accountType === "STUDENT" && (
              <motion.form
                key="student-login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleStudentSubmit(onStudentLogin)}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Student Sign In</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Sign in with your official university credentials.
                  </p>
                </div>

                {/* Email Input */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#4F8CFF] transition-colors z-10">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    placeholder="SRM Email Address"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#4F8CFF]/50 focus:ring-2 focus:ring-[#4F8CFF]/5 dark:focus:ring-[#4F8CFF]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStudent("email")}
                  />
                  {studentErrors.email && (
                    <p className="text-[10px] text-rose-500 mt-1 pl-2">{studentErrors.email.message}</p>
                  )}
                </div>

                {/* Register Number Input */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#4F8CFF] transition-colors z-10">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Register Number"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#4F8CFF]/50 focus:ring-2 focus:ring-[#4F8CFF]/5 dark:focus:ring-[#4F8CFF]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStudent("registerNumber")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {studentErrors.registerNumber && (
                    <p className="text-[10px] text-rose-500 mt-1 pl-2">{studentErrors.registerNumber.message}</p>
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
                transition={{ duration: 0.2 }}
                onSubmit={handleStaffLoginSubmit(onStaffLogin)}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Staff Sign In</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Coordinator / Tutor console access.
                  </p>
                </div>

                {/* Email Input */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    placeholder="Staff Email"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStaffLogin("email")}
                  />
                  {staffLoginErrors.email && (
                    <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffLoginErrors.email.message}</p>
                  )}
                </div>

                {/* Password Input */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStaffLogin("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {staffLoginErrors.password && (
                    <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffLoginErrors.password.message}</p>
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
                transition={{ duration: 0.2 }}
                onSubmit={handleStaffRegisterSubmit(onStaffRegister)}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Create Staff Account</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Register with your official SRMist email and valid Invite Code.
                  </p>
                </div>

                {/* Invite Code */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                    <KeyRound className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Invite Code (e.g. ELC-CC-...)"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStaffForm("inviteCode")}
                  />
                  {staffRegisterErrors.inviteCode && (
                    <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffRegisterErrors.inviteCode.message}</p>
                  )}
                </div>

                {/* Employee ID & Full Name (Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                      <Barcode className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      placeholder="Employee ID"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium"
                      disabled={authState !== "idle"}
                      {...registerStaffForm("employeeId")}
                    />
                    {staffRegisterErrors.employeeId && (
                      <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffRegisterErrors.employeeId.message}</p>
                    )}
                  </div>

                  <div className="space-y-1 relative group/input">
                     <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                       <User className="w-3.5 h-3.5" />
                     </div>
                     <input
                       type="text"
                       placeholder="Full Name"
                       className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium"
                       disabled={authState !== "idle"}
                       {...registerStaffForm("name")}
                     />
                     {staffRegisterErrors.name && (
                       <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffRegisterErrors.name.message}</p>
                     )}
                  </div>
                </div>

                {/* SRM Email */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    placeholder="yourname@srmist.edu.in"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium"
                    disabled={authState !== "idle"}
                    {...registerStaffForm("email")}
                  />
                  {staffRegisterErrors.email && (
                    <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffRegisterErrors.email.message}</p>
                  )}
                </div>

                {/* Faculty Selector */}
                <div className="space-y-1 relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                    <Building className="w-3.5 h-3.5" />
                  </div>
                  <select
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-xs text-slate-950 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium appearance-none cursor-pointer"
                    disabled={authState !== "idle"}
                    {...registerStaffForm("faculty")}
                  >
                    <option value="">Select Faculty</option>
                    {hierarchy.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
                  {staffRegisterErrors.faculty && (
                    <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffRegisterErrors.faculty.message}</p>
                  )}
                </div>

                {/* Department & Degree (Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                      <UserCog className="w-3.5 h-3.5" />
                    </div>
                    <select
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-xs text-slate-950 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium appearance-none cursor-pointer"
                      disabled={authState !== "idle" || !selectedFacultyId}
                      {...registerStaffForm("department")}
                    >
                      <option value="">Select Department</option>
                      {currentDepts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
                    {staffRegisterErrors.department && (
                      <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffRegisterErrors.department.message}</p>
                    )}
                  </div>

                  <div className="space-y-1 relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                      <GraduationCap className="w-3.5 h-3.5" />
                    </div>
                    <select
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-xs text-slate-950 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium appearance-none cursor-pointer"
                      disabled={authState !== "idle" || !selectedDeptId}
                      {...registerStaffForm("degree")}
                    >
                      <option value="">Select Programme</option>
                      {currentProgs.map(p => (
                        <option key={p.id} value={p.id}>{p.code}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
                    {staffRegisterErrors.degree && (
                      <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffRegisterErrors.degree.message}</p>
                    )}
                  </div>
                </div>

                {/* Role Radio Picker */}
                <div className="space-y-2 pt-1 flex items-center justify-between border-t border-slate-100 dark:border-white/[0.05] pt-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Role Type</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold block">Must match invite code</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        value="CLASS_TUTOR"
                        className="w-3.5 h-3.5 text-indigo-500 border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-slate-900 focus:ring-indigo-500/50"
                        disabled={authState !== "idle"}
                        {...registerStaffForm("role")}
                      />
                      Tutor
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        value="COURSE_COORDINATOR"
                        className="w-3.5 h-3.5 text-indigo-500 border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-slate-900 focus:ring-indigo-500/50"
                        disabled={authState !== "idle"}
                        {...registerStaffForm("role")}
                      />
                      Coordinator
                    </label>
                  </div>
                </div>

                {/* Section Selector (Only for CLASS_TUTOR) */}
                {selectedRole === "CLASS_TUTOR" && (
                  <div className="space-y-1 relative group/input animate-[fadeIn_0.2s_ease-out_1]">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <select
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-xs text-slate-950 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium appearance-none cursor-pointer"
                      disabled={authState !== "idle"}
                      {...registerStaffForm("section")}
                    >
                      <option value="">Select Section</option>
                      {currentSections.map(s => (
                        <option key={s.id} value={s.label}>Section {s.label}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
                    {staffRegisterErrors.section && (
                      <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffRegisterErrors.section.message}</p>
                    )}
                  </div>
                )}

                {/* Password & Confirm Password (Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium"
                      disabled={authState !== "idle"}
                      {...registerStaffForm("password")}
                    />
                    {staffRegisterErrors.password && (
                      <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffRegisterErrors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-1 relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-[#6D5DFE] transition-colors z-10">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/60 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#6D5DFE]/50 focus:ring-2 focus:ring-[#6D5DFE]/5 dark:focus:ring-[#6D5DFE]/10 hover:border-slate-300 dark:hover:border-white/10 transition-all font-medium"
                      disabled={authState !== "idle"}
                      {...registerStaffForm("confirmPassword")}
                    />
                    {staffRegisterErrors.confirmPassword && (
                      <p className="text-[10px] text-rose-500 mt-1 pl-2">{staffRegisterErrors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <AuthSubmitButton authState={authState} progress={authProgress} label="Create Account" />
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
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
      className="w-full relative py-3 px-6 rounded-xl bg-gradient-to-r from-[#4F8CFF] to-[#6D5DFE] text-slate-100 text-xs font-bold shadow-[0_10px_35px_rgba(99,102,241,0.25)] hover:shadow-[0_15px_40px_rgba(99,102,241,0.4)] disabled:opacity-90 overflow-hidden select-none transition-all flex items-center justify-center"
      whileHover={{ scale: authState === "idle" ? 1.01 : 1 }}
      whileTap={{ scale: authState === "idle" ? 0.98 : 1 }}
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
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-200">
              Authenticating...
            </div>
            {/* SaaS Progress Bar design: [■■■■■■░░░░] */}
            <div className="flex items-center gap-1 font-mono text-[9px] text-slate-400">
              <span>[</span>
              {Array.from({ length: 10 }).map((_, idx) => {
                const step = idx * 10;
                const isFilled = progress >= step;
                return (
                  <span
                    key={idx}
                    className={cn(
                      "inline-block w-1.5 h-2.5 transition-colors",
                      isFilled ? "bg-cyan-400" : "bg-white/10"
                    )}
                  />
                );
              })}
              <span>]</span>
              <span className="ml-1 text-cyan-400 font-bold">{Math.min(100, progress)}%</span>
            </div>
          </motion.div>
        )}

        {authState === "verified" && (
          <motion.div
            key="verified"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-emerald-400"
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
            className="text-rose-400 font-extrabold text-xs uppercase tracking-wider"
          >
            Failed
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
