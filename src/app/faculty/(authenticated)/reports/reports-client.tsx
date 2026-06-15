"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileSpreadsheet, FileText, BarChart3, Calendar, Clock, Inbox } from "lucide-react";
import * as XLSX from "xlsx";
import { GlassCard } from "@/components/premium/glass-card";
import { PremiumButton } from "@/components/premium/premium-button";
import { AnimatedCounter } from "@/components/premium/animated-counter";

interface RegistrationRecord {
  id: string;
  studentName: string;
  registerNumber: string;
  elective1: string;
  elective2: string;
  timestamp: Date;
}

interface ReportsClientProps {
  records: RegistrationRecord[];
}

export function ReportsClient({ records }: ReportsClientProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  // Stats computation
  const stats = React.useMemo(() => {
    const totalSubmissions = records.length;
    const latestTimestamp = records.length > 0
      ? new Date(Math.max(...records.map(r => new Date(r.timestamp).getTime()))).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A";

    return {
      totalSubmissions,
      latestTimestamp,
    };
  }, [records]);

  // Filter records
  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      const query = searchQuery.toLowerCase();
      return (
        r.studentName.toLowerCase().includes(query) ||
        r.registerNumber.toLowerCase().includes(query) ||
        r.elective1.toLowerCase().includes(query) ||
        r.elective2.toLowerCase().includes(query)
      );
    });
  }, [records, searchQuery]);

  // CSV Export
  const handleCSVExport = () => {
    if (filteredRecords.length === 0) return;

    const headers = ["Student Name", "Register Number", "Elective Group 1", "Elective Group 2", "Submission Timestamp"];
    const rows = filteredRecords.map((r) => [
      r.studentName,
      r.registerNumber,
      r.elective1,
      r.elective2,
      new Date(r.timestamp).toLocaleString("en-US"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `electify_registrations_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Excel Export
  const handleExcelExport = () => {
    if (filteredRecords.length === 0) return;

    const wsData = filteredRecords.map((r) => ({
      "Student Name": r.studentName,
      "Register Number": r.registerNumber,
      "Elective Group 1": r.elective1,
      "Elective Group 2": r.elective2,
      "Submission Timestamp": new Date(r.timestamp).toLocaleString("en-US"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(wsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");
    
    XLSX.writeFile(workbook, `electify_registrations_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      
      {/* Search and Export Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search registrations by Student, Register No, or course title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 md:h-11 pl-10 pr-4 rounded-inputs text-base md:text-xs font-semibold border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950/20 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          />
        </div>

        {/* Export triggers */}
        <div className="flex gap-2 w-full sm:w-auto">
          <PremiumButton
            onClick={handleCSVExport}
            disabled={filteredRecords.length === 0}
            variant="outline"
            className="flex-1 sm:flex-initial h-12 md:h-11 px-4 text-xs font-bold flex items-center justify-center gap-2 border-slate-200 shadow-sm"
          >
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Export CSV
          </PremiumButton>

          <PremiumButton
            onClick={handleExcelExport}
            disabled={filteredRecords.length === 0}
            variant="primary"
            className="flex-1 sm:flex-initial h-12 md:h-11 px-4 text-xs font-bold shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </PremiumButton>
        </div>
      </div>

      {/* KPI Stats overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-buttons bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/15">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Registrations Logged</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.totalSubmissions} />
            </span>
          </div>
        </GlassCard>

        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-buttons bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/15">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Latest Submission</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              {stats.latestTimestamp}
            </span>
          </div>
        </GlassCard>

        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-buttons bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/15">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Report Status</span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-500 dark:text-emerald-400 tracking-tight mt-1 block">
              Ready for Download
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Reports Data Grid Glass Card */}
      <GlassCard hoverEffect={false} className="border-white/10 p-0 overflow-hidden">
        <div className="p-4 sm:p-8 border-b border-slate-200/60 dark:border-slate-800/60">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-indigo-500" /> Enrollment Records
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mt-1 font-semibold">
            Real-time spreadsheet configurations of choices submitted by students.
          </p>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-[20%] left-[40%] w-[20%] h-[20%] rounded-full bg-indigo-500/5 blur-[50px] pointer-events-none" />
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
              <Inbox className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">No Records Found</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1 max-w-sm">
              No registration logs found matching your criteria. Try adjusting your search query filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto table-scroll-container">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-100/50 dark:bg-slate-900/30">
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] w-48 pl-6">Student Name</TableHead>
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] w-40">Register Number</TableHead>
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">Elective Group 1</TableHead>
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">Elective Group 2</TableHead>
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] w-52 pr-6">Registered At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id} className="border-b border-slate-200/50 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <TableCell className="font-bold text-slate-800 dark:text-slate-200 pl-6 py-4.5">
                      {record.studentName}
                    </TableCell>
                    <TableCell className="font-extrabold text-slate-700 dark:text-slate-300">
                      {record.registerNumber}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {record.elective1}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-violet-600 dark:text-violet-400">
                      {record.elective2}
                    </TableCell>
                    <TableCell className="text-slate-500 dark:text-slate-400 text-xs font-semibold pr-6 py-4.5">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {new Date(record.timestamp).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        <div className="bg-slate-50/50 dark:bg-slate-950/20 px-6 py-4 flex justify-between border-t border-slate-200/60 dark:border-slate-800/60">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">
            Showing {filteredRecords.length} of {records.length} registrations
          </span>
        </div>
      </GlassCard>
    </div>
  );
}
