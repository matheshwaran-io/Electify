"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { studentLogin } from "@/app/actions/auth";
import { GlassCard } from "@/components/premium/glass-card";
import { PremiumInput } from "@/components/premium/premium-input";
import { PremiumButton } from "@/components/premium/premium-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import HeroGeometric from "@/components/premium/hero-geometric";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .refine(
      (email) => email.toLowerCase().endsWith("@srmist.edu.in"),
      "Must be an official @srmist.edu.in email address"
    ),
  registerNumber: z
    .string()
    .min(1, "Register number is required")
    .regex(/^[a-zA-Z0-9]+$/, "Register number must be alphanumeric"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function StudentLoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      registerNumber: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    const result = await studentLogin({
      email: data.email.toLowerCase().trim(),
      registerNumber: data.registerNumber.toUpperCase().trim(),
    });

    if (result.success) {
      toast.success("Welcome back! Logging in...");
      router.push("/dashboard");
      router.refresh();
    } else {
      setIsSubmitting(false);
      toast.error(result.error || "Authentication failed.");
    }
  };

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Header Utility Controls */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
        <ThemeToggle />
        <Link
          href="/faculty/login"
          className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-buttons hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all"
        >
          Faculty Console
        </Link>
      </div>

      <HeroGeometric
        title1="MCA F Batch 2026"
        title2="Electify Portal"
        description="Smart Elective Selection Portal. Access elective selections, check real-time seat distributions, and verify your registrations."
        color1="#4f46e5"
        color2="#818cf8"
        speed={0.8}
      >
        <div className="w-full max-w-md">
          {/* Auth Glass Card */}
          <GlassCard glow="indigo" hoverEffect={false} className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-2xl rounded-cards p-8 relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent blur-xl rounded-full pointer-events-none" />
            
            <div className="space-y-1 mb-6 text-center lg:text-left">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Student Sign In</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Access the portal using your official SRM credentials
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <PremiumInput
                id="email"
                type="email"
                label="SRM Email Address"
                placeholder="name@srmist.edu.in"
                icon={<Mail className="w-4 h-4" />}
                error={errors.email?.message}
                disabled={isSubmitting}
                {...register("email")}
              />

              <div className="relative">
                <PremiumInput
                  id="registerNumber"
                  type={showPassword ? "text" : "password"}
                  label="Register Number"
                  placeholder="RA2532241010001"
                  icon={<Lock className="w-4 h-4" />}
                  error={errors.registerNumber?.message}
                  disabled={isSubmitting}
                  {...register("registerNumber")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-[26px] w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <PremiumButton
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-4"
                isLoading={isSubmitting}
              >
                Sign In <ArrowRight className="w-4 h-4 ml-2" />
              </PremiumButton>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center">
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                * Verification uses Register Number as password. If registration window is locked, contact the MCA program office.
              </p>
            </div>
          </GlassCard>
        </div>
      </HeroGeometric>
    </main>
  );
}
