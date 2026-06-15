"use client";

import * as React from "react";
import { createElective, updateElective, deleteElective } from "@/app/actions/electives";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Edit, Trash2, BookOpen, AlertTriangle, Search, Info, CheckCircle, Users, Percent } from "lucide-react";
import { GlassCard } from "@/components/premium/glass-card";
import { PremiumButton } from "@/components/premium/premium-button";
import { PremiumInput } from "@/components/premium/premium-input";
import { AnimatedCounter } from "@/components/premium/animated-counter";
import { motion } from "framer-motion";

interface ElectiveInfo {
  id: string;
  name: string;
  groupNumber: number;
  totalSeats: number;
  availableSeats: number;
  bookedSeats: number;
  isActive: boolean;
  isFull: boolean;
}

interface ElectivesClientProps {
  electives: ElectiveInfo[];
  allowFacultyEditing: boolean;
}

// Zod schemas
const electiveSchema = z.object({
  name: z.string().min(3, "Elective name must be at least 3 characters"),
  groupNumber: z.coerce.number().min(1).max(2),
  totalSeats: z.coerce.number().min(1, "Total seats must be at least 1"),
});

type ElectiveFormValues = z.infer<typeof electiveSchema>;

export function ElectivesClient({ electives, allowFacultyEditing }: ElectivesClientProps) {
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const [activeElective, setActiveElective] = React.useState<ElectiveInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Stats computation
  const stats = React.useMemo(() => {
    const totalCourses = electives.length;
    const totalSeats = electives.reduce((sum, e) => sum + e.totalSeats, 0);
    const bookedSeats = electives.reduce((sum, e) => sum + e.bookedSeats, 0);
    const availableSeats = electives.reduce((sum, e) => sum + e.availableSeats, 0);
    const utilizationRate = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;

    return {
      totalCourses,
      totalSeats,
      bookedSeats,
      availableSeats,
      utilizationRate,
    };
  }, [electives]);

  // Forms
  const {
    register: registerAdd,
    handleSubmit: handleSubmitAdd,
    reset: resetAdd,
    formState: { errors: addErrors },
  } = useForm<ElectiveFormValues>({
    resolver: zodResolver(electiveSchema) as unknown as Resolver<ElectiveFormValues>,
    defaultValues: { name: "", groupNumber: 1, totalSeats: 30 },
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    setValue: setEditValue,
    watch: watchEdit,
    formState: { errors: editErrors },
  } = useForm<ElectiveFormValues & { isActive: boolean }>({
    resolver: zodResolver(electiveSchema.extend({ isActive: z.boolean() })) as unknown as Resolver<ElectiveFormValues & { isActive: boolean }>,
  });

  const editIsActiveWatch = watchEdit("isActive");

  // Load elective into edit form
  const openEditDialog = (elective: ElectiveInfo) => {
    setActiveElective(elective);
    setEditValue("name", elective.name);
    setEditValue("groupNumber", elective.groupNumber);
    setEditValue("totalSeats", elective.totalSeats);
    setEditValue("isActive", elective.isActive);
    setIsEditOpen(true);
  };

  const openDeleteDialog = (elective: ElectiveInfo) => {
    setActiveElective(elective);
    setIsDeleteOpen(true);
  };

  const onAddElective = async (data: ElectiveFormValues) => {
    setIsSubmitting(true);
    const response = await createElective(data);

    if (response.success) {
      toast.success(`Elective "${data.name}" created successfully!`);
      resetAdd();
      setIsAddOpen(false);
    } else {
      toast.error(response.error || "Failed to create elective.");
    }
    setIsSubmitting(false);
  };

  const onEditElective = async (data: ElectiveFormValues & { isActive: boolean }) => {
    if (!activeElective) return;
    setIsSubmitting(true);
 
    const response = await updateElective({
      id: activeElective.id,
      name: data.name,
      totalSeats: data.totalSeats,
      isActive: data.isActive,
    });

    if (response.success) {
      toast.success("Elective configurations updated.");
      setIsEditOpen(false);
    } else {
      toast.error(response.error || "Failed to update elective.");
    }
    setIsSubmitting(false);
  };

  const onDeleteElective = async () => {
    if (!activeElective) return;
    setIsSubmitting(true);

    const response = await deleteElective(activeElective.id);

    if (response.success) {
      toast.success("Elective deleted successfully.");
      setIsDeleteOpen(false);
    } else {
      toast.error(response.error || "Failed to delete elective.");
    }
    setIsSubmitting(false);
  };

  const handleToggleActive = async (elective: ElectiveInfo, checked: boolean) => {
    const response = await updateElective({
      id: elective.id,
      name: elective.name,
      totalSeats: elective.totalSeats,
      isActive: checked,
    });

    if (response.success) {
      toast.success(`Elective visibility updated.`);
    } else {
      toast.error(response.error || "Failed to change active status.");
    }
  };

  const filteredElectives = React.useMemo(() => {
    return electives.filter((e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [electives, searchQuery]);

  const g1Electives = React.useMemo(() => filteredElectives.filter((e) => e.groupNumber === 1), [filteredElectives]);
  const g2Electives = React.useMemo(() => filteredElectives.filter((e) => e.groupNumber === 2), [filteredElectives]);

  const renderTable = (list: ElectiveInfo[]) => {
    if (list.length === 0) {
      return (
        <div className="text-center py-12 text-slate-400 font-bold text-sm">
          No courses found matching this criteria.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-cards border border-slate-200/50 dark:border-slate-800/40 bg-white/40 dark:bg-slate-950/20 backdrop-blur-sm shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200/60 dark:border-slate-800/60 hover:bg-transparent bg-slate-100/50 dark:bg-slate-900/30">
              <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">Name</TableHead>
              <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] text-center w-24">Cap</TableHead>
              <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] text-center w-24">Filled</TableHead>
              <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] text-center w-24">Available</TableHead>
              <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] text-center w-28">Status</TableHead>
              <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] text-center w-28">Portal View</TableHead>
              <TableHead className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px] text-right w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((elective) => (
              <TableRow key={elective.id} className="border-b border-slate-200/50 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 py-4.5">{elective.name}</TableCell>
                <TableCell className="text-center font-bold text-slate-500 dark:text-slate-400">{elective.totalSeats}</TableCell>
                <TableCell className="text-center font-bold text-slate-500 dark:text-slate-400">{elective.bookedSeats}</TableCell>
                <TableCell className="text-center font-extrabold">
                  <span
                    className={
                      elective.availableSeats <= 0
                        ? "text-rose-500"
                        : elective.availableSeats <= 5
                        ? "text-amber-500"
                        : "text-indigo-600 dark:text-indigo-400"
                    }
                  >
                    {elective.availableSeats}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  {elective.availableSeats <= 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/10">
                      Full
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/10">
                      Open
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <Switch
                      checked={elective.isActive}
                      disabled={!allowFacultyEditing}
                      onCheckedChange={(checked) => handleToggleActive(elective, checked)}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right py-4.5">
                  <div className="flex justify-end gap-1.5">
                    <PremiumButton
                      variant="ghost"
                      size="sm"
                      disabled={!allowFacultyEditing}
                      onClick={() => openEditDialog(elective)}
                      className="min-h-[44px] min-w-[44px] w-11 h-11 p-0 rounded-buttons text-slate-500 hover:text-indigo-600 hover:bg-indigo-500/10 border-none"
                    >
                      <Edit className="w-4 h-4" />
                    </PremiumButton>
                    <PremiumButton
                      variant="ghost"
                      size="sm"
                      disabled={!allowFacultyEditing || elective.bookedSeats > 0}
                      onClick={() => openDeleteDialog(elective)}
                      className="min-h-[44px] min-w-[44px] w-11 h-11 p-0 rounded-buttons text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 border-none"
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
    );
  };

  return (
    <div className="space-y-6">
      {/* Alert when controls are locked */}
      {!allowFacultyEditing && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4 bg-amber-500/10 border border-amber-500/20 p-5 rounded-cards text-amber-800 dark:text-amber-400 shadow-md"
        >
          <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-buttons text-amber-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 dark:text-white">Adjustments Locked</h4>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Elective creation, deletion, and seat modifications are currently disabled by System Settings. Toggle editing rights in the administrative settings tab first.
            </p>
          </div>
        </motion.div>
      )}

      {/* KPI Stats overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-buttons bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/15">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Course Options</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.totalCourses} />
            </span>
          </div>
        </GlassCard>

        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-buttons bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/15">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Cap Quotas</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.totalSeats} />
            </span>
          </div>
        </GlassCard>

        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-buttons bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/15">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Seats Booked</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.bookedSeats} />
            </span>
          </div>
        </GlassCard>

        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-buttons bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/15">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Allocation Rate</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.utilizationRate} />%
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Main card panel */}
      <GlassCard hoverEffect={false} className="border-white/10 p-4 sm:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200/60 dark:border-slate-800/60 pb-6 mb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500 animate-pulse" /> Elective Catalog Config
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-semibold">
              Manage course parameters, toggle active visibility status, and set seat quotas.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 md:h-10 pl-10 pr-4 rounded-inputs text-base md:text-xs font-semibold border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <PremiumButton
              onClick={() => setIsAddOpen(true)}
              disabled={!allowFacultyEditing}
              variant="primary"
              className="h-12 md:h-10 px-5 shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 text-xs shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Elective
            </PremiumButton>
          </div>
        </div>

        <Tabs defaultValue="group1" className="space-y-6">
          <div className="flex justify-between items-center">
            <TabsList className="w-full sm:w-auto bg-slate-100 dark:bg-slate-950 p-1 rounded-inputs flex sm:inline-flex">
              <TabsTrigger value="group1" className="flex-1 sm:flex-none text-center rounded-buttons font-extrabold px-5 py-2 text-xs sm:text-xs">
                Group 1 ({g1Electives.length})
              </TabsTrigger>
              <TabsTrigger value="group2" className="flex-1 sm:flex-none text-center rounded-buttons font-extrabold px-5 py-2 text-xs sm:text-xs">
                Group 2 ({g2Electives.length})
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="group1" className="focus-visible:outline-none">
            {renderTable(g1Electives)}
          </TabsContent>
          <TabsContent value="group2" className="focus-visible:outline-none">
            {renderTable(g2Electives)}
          </TabsContent>
        </Tabs>
      </GlassCard>

      {/* 1. Add Elective Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[425px] rounded-cards p-6 border border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-2xl">
          <form onSubmit={handleSubmitAdd(onAddElective)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Add New Elective</DialogTitle>
              <DialogDescription className="text-xs text-slate-400 dark:text-slate-500 mt-1">Create a course configuration entry for elective clusters.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <PremiumInput
                id="add-name"
                label="Course Name"
                placeholder="e.g. Machine Learning"
                error={addErrors.name?.message}
                disabled={isSubmitting}
                {...registerAdd("name")}
              />

              <div className="space-y-1.5">
                <Label htmlFor="add-group" className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Elective Cluster Group
                </Label>
                <select
                  id="add-group"
                  className="w-full flex h-11 border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm rounded-inputs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-semibold"
                  {...registerAdd("groupNumber")}
                >
                  <option value={1}>Group 1</option>
                  <option value={2}>Group 2</option>
                </select>
              </div>

              <PremiumInput
                id="add-seats"
                type="number"
                label="Total Seat Quota"
                placeholder="30"
                error={addErrors.totalSeats?.message}
                disabled={isSubmitting}
                {...registerAdd("totalSeats")}
              />
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-2 sm:mt-0">
              <PremiumButton type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsAddOpen(false)}>
                Cancel
              </PremiumButton>
              <PremiumButton type="submit" variant="primary" disabled={isSubmitting} className="w-full sm:w-auto shadow-lg shadow-indigo-500/10">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Course"}
              </PremiumButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Edit Elective Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[425px] rounded-cards p-6 border border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-2xl">
          <form onSubmit={handleSubmitEdit(onEditElective)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Edit Elective</DialogTitle>
              <DialogDescription className="text-xs text-slate-400 dark:text-slate-500 mt-1">Adjust title name, quota, and visible settings.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <PremiumInput
                id="edit-name"
                label="Course Name"
                error={editErrors.name?.message}
                disabled={isSubmitting}
                {...registerEdit("name")}
              />

              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Total Seat Quota
                  </Label>
                  {activeElective && (
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1 bg-indigo-500/5 px-2 py-0.5 rounded">
                      <Info className="w-3 h-3" /> Booked: {activeElective.bookedSeats}
                    </span>
                  )}
                </div>
                <PremiumInput
                  id="edit-seats"
                  type="number"
                  error={editErrors.totalSeats?.message}
                  disabled={isSubmitting}
                  {...registerEdit("totalSeats")}
                />
              </div>

              {/* Toggle visibility */}
              <div className="flex items-center justify-between p-4 border border-slate-200/50 dark:border-slate-800/40 rounded-inputs bg-slate-50/50 dark:bg-slate-950/20">
                <div>
                  <Label htmlFor="edit-active" className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Visible to Students
                  </Label>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">Toggle to publish course to portal</p>
                </div>
                <Switch
                  id="edit-active"
                  checked={editIsActiveWatch}
                  onCheckedChange={(checked) => setEditValue("isActive", checked)}
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-2 sm:mt-0">
              <PremiumButton type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsEditOpen(false)}>
                Cancel
              </PremiumButton>
              <PremiumButton type="submit" variant="primary" disabled={isSubmitting} className="w-full sm:w-auto shadow-lg shadow-indigo-500/10">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </PremiumButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Delete Elective Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[400px] rounded-cards p-6 border border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-2xl">
          <DialogHeader className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3 border border-rose-500/10">
              <Trash2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Delete Elective</DialogTitle>
            <DialogDescription className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
              Are you sure you want to delete <span className="font-bold text-slate-700 dark:text-slate-300">{activeElective?.name}</span>?
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center font-semibold leading-relaxed my-3 px-4">
            This action cannot be undone. Electives with existing student registrations cannot be removed.
          </p>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 mt-2 sm:mt-0 w-full">
            <PremiumButton variant="outline" className="w-full sm:w-1/2 justify-center" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </PremiumButton>
            <PremiumButton
              variant="accent"
              className="w-full sm:w-1/2 bg-rose-600 hover:bg-rose-700 text-white justify-center shadow-lg shadow-rose-500/10"
              onClick={onDeleteElective}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Delete"}
            </PremiumButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
