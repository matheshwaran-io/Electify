"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Search } from "lucide-react";

type Student = { id: string; name: string; email: string; registerNumber: string | null; isActive: boolean; isEligible: boolean };
type Session = { name: string; sectionId?: string };

export function SectionClient({ students, session }: { students: Student[]; session: Session }) {
  const [search, setSearch] = useState("");
  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.registerNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">My Section</h1>
          <p className="text-[var(--muted-foreground)] mt-1">{students.length} students in your section.</p>
        </div>
        <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm text-[var(--muted-foreground)]">
          <Users className="w-4 h-4" />
          {students.length} students
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or register number…"
          className="w-full pl-11 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      {students.length === 0 && !session.sectionId && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-6 text-sm text-orange-400">
          ⚠ Your account doesn't have a section assigned. Please contact the System Admin.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {s.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--foreground)] truncate">{s.name}</p>
              <p className="text-xs text-[var(--muted-foreground)] font-mono">{s.registerNumber ?? "—"}</p>
              <div className="flex gap-2 mt-1.5">
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${s.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                  {s.isActive ? "Active" : "Inactive"}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${s.isEligible ? "bg-blue-500/10 text-blue-400" : "bg-orange-500/10 text-orange-400"}`}>
                  {s.isEligible ? "Eligible" : "Ineligible"}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && students.length > 0 && (
          <div className="col-span-full text-center py-12 text-[var(--muted-foreground)]">No students match your search.</div>
        )}
      </div>
    </div>
  );
}
