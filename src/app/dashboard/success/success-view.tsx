"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PremiumButton } from "@/components/premium/premium-button";
import { GlassCard } from "@/components/premium/glass-card";
import { Check, Printer, Edit, LogOut, FileCheck2, Calendar, User, Mail, Hash } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { toast } from "sonner";

interface SuccessViewProps {
  student: {
    name: string;
    registerNumber: string;
    email: string;
  };
  registration: {
    submittedAt: Date;
    electiveGroup1: { name: string };
    electiveGroup2: { name: string };
  };
  allowRegistrationEdit: boolean;
}

export function SuccessView({
  student,
  registration,
  allowRegistrationEdit,
}: SuccessViewProps) {
  const router = useRouter();

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Successfully logged out.");
    router.push("/login");
    router.refresh();
  };

  const formattedDate = React.useMemo(() => {
    return new Date(registration.submittedAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [registration.submittedAt]);

  return (
    <div className="w-full max-w-xl z-10 print:shadow-none print:max-w-full print:p-0">
      <GlassCard
        glow="indigo"
        hoverEffect={false}
        className="p-0 border-white/10 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 rounded-cards overflow-hidden print:bg-white print:text-black print:border-none print:shadow-none"
      >
        {/* Confirmed Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-950/40 dark:to-violet-950/40 p-8 text-center border-b border-indigo-500/10 print:bg-none print:text-black print:border-b-2 print:border-slate-300">
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/15 dark:bg-indigo-500/20 text-white mb-3 border border-white/20 shadow-lg"
          >
            <Check className="w-7 h-7 print:text-black" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl sm:text-3xl font-extrabold text-white dark:text-indigo-400 tracking-tight print:text-black"
          >
            Registration Confirmed
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 0.3 }}
            className="text-white/80 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-widest mt-1.5 print:text-black print:font-bold"
          >
            Official SRMIST MCA Registration Receipt
          </motion.p>
        </div>

        <div className="p-6 sm:p-8 space-y-6 print:p-0 print:mt-6">
          {/* Student details */}
          <div className="pb-5 border-b border-slate-200/60 dark:border-slate-800/60 print:border-slate-300">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 print:text-slate-600">
              Student Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2.5 p-3 rounded-buttons bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/40 dark:border-slate-800/30 print:bg-none print:border-none print:p-0">
                <User className="w-4 h-4 text-indigo-500 shrink-0 print:hidden" />
                <div>
                  <span className="text-[10px] block text-slate-400 uppercase font-bold tracking-wider leading-none">Full Name</span>
                  <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mt-1 block print:text-black">{student.name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-buttons bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/40 dark:border-slate-800/30 print:bg-none print:border-none print:p-0">
                <Hash className="w-4 h-4 text-indigo-500 shrink-0 print:hidden" />
                <div>
                  <span className="text-[10px] block text-slate-400 uppercase font-bold tracking-wider leading-none">Register Number</span>
                  <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mt-1 block print:text-black">{student.registerNumber}</span>
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2 flex items-center gap-2.5 p-3 rounded-buttons bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/40 dark:border-slate-800/30 print:bg-none print:border-none print:p-0">
                <Mail className="w-4 h-4 text-indigo-500 shrink-0 print:hidden" />
                <div>
                  <span className="text-[10px] block text-slate-400 uppercase font-bold tracking-wider leading-none">SRM Email Address</span>
                  <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mt-1 block print:text-black">{student.email}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Registered electives details */}
          <div className="space-y-4 pb-5 border-b border-slate-200/60 dark:border-slate-800/60 print:border-slate-300">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 print:text-slate-600">
              Selected Electives
            </h3>
            
            <div className="flex gap-3.5 items-start p-4 bg-indigo-500/5 dark:bg-indigo-950/10 border border-indigo-500/15 rounded-cards print:bg-none print:border-slate-200">
              <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-buttons print:hidden border border-indigo-500/10">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Elective Group 1</span>
                <p className="font-extrabold text-base text-slate-800 dark:text-slate-200 mt-1 print:text-black">{registration.electiveGroup1.name}</p>
              </div>
            </div>

            <div className="flex gap-3.5 items-start p-4 bg-indigo-500/5 dark:bg-indigo-950/10 border border-indigo-500/15 rounded-cards print:bg-none print:border-slate-200">
              <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-buttons print:hidden border border-indigo-500/10">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Elective Group 2</span>
                <p className="font-extrabold text-base text-slate-800 dark:text-slate-200 mt-1 print:text-black">{registration.electiveGroup2.name}</p>
              </div>
            </div>
          </div>

          {/* Submitted date */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">
            <Calendar className="w-4 h-4 text-indigo-500 print:text-black" /> Submitted On: <span className="text-slate-800 dark:text-slate-200 print:text-black">{formattedDate}</span>
          </div>
        </div>

        {/* Footer controls */}
        <div className="bg-slate-50/50 dark:bg-slate-900/30 px-6 py-4 flex flex-col sm:flex-row gap-3 border-t border-slate-200/60 dark:border-slate-800/60 print:hidden">
          <PremiumButton
            onClick={handlePrint}
            variant="primary"
            className="w-full sm:w-auto shadow-md shadow-indigo-500/10"
          >
            <Printer className="w-4 h-4 mr-2" /> Print Receipt
          </PremiumButton>

          {allowRegistrationEdit && (
            <PremiumButton
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="w-full sm:w-auto"
            >
              <Edit className="w-4 h-4 mr-2" /> Edit Selection
            </PremiumButton>
          )}

          <div className="sm:ml-auto w-full sm:w-auto">
            <PremiumButton
              variant="ghost"
              onClick={handleLogout}
              className="w-full sm:w-auto text-slate-500 hover:text-rose-500 hover:bg-rose-500/10"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </PremiumButton>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
