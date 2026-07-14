"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Users, CheckCircle2, Percent, Search, Plus, X, Layers, Pencil, Trash2, ChevronDown } from "lucide-react";
import { createElective, createElectiveGroup, createRegistrationWindow, updateElective, deleteElective, updateElectiveGroup, deleteElectiveGroup } from "@/app/actions/tutor";
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

  const [isSaving, setIsSaving] = useState(false);

  // Group Creation States
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
    <div className="space-y-8 relative pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Subjects & Groups</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Manage elective groups, subjects, and seat allocations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => openAddGroupModal()}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition shadow-md shadow-indigo-500/20 whitespace-nowrap flex items-center gap-2 focus:ring-2 focus:ring-indigo-500/50 outline-none"
          >
            <Plus className="w-4 h-4" /> Add Group
          </button>
        </div>
      </div>

      {/* Top Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Course Options</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{courseOptions}</p>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Total Capacity</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{totalCap}</p>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition-colors" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Seats Booked</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{seatsBooked}</p>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/10 transition-colors" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-3">
              <Percent className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Allocation Rate</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{allocationRate}%</p>
          </div>
        </div>
      </div>

      {/* Global Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subjects or course codes..."
          className="w-full pl-11 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm"
        />
      </div>

      {/* Premium Groups and Electives Accordion View */}
      <div className="space-y-6">
        {allGroups.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted-foreground)] bg-[var(--card)] rounded-3xl border border-[var(--border)] border-dashed">
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

            // If searching and no results in this group, hide it completely for cleaner view
            if (search && filteredElectives.length === 0) return null;

            const isExpanded = expandedGroups[group.id];
            
            const groupCap = group.electives.reduce((acc, curr) => acc + curr.maxSeats, 0);
            const groupAvailable = group.electives.reduce((acc, curr) => acc + curr.availableSeats, 0);
            const groupFilled = groupCap - groupAvailable;
            const groupFillPerc = groupCap > 0 ? Math.round((groupFilled / groupCap) * 100) : 0;

            return (
              <motion.div 
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gIndex * 0.1 }}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Group Header (Clickable Accordion) */}
                <div 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-[var(--border)] bg-[var(--background)]/30 hover:bg-[var(--accent)]/30 transition-colors cursor-pointer select-none"
                  onClick={(e) => {
                    // prevent toggle if clicking on action buttons
                    if ((e.target as HTMLElement).closest('.group-actions')) return;
                    toggleGroup(group.id);
                  }}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-[var(--foreground)]">{group.name}</h2>
                        <span className="px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)] text-[10px] font-semibold tracking-wide">
                          {group.electives.length} Subjects
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {groupFilled}/{groupCap} Seats Filled ({groupFillPerc}%)
                        </div>
                        <div className="flex-1 max-w-[150px] h-1.5 bg-[var(--accent)] rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${groupFillPerc}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 group-actions">
                    <button 
                      onClick={() => openEditGroupModal(group)}
                      className="p-2 text-[var(--muted-foreground)] hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors outline-none"
                      title="Edit Group"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-2 text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors outline-none"
                      title="Delete Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-[var(--border)] mx-2" />
                    <button 
                      onClick={() => openAddSubjectModal(group.id)}
                      className="bg-[var(--accent)] text-[var(--foreground)] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[var(--border)] transition flex items-center gap-1.5 outline-none"
                    >
                      <Plus className="w-3 h-3" /> Add Subject
                    </button>
                    <button className="p-2 text-[var(--muted-foreground)] ml-1 outline-none">
                      <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Electives List (Accordion Content) */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-2">
                        {filteredElectives.length === 0 ? (
                          <div className="text-center py-10 text-[var(--muted-foreground)] text-sm">
                            {group.electives.length === 0 ? "No subjects in this group yet." : "No subjects match your search in this group."}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {filteredElectives.map((e) => {
                              const filled = e.maxSeats - e.availableSeats;
                              const fillPerc = e.maxSeats > 0 ? Math.round((filled / e.maxSeats) * 100) : 0;
                              
                              return (
                                <div key={e.id} className="flex flex-col p-4 rounded-xl border border-[var(--border)]/50 bg-[var(--background)]/30 hover:bg-[var(--accent)]/30 hover:border-[var(--border)] transition-all group/elective">
                                  <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-[var(--foreground)] truncate">{e.name}</h3>
                                        {e.isFull && (
                                          <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[9px] font-bold uppercase tracking-wider shrink-0">Full</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                                        <span className="font-mono bg-[var(--accent)] px-1.5 py-0.5 rounded text-[10px]">{e.courseCode || "NO-CODE"}</span>
                                        <span>•</span>
                                        <span>{e.credits} Credits</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 opacity-0 group-hover/elective:opacity-100 transition-opacity">
                                      <button onClick={() => openEditModal(e)} className="p-1.5 text-[var(--muted-foreground)] hover:text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors outline-none" title="Edit Subject">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => handleDeleteElective(e.id)} className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors outline-none" title="Delete Subject">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="mt-4 pt-4 border-t border-[var(--border)]/30 flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="flex justify-between text-[10px] font-semibold text-[var(--muted-foreground)] mb-1 uppercase tracking-wider">
                                        <span>Capacity</span>
                                        <span>{filled} / {e.maxSeats}</span>
                                      </div>
                                      <div className="h-1.5 w-full bg-[var(--accent)] rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full rounded-full transition-all ${e.isFull ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                          style={{ width: `${fillPerc}%` }} 
                                        />
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Available</p>
                                      <p className={`text-sm font-bold ${e.isFull ? 'text-red-500' : 'text-emerald-500'}`}>{e.availableSeats}</p>
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
