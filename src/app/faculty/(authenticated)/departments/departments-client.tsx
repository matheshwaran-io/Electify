"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Building, BookOpen, Users, GraduationCap } from "lucide-react";

type Section = { id: string; label: string; isActive: boolean };
type Batch = { id: string; year: string; sections: Section[] };
type Programme = { id: string; name: string; code: string; degreeType: string | null; batches: Batch[] };
type Department = { id: string; name: string; code: string; programmes: Programme[] };
type Faculty = { id: string; name: string; code: string; departments: Department[] };

export function DepartmentsClient({ tree }: { tree: { faculties: Faculty[] } }) {
  const [openFaculties, setOpenFaculties] = useState<Set<string>>(new Set());
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());
  const [openProgs, setOpenProgs] = useState<Set<string>>(new Set());

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setter(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-fg">Academic Hierarchy</h1>
        <p className="text-fg-muted mt-1">Faculties → Departments → Programmes → Sections</p>
      </div>

      <div className="space-y-3">
        {tree.faculties.map((faculty) => (
          <div key={faculty.id} className="bg-surface border border-border rounded-card overflow-hidden">
            {/* Faculty Row */}
            <button
              onClick={() => toggle(openFaculties, setOpenFaculties, faculty.id)}
              className="flex items-center gap-3 w-full px-6 py-4 hover:bg-surface-2/30 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
                <Building className="w-5 h-5 text-primary-text" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-fg">{faculty.name}</p>
                <p className="text-xs text-fg-muted">{faculty.code} · {faculty.departments.length} dept(s)</p>
              </div>
              <ChevronRight className={`w-4 h-4 text-fg-muted transition-transform ${openFaculties.has(faculty.id) ? "rotate-90" : ""}`} />
            </button>

            <AnimatePresence>
              {openFaculties.has(faculty.id) && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                    {faculty.departments.map((dept) => (
                      <div key={dept.id} className="bg-surface border border-border rounded-card overflow-hidden">
                        {/* Department Row */}
                        <button
                          onClick={() => toggle(openDepts, setOpenDepts, dept.id)}
                          className="flex items-center gap-3 w-full px-5 py-3 hover:bg-surface-2/50 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-primary-text" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-fg text-sm">{dept.name}</p>
                            <p className="text-xs text-fg-muted">{dept.code} · {dept.programmes.length} programme(s)</p>
                          </div>
                          <ChevronRight className={`w-4 h-4 text-fg-muted transition-transform ${openDepts.has(dept.id) ? "rotate-90" : ""}`} />
                        </button>

                        <AnimatePresence>
                          {openDepts.has(dept.id) && (
                            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                              <div className="px-4 pb-3 space-y-2 border-t border-border pt-2">
                                {dept.programmes.map((prog) => (
                                  <div key={prog.id} className="bg-surface-2 border border-border rounded-control overflow-hidden">
                                    <button
                                      onClick={() => toggle(openProgs, setOpenProgs, prog.id)}
                                      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-surface-2/30 transition-colors text-left"
                                    >
                                      <div className="w-7 h-7 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
                                        <BookOpen className="w-3.5 h-3.5 text-primary-text" />
                                      </div>
                                      <div className="flex-1">
                                        <p className="font-medium text-fg text-sm">{prog.name}</p>
                                        <p className="text-xs text-fg-muted">{prog.code} · {prog.degreeType ?? "—"} · {prog.batches.length} batches</p>
                                      </div>
                                      <ChevronRight className={`w-4 h-4 text-fg-muted transition-transform ${openProgs.has(prog.id) ? "rotate-90" : ""}`} />
                                    </button>

                                    <AnimatePresence>
                                      {openProgs.has(prog.id) && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                                          <div className="px-4 pb-3 pt-2 border-t border-border flex flex-wrap gap-2">
                                            {prog.batches.flatMap((b) => b.sections).map((sec) => (
                                              <div key={sec.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface-2 border border-border text-xs font-medium text-fg">
                                                <GraduationCap className="w-3 h-3 text-fg-muted" />
                                                Section {sec.label}
                                              </div>
                                            ))}
                                            {prog.batches.length === 0 && (
                                              <p className="text-xs text-fg-muted">No batches or sections defined.</p>
                                            )}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
