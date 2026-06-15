"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { facultyLogin } from "@/app/actions/auth";
import { GlassCard } from "@/components/premium/glass-card";
import { PremiumInput } from "@/components/premium/premium-input";
import { PremiumButton } from "@/components/premium/premium-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import HeroGeometric from "@/components/premium/hero-geometric";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function FacultyLoginPage() {
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
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    const result = await facultyLogin({
      email: data.email.toLowerCase().trim(),
      passwordHash: data.password,
    });

    if (result.success) {
      toast.success("Authentication successful! Welcome to the Admin Console.");
      router.push("/faculty/dashboard");
      router.refresh();
    } else {
      setIsSubmitting(false);
      toast.error(result.error || "Invalid credentials.");
    }
  };

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Header Utilities */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
        <ThemeToggle />
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-buttons hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all"
        >
          Student Portal
        </Link>
      </div>

      <HeroGeometric
        title1="Administrative Gateway"
        title2="Electify Admin"
        description="Secure Faculty and Administrator Console. Monitor seat utilization, verify student rosters, configure registration windows, and export reports."
        color1="#0891b2"
        color2="#67e8f9"
        speed={0.8}
      >
        <div className="w-full max-w-md">
          {/* Auth Glass Card */}
          <GlassCard glow="cyan" hoverEffect={false} className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-2xl rounded-cards p-8 relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-500/10 to-transparent blur-xl rounded-full pointer-events-none" />
            
            <div className="space-y-1 mb-6 text-center lg:text-left">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sign In to Console</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify your credentials to manage registrations
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <PremiumInput
                id="email"
                type="email"
                label="Administrative Email"
                placeholder="faculty@electify.edu"
                icon={<Mail className="w-4 h-4" />}
                error={errors.email?.message}
                disabled={isSubmitting}
                {...register("email")}
              />

              <div className="relative">
                <PremiumInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  label="Security Password"
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  error={errors.password?.message}
                  disabled={isSubmitting}
                  {...register("password")}
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
                variant="accent"
                size="lg"
                className="w-full mt-4"
                isLoading={isSubmitting}
              >
                Verify Credentials <ArrowRight className="w-4 h-4 ml-2" />
              </PremiumButton>
            </form>
          </GlassCard>
        </div>
      </HeroGeometric>
    </main>
  );
}
