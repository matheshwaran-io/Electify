"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Users, CheckCircle2, Percent, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

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
  // If there are multiple events, we just show the first one for the dashboard view, 
  // or we could add a dropdown. Let's just flat map for the stats, and use the first event for the table.
  const allGroups = electivesData.flatMap(e => e.groups);
  const allElectives = allGroups.flatMap(g => g.electives);

  const courseOptions = allElectives.length;
  const totalCap = allElectives.reduce((acc, curr) => acc + curr.maxSeats, 0);
  const totalAvailable = allElectives.reduce((acc, curr) => acc + curr.availableSeats, 0);
  const seatsBooked = totalCap - totalAvailable;
  const allocationRate = totalCap > 0 ? Math.round((seatsBooked / totalCap) * 100) : 0;

  const [activeGroupId, setActiveGroupId] = useState<string | null>(allGroups.length > 0 ? allGroups[0].id : null);
  const [search, setSearch] = useState("");

  const activeGroup = allGroups.find(g => g.id === activeGroupId);
  const filteredElectives = activeGroup?.electives.filter(e => 
    e.name.toLowerCase().includes(search.toLowerCase()) || 
    (e.courseCode && e.courseCode.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  if (electivesData.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Course Configurations</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Review elective listings and seat quotas.</p>
        </div>
        <div className="text-center py-20 text-[var(--muted-foreground)] bg-[var(--card)] rounded-2xl border border-[var(--border)]">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No electives configured for your section yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Course Configurations</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Review elective listings and seat quotas.</p>
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

      {/* Catalog Table Area */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Tabs panel */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--background)]/50 p-6 shrink-0">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--muted-foreground)]" />
              Elective Catalog
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Select a cluster group to view its electives.
            </p>
          </div>

          <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
            {allGroups.map(group => (
              <button
                key={group.id}
                onClick={() => setActiveGroupId(group.id)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all text-left flex items-center justify-between whitespace-nowrap ${
                  activeGroupId === group.id 
                    ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" 
                    : "bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                }`}
              >
                {group.name}
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeGroupId === group.id ? "bg-white/20" : "bg-[var(--background)]"}`}>
                  {group.electives.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Table panel */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courses..."
                className="w-full pl-9 pr-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            {/* The "Add Elective" button would go here for Admin, omitted for Tutor */}
          </div>

          <div className="overflow-x-auto border border-[var(--border)] rounded-2xl">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-[var(--background)]/50 border-b border-[var(--border)]">
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
                    <td colSpan={5} className="text-center py-16 text-[var(--muted-foreground)]">
                      No electives match your search in this group.
                    </td>
                  </tr>
                ) : (
                  filteredElectives.map((e, i) => {
                    const filled = e.maxSeats - e.availableSeats;
                    return (
                      <motion.tr
                        key={e.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="hover:bg-[var(--accent)]/10 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-[var(--foreground)]">{e.name}</p>
                          {e.courseCode && <p className="text-xs text-[var(--muted-foreground)] font-mono mt-0.5">{e.courseCode}</p>}
                        </td>
                        <td className="px-6 py-4 text-[var(--muted-foreground)]">{e.maxSeats}</td>
                        <td className="px-6 py-4 text-[var(--muted-foreground)]">{filled}</td>
                        <td className="px-6 py-4 font-bold text-blue-500">{e.availableSeats}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${e.isFull ? "text-red-500 bg-red-500/10" : "text-emerald-500 bg-emerald-500/10"}`}>
                            {e.isFull ? "FULL" : "OPEN"}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
