"use client";

import { useState } from "react";
import { BookOpen, Building, ChevronRight, GraduationCap, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Disclosure } from "@/components/ui/disclosure";

type Section = { id: string; label: string; isActive: boolean };
type Batch = { id: string; year: string; sections: Section[] };
type Programme = { id: string; name: string; code: string; degreeType: string | null; batches: Batch[] };
type Department = { id: string; name: string; code: string; programmes: Programme[] };
type Faculty = { id: string; name: string; code: string; departments: Department[] };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Row({
  open,
  onToggle,
  icon,
  title,
  meta,
  level,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  meta: string;
  level: 0 | 1 | 2;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 text-left transition-colors hover:bg-surface-2/70",
        level === 0 ? "px-4 py-4 sm:px-5" : level === 1 ? "px-4 py-3 sm:px-5" : "px-4 py-3 sm:pl-5"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
          level === 0 ? "size-10 bg-fg text-canvas" : "size-8 bg-surface-2 text-fg-muted"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-fg", level === 0 ? "font-medium" : "text-sm font-medium")}>{title}</span>
        <span className="block truncate text-xs text-fg-muted">{meta}</span>
      </span>
      <ChevronRight className={cn("size-4 shrink-0 text-fg-subtle transition-transform duration-200", open && "rotate-90")} />
    </button>
  );
}

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

  const allOpen = tree.faculties.length > 0 && tree.faculties.every((f) => openFaculties.has(f.id));
  const expandAll = () => {
    if (allOpen) {
      setOpenFaculties(new Set());
      setOpenDepts(new Set());
      setOpenProgs(new Set());
      return;
    }
    setOpenFaculties(new Set(tree.faculties.map((f) => f.id)));
    setOpenDepts(new Set(tree.faculties.flatMap((f) => f.departments.map((d) => d.id))));
    setOpenProgs(new Set(tree.faculties.flatMap((f) => f.departments.flatMap((d) => d.programmes.map((p) => p.id)))));
  };

  return (
    <div>
      <PageHeader
        title="Departments & classes"
        description="Faculties, departments, programmes and their sections."
        actions={
          tree.faculties.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={expandAll}>
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
          ) : null
        }
      />

      {tree.faculties.length === 0 ? (
        <EmptyState icon={<Building />} title="No faculties yet" description="The academic hierarchy will show up here once it is set up." />
      ) : (
        <ul className="space-y-3">
          {tree.faculties.map((faculty) => (
            <li key={faculty.id} className="overflow-hidden rounded-card border border-border bg-surface shadow-1">
              <Row
                level={0}
                open={openFaculties.has(faculty.id)}
                onToggle={() => toggle(openFaculties, setOpenFaculties, faculty.id)}
                icon={<Building />}
                title={faculty.name}
                meta={`${faculty.code} · ${plural(faculty.departments.length, "department")}`}
              />

              <Disclosure open={openFaculties.has(faculty.id)}>
                <ul className="divide-y divide-border border-t border-border">
                  {faculty.departments.map((dept) => (
                    <li key={dept.id}>
                      <Row
                        level={1}
                        open={openDepts.has(dept.id)}
                        onToggle={() => toggle(openDepts, setOpenDepts, dept.id)}
                        icon={<Users />}
                        title={dept.name}
                        meta={`${dept.code} · ${plural(dept.programmes.length, "programme")}`}
                      />

                      <Disclosure open={openDepts.has(dept.id)}>
                        <ul className="space-y-2 bg-surface-2/50 p-3 sm:pl-14">
                          {dept.programmes.map((prog) => (
                            <li key={prog.id} className="overflow-hidden rounded-control border border-border bg-surface">
                              <Row
                                level={2}
                                open={openProgs.has(prog.id)}
                                onToggle={() => toggle(openProgs, setOpenProgs, prog.id)}
                                icon={<BookOpen />}
                                title={prog.name}
                                meta={`${prog.code} · ${prog.degreeType ?? "—"} · ${plural(prog.batches.length, "batch", "batches")}`}
                              />

                              <Disclosure open={openProgs.has(prog.id)}>
                                <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                                  {prog.batches.flatMap((b) => b.sections).map((sec) => (
                                    <span
                                      key={sec.id}
                                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium text-fg"
                                    >
                                      <GraduationCap className="size-3.5 text-fg-subtle" />
                                      Section {sec.label}
                                    </span>
                                  ))}
                                  {prog.batches.length === 0 ? <p className="text-xs text-fg-muted">No batches or sections defined.</p> : null}
                                </div>
                              </Disclosure>
                            </li>
                          ))}
                          {dept.programmes.length === 0 ? <li className="px-1 text-xs text-fg-muted">No programmes yet.</li> : null}
                        </ul>
                      </Disclosure>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
