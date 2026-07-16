"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Users, CheckCircle2, Percent, Search, Plus, X, Layers, Pencil, Trash2, ChevronDown } from "lucide-react";
import { createElective, createElectiveGroup, createRegistrationWindow, updateElective, deleteElective, updateElectiveGroup, deleteElectiveGroup, resetSectionSubjects } from "@/app/actions/tutor";
import { useRouter } from "next/navigation";
import { TutorSectionOnboarding } from "@/components/tutor-section-onboarding";
import { toast } from "sonner";

type Elective = { 
  id: string; 
  name: string; 
  courseCode: string | null; 
  credits: number; 
  maxSeats: number; 
  availableSeats: number; 
  isFull: boolean 
};
type Group = { id: string; name: string; electives: Elective[] };
type EventInfo = { id: string; name: string; status: string; openDate: Date | null; closeDate: Date | null };
type EventData = { event: EventInfo; groups: Group[] };

export function TutorElectivesClient({ electivesData, hasActiveSection = true }: { electivesData: EventData[], hasActiveSection?: boolean }) {
  const router = useRouter();
  const allGroups = electivesData.flatMap(e => e.groups);
  const allElectives = allGroups.flatMap(g => g.electives);

  const courseOptions = allElectives.length;
  const totalCap = allElectives.reduce((acc, curr) => acc + curr.maxSeats, 0);
  const totalAvailable = allElectives.reduce((acc, curr) => acc + curr.availableSeats, 0);
  const seatsBooked = totalCap - totalAvailable;
  const allocationRate = totalCap > 0 ? Math.round((seatsBooked / totalCap) * 100) : 0;

  const [search, setSearch] = useState("");

  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // -- Elective Modal State --
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [newGroupOnlyName, setNewGroupOnlyName] = useState("");

  // Subject Modal States
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [newElectiveName, setNewElectiveName] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newMaxSeats, setNewMaxSeats] = useState("");
  const [newCredits, setNewCredits] = useState("3");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  
  // Subject Edit States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingElectiveId, setEditingElectiveId] = useState<string | null>(null);

  // Group Edit States
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  
  // Accordion state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(allGroups.map(g => [g.id, true]))
  );

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // States for creating a window directly from empty state
  const [isWindowCreating, setIsWindowCreating] = useState(false);
  const [newWindowName, setNewWindowName] = useState("");
  const [newWindowYear, setNewWindowYear] = useState(new Date().getFullYear() + "-" + (new Date().getFullYear() + 1));

  const firstEventId = electivesData[0]?.event.id;

  async function handleCreateWindow() {
    if (!newWindowName) return;
    setIsWindowCreating(true);
    try {
      await createRegistrationWindow({ name: newWindowName, academicYear: newWindowYear });
      router.refresh();
      toast.success("Window created successfully.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsWindowCreating(false);
    }
  }

  function openAddGroupModal() {
    setNewGroupOnlyName("");
    setIsAddGroupModalOpen(true);
  }

  async function handleAddGroupSave() {
    if (!newGroupOnlyName.trim()) return toast.error("Please enter a group name");
    if (!firstEventId) return toast.error("No event ID available");

    setIsSaving(true);
    try {
      const newGroup = await createElectiveGroup(firstEventId, newGroupOnlyName);
      setIsAddGroupModalOpen(false);
      setExpandedGroups(prev => ({ ...prev, [newGroup.id]: true }));
      toast.success("Group created successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function openAddSubjectModal(groupId: string) {
    setSelectedGroupId(groupId);
    setNewElectiveName("");
    setNewCourseCode("");
    setNewMaxSeats("");
    setNewCredits("3");
    setIsAddSubjectModalOpen(true);
  }

  async function handleAddSubjectSave() {
    if (!newElectiveName || !newMaxSeats) return toast.error("Please fill required fields (Name, Seats)");
    if (!selectedGroupId) return toast.error("Invalid group selected.");

    setIsSaving(true);
    try {
      await createElective(selectedGroupId, {
        name: newElectiveName,
        courseCode: newCourseCode || undefined,
        maxSeats: parseInt(newMaxSeats),
        credits: parseInt(newCredits)
      });
      
      setIsAddSubjectModalOpen(false);
      toast.success("Subject added successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function openEditModal(elective: Elective) {
    setEditingElectiveId(elective.id);
    setNewElectiveName(elective.name);
    setNewCourseCode(elective.courseCode || "");
    setNewMaxSeats(elective.maxSeats.toString());
    setNewCredits(elective.credits.toString());
    setIsEditModalOpen(true);
  }

  async function handleEditSave() {
    if (!newElectiveName || !newMaxSeats || !editingElectiveId) return toast.error("Please fill required fields (Name, Seats)");
    setIsSaving(true);
    try {
      await updateElective(editingElectiveId, {
        name: newElectiveName,
        courseCode: newCourseCode || undefined,
        maxSeats: parseInt(newMaxSeats),
        credits: parseInt(newCredits)
      });
      setIsEditModalOpen(false);
      toast.success("Subject updated successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteElective(id: string) {
    if (!confirm("Are you sure you want to delete this subject? All associated student registrations will also be removed.")) return;
    try {
      await deleteElective(id);
      toast.success("Subject deleted");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function openEditGroupModal(group: Group) {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setIsEditGroupModalOpen(true);
  }

  async function handleEditGroupSave() {
    if (!editingGroupName || !editingGroupId) return toast.error("Group name is required");
    setIsSaving(true);
    try {
      await updateElectiveGroup(editingGroupId, editingGroupName);
      setIsEditGroupModalOpen(false);
      toast.success("Group updated successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("Are you sure you want to delete this group? ALL subjects inside it and their student registrations will be PERMANENTLY deleted.")) return;
    try {
      await deleteElectiveGroup(id);
      toast.success("Group deleted");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleResetAllSubjects(eventId: string) {
    if (!confirm("Type 'CONFIRM' to delete ALL subjects and groups for this section. This action cannot be undone.")) return;
    setIsResetting(true);
    try {
      await resetSectionSubjects(eventId);
      toast.success("All subjects and groups reset successfully.");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset subjects.");
    } finally {
      setIsResetting(false);
    }
  }

  if (electivesData.length === 0) {
    if (!hasActiveSection) {
      return <TutorSectionOnboarding />;
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Course Configurations</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Review elective listings and seat quotas.</p>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl flex flex-col items-center justify-center min-h-[60vh] p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--accent)]/10" />
          
          <div className="relative z-10 w-full max-w-md bg-[var(--background)] border border-[var(--border)] p-8 rounded-2xl shadow-xl shadow-black/5">
            <div className="w-16 h-16 bg-[var(--accent)] rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-[var(--background)]">
              <BookOpen className="w-8 h-8 text-[var(--muted-foreground)]" />
            </div>
            
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-3">Setup Your Classes</h2>
            <p className="text-[var(--muted-foreground)] text-sm mb-8">
              No registration event exists. Create a Registration Window first to start adding electives.
            </p>

            <div className="space-y-4 text-left">
              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 block">Event Name</label>
                <input 
                  value={newWindowName}
                  onChange={e => setNewWindowName(e.target.value)}
                  placeholder="e.g. B.TECH EVEN SEM AI F..."
                  className="w-full px-4 py-3 bg-[var(--accent)]/50 border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2 block">Academic Year</label>
                <input 
                  value={newWindowYear}
                  onChange={e => setNewWindowYear(e.target.value)}
                  placeholder="e.g. 2026-2027"
                  className="w-full px-4 py-3 bg-[var(--accent)]/50 border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              
              <button 
                onClick={handleCreateWindow}
                disabled={!newWindowName || isWindowCreating}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 mt-4"
              >
                {isWindowCreating ? "Creating..." : <><Plus className="w-4 h-4" /> Create Registration Window</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Subjects & Groups</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Manage elective groups, subjects, and seat allocations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleResetAllSubjects(firstEventId)}
            disabled={isResetting || allGroups.length === 0 || !firstEventId}
            className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-red-500/20 transition whitespace-nowrap flex items-center gap-1.5 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" /> {isResetting ? "Resetting..." : "Reset All"}
          </button>
          <button 
            onClick={() => openAddGroupModal()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-500 transition shadow-md shadow-indigo-500/20 whitespace-nowrap flex items-center gap-1.5 outline-none"
          >
            <Plus className="w-3.5 h-3.5" /> Add Group
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Course Options", value: courseOptions, icon: BookOpen, color: "indigo", gradient: "from-indigo-500/10 to-indigo-500/5" },
          { label: "Total Capacity", value: totalCap, icon: Users, color: "violet", gradient: "from-violet-500/10 to-violet-500/5" },
          { label: "Seats Booked", value: seatsBooked, icon: CheckCircle2, color: "emerald", gradient: "from-emerald-500/10 to-emerald-500/5" },
          { label: "Allocation Rate", value: `${allocationRate}%`, icon: Percent, color: "amber", gradient: "from-amber-500/10 to-amber-500/5" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-gradient-to-br ${stat.gradient} border border-[var(--border)] rounded-2xl p-5 relative overflow-hidden group hover:border-${stat.color}-500/30 transition-colors`}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-8 h-8 rounded-lg bg-${stat.color}-500/15 flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 text-${stat.color}-500`} />
              </div>
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-[var(--foreground)] tracking-tight">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subjects or course codes..."
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {allGroups.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted-foreground)] bg-[var(--card)] rounded-2xl border border-dashed border-[var(--border)]">
            <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No groups added yet.</p>
            <button 
              onClick={() => openAddGroupModal()}
              className="mt-4 bg-indigo-600/10 text-indigo-500 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-600/20 transition outline-none"
            >
              + Create First Group
            </button>
          </div>
        ) : (
          allGroups.map((group, gIndex) => {
            const filteredElectives = group.electives.filter(e => 
              e.name.toLowerCase().includes(search.toLowerCase()) || 
              (e.courseCode && e.courseCode.toLowerCase().includes(search.toLowerCase()))
            );

            if (search && filteredElectives.length === 0) return null;

            const isExpanded = expandedGroups[group.id];
            
            const groupCap = group.electives.reduce((acc, curr) => acc + curr.maxSeats, 0);
            const groupAvailable = group.electives.reduce((acc, curr) => acc + curr.availableSeats, 0);
            const groupFilled = groupCap - groupAvailable;
            const groupFillPerc = groupCap > 0 ? Math.round((groupFilled / groupCap) * 100) : 0;

            return (
              <motion.div 
                key={group.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gIndex * 0.06 }}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Group Header */}
                <div 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-[var(--accent)]/40 to-transparent hover:from-[var(--accent)]/60 transition-all cursor-pointer select-none"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('.group-actions')) return;
                    toggleGroup(group.id);
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-sm font-bold text-[var(--foreground)] truncate">{group.name}</h2>
                        <span className="px-2 py-0.5 rounded-full bg-[var(--background)] border border-[var(--border)] text-[var(--muted-foreground)] text-[10px] font-semibold tracking-wide shrink-0">
                          {group.electives.length} Subjects
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                          <span className={`w-1.5 h-1.5 rounded-full ${groupFillPerc === 100 ? 'bg-emerald-500' : groupFillPerc > 75 ? 'bg-amber-500' : 'bg-blue-500'}`} />
                          <span className="font-medium">{groupFilled}/{groupCap}</span>
                          <span className="opacity-60">seats filled</span>
                        </div>
                        <div className="flex-1 max-w-[120px] h-1.5 bg-[var(--background)] border border-[var(--border)]/50 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full rounded-full ${groupFillPerc === 100 ? 'bg-emerald-500' : groupFillPerc > 75 ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                            initial={{ width: 0 }}
                            animate={{ width: `${groupFillPerc}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--muted-foreground)]">{groupFillPerc}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 group-actions shrink-0">
                    <button 
                      onClick={() => openEditGroupModal(group)}
                      className="p-2 text-[var(--muted-foreground)] hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors outline-none"
                      title="Edit Group"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-2 text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors outline-none"
                      title="Delete Group"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-5 bg-[var(--border)] mx-1" />
                    <button 
                      onClick={() => openAddSubjectModal(group.id)}
                      className="bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] px-3 py-1.5 rounded-lg text-[11px] font-semibold hover:border-indigo-500/40 hover:text-indigo-500 transition flex items-center gap-1.5 outline-none"
                    >
                      <Plus className="w-3 h-3" /> Add Subject
                    </button>
                    <button className="p-2 text-[var(--muted-foreground)] outline-none">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Electives List */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 border-t border-[var(--border)]">
                        {filteredElectives.length === 0 ? (
                          <div className="text-center py-10 text-[var(--muted-foreground)] text-sm">
                            {group.electives.length === 0 ? "No subjects in this group yet." : "No subjects match your search in this group."}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {filteredElectives.map((e) => {
                              const filled = e.maxSeats - e.availableSeats;
                              const fillPerc = e.maxSeats > 0 ? Math.round((filled / e.maxSeats) * 100) : 0;
                              const circumference = 2 * Math.PI * 18;
                              const strokeDashoffset = circumference - (fillPerc / 100) * circumference;
                              
                              return (
                                <div key={e.id} className="relative p-4 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 hover:border-[var(--border)] hover:bg-[var(--accent)]/20 transition-all group/elective">
                                  {/* Top Row */}
                                  <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        {e.courseCode && (
                                          <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{e.courseCode}</span>
                                        )}
                                        {e.isFull && (
                                          <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 text-[9px] font-bold uppercase tracking-wider">Full</span>
                                        )}
                                      </div>
                                      <h3 className="font-semibold text-sm text-[var(--foreground)] leading-tight">{e.name}</h3>
                                      <p className="text-[11px] text-[var(--muted-foreground)] mt-1">{e.credits} Credits</p>
                                    </div>
                                    
                                    {/* Circular Gauge */}
                                    <div className="relative w-14 h-14 shrink-0">
                                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 44 44">
                                        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" strokeWidth="3" />
                                        <circle 
                                          cx="22" cy="22" r="18" fill="none" 
                                          stroke={e.isFull ? "#ef4444" : fillPerc > 75 ? "#f59e0b" : "#6366f1"} 
                                          strokeWidth="3" 
                                          strokeLinecap="round"
                                          strokeDasharray={circumference} 
                                          strokeDashoffset={strokeDashoffset}
                                          className="transition-all duration-700 ease-out"
                                        />
                                      </svg>
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={`text-[11px] font-bold ${e.isFull ? 'text-red-400' : 'text-[var(--foreground)]'}`}>{fillPerc}%</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Bottom Stats */}
                                  <div className="mt-3 pt-3 border-t border-[var(--border)]/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div>
                                        <p className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Filled</p>
                                        <p className="text-sm font-bold text-[var(--foreground)]">{filled}<span className="text-[var(--muted-foreground)] font-normal">/{e.maxSeats}</span></p>
                                      </div>
                                      <div className="w-px h-6 bg-[var(--border)]/50" />
                                      <div>
                                        <p className="text-[9px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Available</p>
                                        <p className={`text-sm font-bold ${e.isFull ? 'text-red-400' : 'text-emerald-500'}`}>{e.availableSeats}</p>
                                      </div>
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/elective:opacity-100 transition-opacity">
                                      <button onClick={() => openEditModal(e)} className="p-1.5 text-[var(--muted-foreground)] hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors outline-none" title="Edit Subject">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => handleDeleteElective(e.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors outline-none" title="Delete Subject">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add Group Modal */}
      <AnimatePresence>
        {isAddGroupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-3xl w-full max-w-sm shadow-xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 border-b border-[var(--border)]">
                <h3 className="text-xl font-bold text-[var(--foreground)]">Create New Group</h3>
                <button onClick={() => setIsAddGroupModalOpen(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors outline-none">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Group Name <span className="text-red-500">*</span></label>
                  <input 
                    value={newGroupOnlyName} onChange={e => setNewGroupOnlyName(e.target.value)}
                    placeholder="e.g. Core Electives"
                    className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                  />
                </div>
              </div>
              <div className="p-6 bg-[var(--background)] border-t border-[var(--border)] flex justify-end gap-3">
                <button 
                  onClick={() => setIsAddGroupModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[var(--accent)] transition-colors outline-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddGroupSave}
                  disabled={isSaving || !newGroupOnlyName.trim()}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-500 transition-colors shadow-md disabled:opacity-50 outline-none"
                >
                  {isSaving ? "Saving..." : "Create Group"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Subject Modal */}
      <AnimatePresence>
        {isAddSubjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-3xl w-full max-w-lg shadow-xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 border-b border-[var(--border)]">
                <h3 className="text-xl font-bold text-[var(--foreground)]">Add Subject</h3>
                <button onClick={() => setIsAddSubjectModalOpen(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors outline-none">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Course Name <span className="text-red-500">*</span></label>
                    <input 
                      value={newElectiveName} onChange={e => setNewElectiveName(e.target.value)}
                      placeholder="e.g. Machine Learning"
                      className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Course Code</label>
                    <input 
                      value={newCourseCode} onChange={e => setNewCourseCode(e.target.value)}
                      placeholder="e.g. ML101"
                      className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Seat Quota <span className="text-red-500">*</span></label>
                    <input 
                      type="number"
                      value={newMaxSeats} onChange={e => setNewMaxSeats(e.target.value)}
                      placeholder="e.g. 60"
                      className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Credits</label>
                    <input 
                      type="number"
                      value={newCredits} onChange={e => setNewCredits(e.target.value)}
                      className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-[var(--background)] border-t border-[var(--border)] flex justify-end gap-3">
                <button 
                  onClick={() => setIsAddSubjectModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[var(--accent)] transition-colors outline-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddSubjectSave}
                  disabled={isSaving}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-500 transition-colors shadow-md disabled:opacity-50 outline-none"
                >
                  {isSaving ? "Saving..." : "Save Subject"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Subject Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-3xl w-full max-w-lg shadow-xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 border-b border-[var(--border)]">
                <h3 className="text-xl font-bold text-[var(--foreground)]">Edit Subject</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors outline-none">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Course Name <span className="text-red-500">*</span></label>
                    <input 
                      value={newElectiveName} onChange={e => setNewElectiveName(e.target.value)}
                      placeholder="e.g. Machine Learning"
                      className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Course Code</label>
                    <input 
                      value={newCourseCode} onChange={e => setNewCourseCode(e.target.value)}
                      placeholder="e.g. ML101"
                      className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Seat Quota <span className="text-red-500">*</span></label>
                    <input 
                      type="number"
                      value={newMaxSeats} onChange={e => setNewMaxSeats(e.target.value)}
                      placeholder="e.g. 60"
                      className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Credits</label>
                    <input 
                      type="number"
                      value={newCredits} onChange={e => setNewCredits(e.target.value)}
                      className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-[var(--background)] border-t border-[var(--border)] flex justify-end gap-3">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[var(--accent)] transition-colors outline-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleEditSave}
                  disabled={isSaving}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors shadow-md disabled:opacity-50 outline-none"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Group Modal */}
      <AnimatePresence>
        {isEditGroupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-3xl w-full max-w-sm shadow-xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 border-b border-[var(--border)]">
                <h3 className="text-xl font-bold text-[var(--foreground)]">Rename Group</h3>
                <button onClick={() => setIsEditGroupModalOpen(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors outline-none">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Group Name <span className="text-red-500">*</span></label>
                  <input 
                    value={editingGroupName} onChange={e => setEditingGroupName(e.target.value)}
                    placeholder="e.g. Professional Electives"
                    className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>
              </div>
              <div className="p-6 bg-[var(--background)] border-t border-[var(--border)] flex justify-end gap-3">
                <button 
                  onClick={() => setIsEditGroupModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[var(--accent)] transition-colors outline-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleEditGroupSave}
                  disabled={isSaving || !editingGroupName.trim()}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-500 transition-colors shadow-md disabled:opacity-50 outline-none"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
