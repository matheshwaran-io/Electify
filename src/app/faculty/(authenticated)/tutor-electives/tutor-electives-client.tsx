"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Users, CheckCircle2, Percent, Search, Plus, X, Layers } from "lucide-react";
import { createElective, createElectiveGroup, createRegistrationWindow } from "@/app/actions/tutor";
import { useRouter } from "next/navigation";

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

export function TutorElectivesClient({ electivesData }: { electivesData: EventData[] }) {
  const router = useRouter();
  const allGroups = electivesData.flatMap(e => e.groups);
  const allElectives = allGroups.flatMap(g => g.electives);

  const courseOptions = allElectives.length;
  const totalCap = allElectives.reduce((acc, curr) => acc + curr.maxSeats, 0);
  const totalAvailable = allElectives.reduce((acc, curr) => acc + curr.availableSeats, 0);
  const seatsBooked = totalCap - totalAvailable;
  const allocationRate = totalCap > 0 ? Math.round((seatsBooked / totalCap) * 100) : 0;

  const [search, setSearch] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Unified Modal States
  const [newElectiveName, setNewElectiveName] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newMaxSeats, setNewMaxSeats] = useState("");
  const [newCredits, setNewCredits] = useState("3");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);

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
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsWindowCreating(false);
    }
  }

  function openAddModal(preselectedGroupId?: string) {
    if (preselectedGroupId) {
      setSelectedGroupId(preselectedGroupId);
    } else if (allGroups.length > 0) {
      setSelectedGroupId(allGroups[0].id);
    } else {
      setSelectedGroupId("CREATE_NEW");
    }
    setNewElectiveName("");
    setNewCourseCode("");
    setNewMaxSeats("");
    setNewGroupName("");
    setIsAddModalOpen(true);
  }

  async function handleSaveCombined() {
    if (!newElectiveName || !newMaxSeats) return alert("Please fill required fields (Name, Seats)");
    if (!selectedGroupId) return alert("Please select or create a group.");
    if (selectedGroupId === "CREATE_NEW" && !newGroupName) return alert("Please enter a new group name.");

    setIsSaving(true);
    try {
      let finalGroupId = selectedGroupId;

      // 1. Create Group if needed
      if (finalGroupId === "CREATE_NEW") {
        if (!firstEventId) throw new Error("No event ID available");
        const newGroup = await createElectiveGroup(firstEventId, newGroupName);
        finalGroupId = newGroup.id;
      }

      // 2. Create Elective
      await createElective(finalGroupId, {
        name: newElectiveName,
        courseCode: newCourseCode || undefined,
        maxSeats: parseInt(newMaxSeats),
        credits: parseInt(newCredits)
      });
      
      setIsAddModalOpen(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (electivesData.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Course Configurations</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Review elective listings and seat quotas.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-[var(--muted-foreground)] bg-[var(--card)] rounded-2xl border border-[var(--border)]">
          <BookOpen className="w-10 h-10 mb-4 opacity-30" />
          <p className="mb-6">No registration event exists. Create a Registration Window first to start adding electives.</p>
          
          <div className="bg-[var(--background)] p-6 rounded-2xl border border-[var(--border)] max-w-sm w-full space-y-4 shadow-sm text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">Window Name</label>
              <input 
                value={newWindowName} onChange={e => setNewWindowName(e.target.value)}
                placeholder="e.g. Fall 2026 Registration"
                className="w-full px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] focus:ring-2 focus:ring-indigo-500/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">Academic Year</label>
              <input 
                value={newWindowYear} onChange={e => setNewWindowYear(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] focus:ring-2 focus:ring-indigo-500/50 outline-none"
              />
            </div>
            <button 
              onClick={handleCreateWindow} disabled={isWindowCreating}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-500 transition shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> {isWindowCreating ? "Creating..." : "Create Registration Window"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Course Configurations</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Manage elective groups and their subjects.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => openAddModal()}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-500 transition shadow-md shadow-indigo-500/20 whitespace-nowrap flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Subject & Group
          </button>
        </div>
      </div>

      {/* Top Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Course Options</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{courseOptions}</p>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Total Cap Quotas</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{totalCap}</p>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Seats Booked</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{seatsBooked}</p>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div>
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
          placeholder="Search all courses..."
          className="w-full pl-11 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm"
        />
      </div>

      {/* Consolidated Groups and Electives View */}
      <div className="space-y-6">
        {allGroups.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted-foreground)] bg-[var(--card)] rounded-3xl border border-[var(--border)]">
            <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No subjects added yet.</p>
            <button 
              onClick={() => openAddModal()}
              className="mt-4 bg-indigo-600/10 text-indigo-500 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-600/20 transition"
            >
              + Create First Subject
            </button>
          </div>
        ) : (
          allGroups.map((group, gIndex) => {
            const filteredElectives = group.electives.filter(e => 
              e.name.toLowerCase().includes(search.toLowerCase()) || 
              (e.courseCode && e.courseCode.toLowerCase().includes(search.toLowerCase()))
            );

            return (
              <motion.div 
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gIndex * 0.1 }}
                className="bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-sm overflow-hidden"
              >
                {/* Group Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-[var(--border)] bg-[var(--background)]/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[var(--foreground)]">{group.name}</h2>
                      <p className="text-xs text-[var(--muted-foreground)] font-medium mt-0.5">
                        {group.electives.length} Subjects Offered
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => openAddModal(group.id)}
                    className="bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[var(--accent)] transition flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Subject to Group
                  </button>
                </div>

                {/* Electives Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="bg-[var(--background)]/30 border-b border-[var(--border)]">
                        <th className="px-6 py-4 font-semibold text-[var(--muted-foreground)] text-xs tracking-wider uppercase">Name</th>
                        <th className="px-6 py-4 font-semibold text-[var(--muted-foreground)] text-xs tracking-wider uppercase">Cap</th>
                        <th className="px-6 py-4 font-semibold text-[var(--muted-foreground)] text-xs tracking-wider uppercase">Filled</th>
                        <th className="px-6 py-4 font-semibold text-[var(--muted-foreground)] text-xs tracking-wider uppercase">Available</th>
                        <th className="px-6 py-4 font-semibold text-[var(--muted-foreground)] text-xs tracking-wider uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredElectives.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-[var(--muted-foreground)]">
                            {group.electives.length === 0 ? "No subjects added to this group yet." : "No subjects match your search."}
                          </td>
                        </tr>
                      ) : (
                        filteredElectives.map((e, i) => {
                          const filled = e.maxSeats - e.availableSeats;
                          return (
                            <tr key={e.id} className="hover:bg-[var(--accent)]/10 transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-bold text-[var(--foreground)]">{e.name}</p>
                                {e.courseCode && <p className="text-xs text-[var(--muted-foreground)] font-mono mt-0.5">{e.courseCode}</p>}
                              </td>
                              <td className="px-6 py-4 text-[var(--muted-foreground)]">{e.maxSeats}</td>
                              <td className="px-6 py-4 text-[var(--muted-foreground)]">{filled}</td>
                              <td className="px-6 py-4 font-bold text-blue-500">{e.availableSeats}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${e.isFull ? "text-red-500 bg-red-500/10" : "text-emerald-500 bg-emerald-500/10"}`}>
                                  {e.isFull ? "FULL" : "OPEN"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Unified Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-3xl w-full max-w-lg shadow-xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 border-b border-[var(--border)]">
                <h3 className="text-xl font-bold text-[var(--foreground)]">Add Subject</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
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

                <div className="p-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)]/30">
                  <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-2 uppercase">Assign to Group</label>
                  <select 
                    value={selectedGroupId} 
                    onChange={e => setSelectedGroupId(e.target.value)}
                    className="w-full px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none mb-3"
                  >
                    {allGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                    <option value="CREATE_NEW">+ Create New Group</option>
                  </select>

                  {selectedGroupId === "CREATE_NEW" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                      <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">New Group Name <span className="text-red-500">*</span></label>
                      <input 
                        value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                        placeholder="e.g. Core Electives"
                        className="w-full px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                      />
                    </motion.div>
                  )}
                </div>
              </div>
              <div className="p-6 bg-[var(--background)] border-t border-[var(--border)] flex justify-end gap-3">
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[var(--accent)] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveCombined}
                  disabled={isSaving}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-500 transition-colors shadow-md disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Subject"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
