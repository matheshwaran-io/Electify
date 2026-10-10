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
        <h1 className="text-xl font-medium text-fg">Registration Receipt</h1>
        <div className="grid grid-cols-2 sm:flex items-center gap-3 w-full sm:w-auto">
          {allowRegistrationEdit && (
            <PremiumButton variant="outline" onClick={() => router.push("/dashboard")} className="w-full sm:w-auto col-span-2 sm:col-span-1 justify-center">
              <Edit className="w-4 h-4 mr-2" /> Edit Selections
            </PremiumButton>
          )}
          <PremiumButton variant="primary" onClick={handlePrint} className="w-full sm:w-auto justify-center">
            <Printer className="w-4 h-4 mr-2" /> Print
          </PremiumButton>
          <PremiumButton variant="ghost" onClick={handleLogout} className="w-full sm:w-auto justify-center text-fg-muted border border-border sm:border-0">
            <LogOut className="w-4 h-4 mr-2 sm:mr-0" /> <span className="sm:hidden">Logout</span>
          </PremiumButton>
        </div>
      </div>

      {/* Printable Document Container */}
      <div className="bg-surface border border-border rounded-badge overflow-hidden shadow-1 print:shadow-none print:border-none print:bg-surface text-fg print:text-fg">
        
        {/* Document Header */}
        <div className="p-6 sm:p-8 border-b border-border print:border-border-strong flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-control bg-surface border border-border p-1.5">
              <Image src="/logo.png" alt="Electify Logo" width={32} height={32} className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-fg print:text-fg">Electify</h1>
              <p className="text-sm text-fg-muted print:text-fg-muted">SRMIST Elective Management</p>
            </div>
          </div>
          <div className="text-left sm:text-right flex flex-col items-start sm:items-end w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-border print:border-0">
            <div className="flex items-center gap-1.5 text-success-text print:text-success-text font-medium">
              <CheckCircle2 className="w-5 h-5" />
              <span>Confirmed</span>
            </div>
            <p className="text-xs text-fg-muted mt-1 print:text-fg-muted">{formattedDate}</p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8 sm:space-y-10">
          
          {/* Official Document Title */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-xl font-medium mb-1">Official Registration Receipt</h2>
              {receiptNumber && (
                <span className="text-xs font-mono bg-surface-2 border border-border px-2.5 py-1 rounded-badge text-fg-muted">
                  {receiptNumber}
                </span>
              )}
            </div>
            <p className="text-sm text-fg-muted print:text-fg-muted">Event: {event.name}</p>
          </div>

          {/* Student Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wider print:text-fg-muted border-b border-border print:border-border pb-2">
              Student Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-2xs text-fg-muted uppercase tracking-wider mb-1">Full Name</p>
                <p className="text-sm font-medium">{student.name}</p>
              </div>
              <div>
                <p className="text-2xs text-fg-muted uppercase tracking-wider mb-1">Register Number</p>
                <p className="text-sm font-medium">{student.registerNumber}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-2xs text-fg-muted uppercase tracking-wider mb-1">Email Address</p>
                <p className="text-sm font-medium">{student.email}</p>
              </div>
              {student.department && (
                <div>
                  <p className="text-2xs text-fg-muted uppercase tracking-wider mb-1">Department</p>
                  <p className="text-sm font-medium">{student.department}</p>
                </div>
              )}
              {student.degree && (
                <div>
                  <p className="text-2xs text-fg-muted uppercase tracking-wider mb-1">Degree</p>
                  <p className="text-sm font-medium">{student.degree}</p>
                </div>
              )}
              {student.section && (
                <div>
                  <p className="text-2xs text-fg-muted uppercase tracking-wider mb-1">Section</p>
                  <p className="text-sm font-medium">{student.section}</p>
                </div>
              )}
            </div>
          </div>

          {/* Registered Electives */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wider print:text-fg-muted border-b border-border print:border-border pb-2">
              Selected Electives
            </h3>
            
            <div className="mt-4 flex flex-col gap-4">
              {registrations.map((reg, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-border print:border-border pb-4 last:border-0 last:pb-0 gap-1 sm:gap-4">
                  <div className="w-full sm:w-1/3">
                    <p className="text-2xs text-fg-muted uppercase tracking-wider font-normal sm:hidden mb-1">Elective Group</p>
                    <p className="text-sm font-medium text-fg-muted print:text-fg-muted">{reg.groupName}</p>
                  </div>
                  <div className="flex-1 mt-1 sm:mt-0">
                    <p className="text-2xs text-fg-muted uppercase tracking-wider font-normal sm:hidden mb-1">Course Selection</p>
                    <p className="text-sm font-semibold text-fg print:text-fg">{reg.electiveName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signatures (Print Only) */}
          <div className="hidden print:flex justify-between items-end mt-24 pt-8">
            <div className="w-48 text-center border-t border-border-strong pt-2">
              <p className="text-xs text-fg-muted">Student Signature</p>
            </div>
            <div className="w-48 text-center border-t border-border-strong pt-2">
              <p className="text-xs text-fg-muted">Authorized Signatory</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-surface-2 border-t border-border print:bg-surface print:border-border-strong text-center text-xs text-fg-muted print:text-fg-muted">
          This document is computer generated and valid for the <strong>{event.name}</strong> registration event.
        </div>
      </div>
    </div>
  );
}
