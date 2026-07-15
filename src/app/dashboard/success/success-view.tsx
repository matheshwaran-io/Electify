"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PremiumButton } from "@/components/premium/premium-button";
import { Printer, Edit, LogOut, CheckCircle2 } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { toast } from "sonner";
import Image from "next/image";

interface SuccessViewProps {
  student: {
    name: string;
    registerNumber: string;
    email: string;
    department?: string;
    degree?: string;
    section?: string;
  };
  event: {
    name: string;
  };
  registrations: {
    groupName: string;
    electiveName: string;
    submittedAt: Date;
  }[];
  allowRegistrationEdit: boolean;
  receiptNumber?: string;
}

export function SuccessView({
  student,
  event,
  registrations,
  allowRegistrationEdit,
  receiptNumber,
}: SuccessViewProps) {
  const router = useRouter();

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Successfully logged out.");
    router.push("/login");
  };

  const formattedDate = React.useMemo(() => {
    if (registrations.length === 0) return "";
    const latest = new Date(Math.max(...registrations.map(r => new Date(r.submittedAt).getTime())));
    return latest.toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    });
  }, [registrations]);

  return (
    <div className="w-full max-w-2xl mx-auto z-10 print:max-w-full print:w-full">
      {/* Web Controls Header - Hidden on Print */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 print:hidden">
        <h1 className="text-xl font-medium text-slate-900 dark:text-white">Registration Receipt</h1>
        <div className="grid grid-cols-2 sm:flex items-center gap-3 w-full sm:w-auto">
          {allowRegistrationEdit && (
            <PremiumButton variant="outline" onClick={() => router.push("/dashboard")} className="w-full sm:w-auto col-span-2 sm:col-span-1 justify-center">
              <Edit className="w-4 h-4 mr-2" /> Edit Selections
            </PremiumButton>
          )}
          <PremiumButton variant="primary" onClick={handlePrint} className="w-full sm:w-auto justify-center">
            <Printer className="w-4 h-4 mr-2" /> Print
          </PremiumButton>
          <PremiumButton variant="ghost" onClick={handleLogout} className="w-full sm:w-auto justify-center text-slate-500 border border-slate-200 dark:border-white/10 sm:border-0">
            <LogOut className="w-4 h-4 mr-2 sm:mr-0" /> <span className="sm:hidden">Logout</span>
          </PremiumButton>
        </div>
      </div>

      {/* Printable Document Container */}
      <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-md overflow-hidden shadow-sm print:shadow-none print:border-none print:bg-white text-slate-900 dark:text-slate-200 print:text-black">
        
        {/* Document Header */}
        <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-white/10 print:border-black/20 flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-2 print:bg-black print:text-white print:border print:border-black">
              <Image src="/logo.png" alt="Electify Logo" width={32} height={32} className="w-full h-full object-contain invert dark:invert-0 print:invert" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white print:text-black">Electify</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 print:text-slate-600">SRMIST Elective Management</p>
            </div>
          </div>
          <div className="text-left sm:text-right flex flex-col items-start sm:items-end w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-white/5 print:border-0">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 print:text-emerald-700 font-medium">
              <CheckCircle2 className="w-5 h-5" />
              <span>Confirmed</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 print:text-slate-600">{formattedDate}</p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8 sm:space-y-10">
          
          {/* Official Document Title */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-xl font-medium mb-1">Official Registration Receipt</h2>
              {receiptNumber && (
                <span className="text-xs font-mono bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-1 rounded-md text-[var(--muted-foreground)]">
                  {receiptNumber}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 print:text-slate-600">Event: {event.name}</p>
          </div>

          {/* Student Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider print:text-slate-500 border-b border-slate-100 dark:border-white/5 print:border-slate-200 pb-2">
              Student Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Full Name</p>
                <p className="text-sm font-medium">{student.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Register Number</p>
                <p className="text-sm font-medium">{student.registerNumber}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Email Address</p>
                <p className="text-sm font-medium">{student.email}</p>
              </div>
              {student.department && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Department</p>
                  <p className="text-sm font-medium">{student.department}</p>
                </div>
              )}
              {student.degree && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Degree</p>
                  <p className="text-sm font-medium">{student.degree}</p>
                </div>
              )}
              {student.section && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Section</p>
                  <p className="text-sm font-medium">{student.section}</p>
                </div>
              )}
            </div>
          </div>

          {/* Registered Electives */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider print:text-slate-500 border-b border-slate-100 dark:border-white/5 print:border-slate-200 pb-2">
              Selected Electives
            </h3>
            
            <div className="mt-4 flex flex-col gap-4">
              {registrations.map((reg, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-100 dark:border-white/5 print:border-slate-100 pb-4 last:border-0 last:pb-0 gap-1 sm:gap-4">
                  <div className="w-full sm:w-1/3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-normal sm:hidden mb-1">Elective Group</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 print:text-slate-700">{reg.groupName}</p>
                  </div>
                  <div className="flex-1 mt-1 sm:mt-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-normal sm:hidden mb-1">Course Selection</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white print:text-black">{reg.electiveName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signatures (Print Only) */}
          <div className="hidden print:flex justify-between items-end mt-24 pt-8">
            <div className="w-48 text-center border-t border-black/40 pt-2">
              <p className="text-xs text-slate-600">Student Signature</p>
            </div>
            <div className="w-48 text-center border-t border-black/40 pt-2">
              <p className="text-xs text-slate-600">Authorized Signatory</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-[#0a0a0a] border-t border-slate-200 dark:border-white/10 print:bg-white print:border-black/20 text-center text-xs text-slate-500 print:text-slate-500">
          This document is computer generated and valid for the <strong>{event.name}</strong> registration event.
        </div>
      </div>
    </div>
  );
}
