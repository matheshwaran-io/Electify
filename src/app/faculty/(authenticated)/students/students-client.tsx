"use client";

import * as React from "react";
import { importStudents, toggleStudentActive, toggleStudentEligibility, resetStudentPassword, deleteStudent, createStudent, updateStudent } from "@/app/actions/students";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Upload, Search, ShieldAlert, KeyRound, Trash2, Loader2, FileDown, CheckCircle, Clock, ShieldCheck, Plus, Pencil } from "lucide-react";
import { GlassCard } from "@/components/premium/glass-card";
import { PremiumButton } from "@/components/premium/premium-button";
import { AnimatedCounter } from "@/components/premium/animated-counter";
import { PremiumInput } from "@/components/premium/premium-input";
import { useForm, Resolver, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface StudentInfo {
  id: string;
  name: string;
  registerNumber: string;
  email: string;
  isActive: boolean;
  isEligible: boolean;
  hasSubmitted: boolean;
}

interface StudentsClientProps {
  students: StudentInfo[];
}

const studentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  registerNumber: z.string().min(6, "Register number must be at least 6 characters"),
  email: z.string().email("Invalid email address").refine(
    (email) => email.toLowerCase().endsWith("@srmist.edu.in"),
    "Must be an official @srmist.edu.in email address"
  ),
  isEligible: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

type StudentFormValues = z.infer<typeof studentSchema>;

export function StudentsClient({ students }: StudentsClientProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isImporting, setIsImporting] = React.useState(false);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [activeStudent, setActiveStudent] = React.useState<StudentInfo | null>(null);
  const [isResetOpen, setIsResetOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isActionPending, setIsActionPending] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Forms
  const {
    register: registerAdd,
    handleSubmit: handleSubmitAdd,
    reset: resetAdd,
    control: controlAdd,
    formState: { errors: addErrors },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema) as unknown as Resolver<StudentFormValues>,
    defaultValues: { name: "", registerNumber: "", email: "", isEligible: true, isActive: true },
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    control: controlEdit,
    formState: { errors: editErrors },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema) as unknown as Resolver<StudentFormValues>,
    defaultValues: { name: "", registerNumber: "", email: "", isEligible: true, isActive: true },
  });

  // Populate edit form on active student change
  React.useEffect(() => {
    if (activeStudent && isEditOpen) {
      resetEdit({
        name: activeStudent.name,
        registerNumber: activeStudent.registerNumber,
        email: activeStudent.email,
        isEligible: activeStudent.isEligible,
        isActive: activeStudent.isActive,
      });
    }
  }, [activeStudent, isEditOpen, resetEdit]);

  // Stats computation
  const stats = React.useMemo(() => {
    const totalStudents = students.length;
    const eligibleCount = students.filter((s) => s.isEligible).length;
    const activeCount = students.filter((s) => s.isActive).length;
    const submittedCount = students.filter((s) => s.hasSubmitted).length;
    const submissionRate = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

    return {
      totalStudents,
      eligibleCount,
      activeCount,
      submittedCount,
      submissionRate,
    };
  }, [students]);

  // Search Filter
  const filteredStudents = React.useMemo(() => {
    return students.filter((s) => {
      const query = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.registerNumber.toLowerCase().includes(query)
      );
    });
  }, [students, searchQuery]);

  const onAddStudent = async (data: StudentFormValues) => {
    setIsActionPending(true);
    const response = await createStudent({
      name: data.name,
      registerNumber: data.registerNumber,
      email: data.email,
      isEligible: data.isEligible,
      isActive: data.isActive,
    });

    if (response.success) {
      toast.success(`Student "${data.name}" added successfully.`);
      resetAdd();
      setIsAddOpen(false);
    } else {
      toast.error(response.error || "Failed to add student.");
    }
    setIsActionPending(false);
  };

  const onEditStudent = async (data: StudentFormValues) => {
    if (!activeStudent) return;
    setIsActionPending(true);
    const response = await updateStudent(activeStudent.id, {
      name: data.name,
      registerNumber: data.registerNumber,
      email: data.email,
      isEligible: data.isEligible,
      isActive: data.isActive,
    });

    if (response.success) {
      toast.success(`Student "${data.name}" updated successfully.`);
      setIsEditOpen(false);
    } else {
      toast.error(response.error || "Failed to update student.");
    }
    setIsActionPending(false);
  };

  // CSV Parser
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;

      try {
        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
        if (lines.length < 2) {
          throw new Error("CSV file is empty or does not have data rows.");
        }

        // Parse headers
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const regIdx = headers.indexOf("registernumber");
        const nameIdx = headers.indexOf("name");
        const emailIdx = headers.indexOf("email");

        if (regIdx === -1 || nameIdx === -1 || emailIdx === -1) {
          throw new Error("CSV headers must contain: 'registerNumber', 'name', and 'email'.");
        }

        // Parse data rows
        const parsedList = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",").map((cell) => cell.trim());
          if (row.length < 3 || row.join("") === "") continue;

          parsedList.push({
            registerNumber: row[regIdx],
            name: row[nameIdx],
            email: row[emailIdx],
          });
        }

        if (parsedList.length === 0) {
          throw new Error("No valid student rows found in the CSV.");
        }

        // Trigger Server Action
        const result = await importStudents(parsedList);

        if (result.success) {
          toast.success(
            `Import Successful! Added: ${result.inserted || 0}, Updated: ${result.updated || 0} students.`
          );
        } else {
          toast.error(result.error || "Failed to import students.");
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : "Failed to parse CSV file.";
        toast.error(errMsg);
        console.error(error);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  };

  const handleToggleActive = async (student: StudentInfo, checked: boolean) => {
    const result = await toggleStudentActive(student.id, checked);
    if (result.success) {
      toast.success(`${student.name}'s login access is now ${checked ? "enabled" : "disabled"}.`);
    } else {
      toast.error(result.error || "Failed to update active status.");
    }
  };

  const handleToggleEligibility = async (student: StudentInfo, checked: boolean) => {
    const result = await toggleStudentEligibility(student.id, checked);
    if (result.success) {
      toast.success(`${student.name}'s eligibility is now ${checked ? "approved" : "revoked"}.`);
    } else {
      toast.error(result.error || "Failed to update eligibility status.");
    }
  };

  const handleResetPassword = async () => {
    if (!activeStudent) return;
    setIsActionPending(true);
    const result = await resetStudentPassword(activeStudent.id);

    if (result.success) {
      toast.success(`Password for ${activeStudent.name} reset to ${activeStudent.registerNumber}.`);
      setIsResetOpen(false);
    } else {
      toast.error(result.error || "Failed to reset password.");
    }
    setIsActionPending(false);
  };

  const handleDeleteStudent = async () => {
    if (!activeStudent) return;
    setIsActionPending(true);
    const result = await deleteStudent(activeStudent.id);

    if (result.success) {
      toast.success(`Student record for ${activeStudent.name} deleted.`);
      setIsDeleteOpen(false);
    } else {
      toast.error(result.error || "Failed to delete student.");
    }
    setIsActionPending(false);
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,registerNumber,name,email\nRA2532241010001,Student One,student1@srmist.edu.in\nRA2532241010002,Student Two,student2@srmist.edu.in";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "electify_student_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Search and upload actions bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[48px] pl-10 pr-4 rounded-inputs text-base md:text-xs font-semibold border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950/20 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <PremiumButton
            variant="outline"
            onClick={downloadTemplate}
            className="h-11 px-4 text-xs font-bold flex items-center gap-2 border-slate-200 shadow-sm"
          >
            <FileDown className="w-4 h-4" /> Download Template
          </PremiumButton>

          <PremiumButton
            variant="outline"
            className="h-11 px-5 text-xs font-bold flex items-center gap-2 relative overflow-hidden"
            isLoading={isImporting}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" /> Import CSV
          </PremiumButton>

          <PremiumButton
            variant="primary"
            onClick={() => setIsAddOpen(true)}
            className="h-11 px-5 text-xs font-bold shadow-lg shadow-indigo-500/10 flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 border-none"
          >
            <Plus className="w-4 h-4" /> Add Student
          </PremiumButton>
          
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            ref={fileInputRef}
            className="hidden"
            onChange={handleCSVUpload}
            disabled={isImporting}
          />
        </div>
      </div>

      {/* KPI Stats overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-buttons bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/15">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Intake Count</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.totalStudents} />
            </span>
          </div>
        </GlassCard>

        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-buttons bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/15">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Eligible Count</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.eligibleCount} />
            </span>
          </div>
        </GlassCard>

        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-buttons bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/15">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Active Logins</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.activeCount} />
            </span>
          </div>
        </GlassCard>

        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-buttons bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/15">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Submitted Count</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.submittedCount} />
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Directory Grid Glass Card */}
      <GlassCard hoverEffect={false} className="border-white/10 p-0 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-200/60 dark:border-slate-800/60">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-5 h-5 text-indigo-500" /> Student Directory
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mt-1 font-semibold">
            Import SRM class listings, manage registration eligibility status, and verify submission receipts.
          </p>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="text-center py-16 text-slate-400 font-bold text-sm">
            No students found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-100/50 dark:bg-slate-900/30">
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] w-36 pl-6">Register Number</TableHead>
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">Name</TableHead>
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">SRM Email</TableHead>
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] text-center w-28">Eligible</TableHead>
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] text-center w-28">Login Active</TableHead>
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] text-center w-28">Submitted</TableHead>
                  <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] text-right w-32 pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id} className="border-b border-slate-200/50 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <TableCell className="font-extrabold text-slate-800 dark:text-slate-200 pl-6 py-4.5">
                      {student.registerNumber}
                    </TableCell>
                    <TableCell className="font-bold text-slate-700 dark:text-slate-300">
                      {student.name}
                    </TableCell>
                    <TableCell className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
                      {student.email}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={student.isEligible}
                          onCheckedChange={(checked) => handleToggleEligibility(student, checked)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={student.isActive}
                          onCheckedChange={(checked) => handleToggleActive(student, checked)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {student.hasSubmitted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/10">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/10">
                          No
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4 py-3">
                      <div className="flex justify-end gap-1">
                        <PremiumButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActiveStudent(student);
                            setIsEditOpen(true);
                          }}
                          className="min-h-[44px] min-w-[44px] w-11 h-11 p-0 rounded-buttons text-slate-500 hover:text-indigo-500 hover:bg-indigo-500/10 border-none"
                          title="Edit Student"
                        >
                          <Pencil className="w-4 h-4" />
                        </PremiumButton>
                        <PremiumButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActiveStudent(student);
                            setIsResetOpen(true);
                          }}
                          className="min-h-[44px] min-w-[44px] w-11 h-11 p-0 rounded-buttons text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 border-none"
                          title="Reset Password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </PremiumButton>
                        <PremiumButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActiveStudent(student);
                            setIsDeleteOpen(true);
                          }}
                          className="min-h-[44px] min-w-[44px] w-11 h-11 p-0 rounded-buttons text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 border-none"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </PremiumButton>
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
            Showing {filteredStudents.length} of {students.length} student records
          </span>
        </div>
      </GlassCard>

      {/* 1. Add Student Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[425px] rounded-cards p-6 border border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-2xl">
          <form onSubmit={handleSubmitAdd(onAddStudent)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Add Student Record</DialogTitle>
              <DialogDescription className="text-xs text-slate-400 dark:text-slate-500 mt-1">Create a student profile manually in the SRM MCA elective directory.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <PremiumInput
                id="add-name"
                label="Full Name"
                placeholder="e.g. Mathesh R"
                error={addErrors.name?.message}
                disabled={isActionPending}
                {...registerAdd("name")}
              />

              <PremiumInput
                id="add-reg"
                label="SRM Register Number"
                placeholder="e.g. RA2532241010001"
                error={addErrors.registerNumber?.message}
                disabled={isActionPending}
                {...registerAdd("registerNumber")}
              />

              <PremiumInput
                id="add-email"
                type="email"
                label="Official SRM Email"
                placeholder="e.g. mr9820@srmist.edu.in"
                error={addErrors.email?.message}
                disabled={isActionPending}
                {...registerAdd("email")}
              />

              <div className="flex items-center justify-between p-3 rounded-buttons border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="space-y-0.5">
                  <label htmlFor="add-eligible" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Registration Eligible
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                    Allow student to select electives
                  </p>
                </div>
                <Controller
                  control={controlAdd}
                  name="isEligible"
                  render={({ field }) => (
                    <Switch
                      id="add-eligible"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isActionPending}
                    />
                  )}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-buttons border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="space-y-0.5">
                  <label htmlFor="add-active" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Login Active
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                    Allow student to log in to the portal
                  </p>
                </div>
                <Controller
                  control={controlAdd}
                  name="isActive"
                  render={({ field }) => (
                    <Switch
                      id="add-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isActionPending}
                    />
                  )}
                />
              </div>
            </div>

            <DialogFooter className="gap-3">
              <PremiumButton type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsAddOpen(false)}>
                Cancel
              </PremiumButton>
              <PremiumButton type="submit" variant="primary" disabled={isActionPending} className="w-full sm:w-auto shadow-lg shadow-indigo-500/10 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 border-none">
                {isActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Record"}
              </PremiumButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-cards p-6 border border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-2xl">
          <form onSubmit={handleSubmitEdit(onEditStudent)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Edit Student Record</DialogTitle>
              <DialogDescription className="text-xs text-slate-400 dark:text-slate-500 mt-1">Modify details and settings for the student profile.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <PremiumInput
                id="edit-name"
                label="Full Name"
                placeholder="e.g. Mathesh R"
                error={editErrors.name?.message}
                disabled={isActionPending}
                {...registerEdit("name")}
              />

              <PremiumInput
                id="edit-reg"
                label="SRM Register Number"
                placeholder="e.g. RA2532241010001"
                error={editErrors.registerNumber?.message}
                disabled={isActionPending}
                {...registerEdit("registerNumber")}
              />

              <PremiumInput
                id="edit-email"
                type="email"
                label="Official SRM Email"
                placeholder="e.g. mr9820@srmist.edu.in"
                error={editErrors.email?.message}
                disabled={isActionPending}
                {...registerEdit("email")}
              />

              <div className="flex items-center justify-between p-3 rounded-buttons border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="space-y-0.5">
                  <label htmlFor="edit-eligible" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Registration Eligible
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                    Allow student to select electives
                  </p>
                </div>
                <Controller
                  control={controlEdit}
                  name="isEligible"
                  render={({ field }) => (
                    <Switch
                      id="edit-eligible"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isActionPending}
                    />
                  )}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-buttons border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="space-y-0.5">
                  <label htmlFor="edit-active" className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Login Active
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                    Allow student to log in to the portal
                  </p>
                </div>
                <Controller
                  control={controlEdit}
                  name="isActive"
                  render={({ field }) => (
                    <Switch
                      id="edit-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isActionPending}
                    />
                  )}
                />
              </div>
            </div>

            <DialogFooter className="gap-3">
              <PremiumButton type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsEditOpen(false)}>
                Cancel
              </PremiumButton>
              <PremiumButton type="submit" variant="primary" disabled={isActionPending} className="w-full sm:w-auto shadow-lg shadow-indigo-500/10 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 border-none">
                {isActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </PremiumButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Reset Password Dialog */}
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-cards p-6 border border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-2xl">
          <DialogHeader className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 border border-amber-500/10">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Reset Password</DialogTitle>
            <DialogDescription className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Reset password credentials for <span className="font-bold text-slate-700 dark:text-slate-300">{activeStudent?.name}</span>?
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center font-semibold leading-relaxed my-3 px-4">
            The student&apos;s password will be restored back to their default credentials (their Register Number):{" "}
            <span className="font-extrabold text-indigo-500 bg-indigo-500/5 px-2 py-0.5 rounded">{activeStudent?.registerNumber}</span>.
          </p>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-2">
            <PremiumButton variant="outline" className="w-full sm:w-1/2 justify-center" onClick={() => setIsResetOpen(false)}>
              Cancel
            </PremiumButton>
            <PremiumButton
              variant="primary"
              className="w-full sm:w-1/2 justify-center shadow-lg shadow-indigo-500/10"
              onClick={handleResetPassword}
              disabled={isActionPending}
            >
              {isActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Reset"}
            </PremiumButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Delete Student Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-cards p-6 border border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-2xl">
          <DialogHeader className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3 border border-rose-500/10">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Delete Student</DialogTitle>
            <DialogDescription className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
              Confirm permanent deletion of student record for <span className="font-bold text-slate-700 dark:text-slate-300">{activeStudent?.name}</span>?
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center font-semibold leading-relaxed my-3 px-4">
            Warning: This deletes their database record and deletes any submitted registrations. This action cannot be reverted.
          </p>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-2">
            <PremiumButton variant="outline" className="w-full sm:w-1/2 justify-center" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </PremiumButton>
            <PremiumButton
              variant="accent"
              className="w-full sm:w-1/2 bg-rose-600 hover:bg-rose-700 text-white justify-center shadow-lg shadow-rose-500/10"
              onClick={handleDeleteStudent}
              disabled={isActionPending}
            >
              {isActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Record"}
            </PremiumButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
