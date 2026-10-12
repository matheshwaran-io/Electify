"use client";

import * as React from "react";
import { Search, SearchX, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import type { SubjectSummary } from "@/lib/subjects/queries";
import { SubjectCard } from "./subject-card";

const ALL = "__all";

function distinct<T>(items: T[], key: (t: T) => string | undefined, label: (t: T) => string) {
  const map = new Map<string, string>();
  for (const item of items) {
    const k = key(item);
    if (k && !map.has(k)) map.set(k, label(item));
  }
  return [...map.entries()].map(([value, l]) => ({ value, label: l }));
}

/**
 * Search and filters run on the already-authorised catalogue the server sent
 * for this student, so nothing here can widen what they can see.
 * Semester is not a filter because the schema does not record a semester per
 * elective; programme and department only appear when there is more than one.
 */
export function SubjectExplorer({ subjects }: { subjects: SubjectSummary[] }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState(ALL);
  const [programme, setProgramme] = React.useState(ALL);
  const [department, setDepartment] = React.useState(ALL);
  const [withSeats, setWithSeats] = React.useState(false);
  const deferredQuery = React.useDeferredValue(query);

  const categories = React.useMemo(() => distinct(subjects, (s) => s.category.id, (s) => s.category.name), [subjects]);
  const programmes = React.useMemo(() => distinct(subjects, (s) => s.programme?.id, (s) => s.programme?.name ?? ""), [subjects]);
  const departments = React.useMemo(() => distinct(subjects, (s) => s.department?.id, (s) => s.department?.name ?? ""), [subjects]);

  const results = React.useMemo(() => {
    const terms = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return subjects.filter(
      (s) =>
        (category === ALL || s.category.id === category) &&
        (programme === ALL || s.programme?.id === programme) &&
        (department === ALL || s.department?.id === department) &&
        (!withSeats || s.availability.state !== "full") &&
        terms.every((t) => s.searchText.includes(t))
    );
  }, [subjects, deferredQuery, category, programme, department, withSeats]);

  const filtered = query || category !== ALL || programme !== ALL || department !== ALL || withSeats;
  const reset = () => {
    setQuery("");
    setCategory(ALL);
    setProgramme(ALL);
    setDepartment(ALL);
    setWithSeats(false);
  };

  if (subjects.length === 0) {
    return (
      <EmptyState
        icon={<Search />}
        title="No subjects published yet"
        description="Your coordinators haven't added electives to this registration event. Check back closer to the opening time."
        className="rounded-panel bg-surface-2"
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="lg:w-96">
          <label htmlFor="subject-search" className="mb-1.5 block text-sm font-medium text-fg">
            Search
          </label>
          <Input
            id="subject-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Subject, code or topic"
            leading={<Search />}
            autoComplete="off"
            enterKeyHint="search"
            className="[&::-webkit-search-cancel-button]:appearance-none"
            trailing={
              query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="inline-flex size-8 items-center justify-center rounded-full text-fg-subtle hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              ) : null
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-1 lg:items-end">
          {categories.length > 1 ? (
            <div className="lg:w-56">
              <span className="mb-1.5 block text-sm font-medium text-fg">
                Category
              </span>
              <Select
                aria-label="Category"
                value={category}
                onValueChange={setCategory}
                options={[{ value: ALL, label: "All categories" }, ...categories]}
              />
            </div>
          ) : null}
          {programmes.length > 1 ? (
            <div className="lg:w-56">
              <span className="mb-1.5 block text-sm font-medium text-fg">Programme</span>
              <Select aria-label="Programme" value={programme} onValueChange={setProgramme} options={[{ value: ALL, label: "All programmes" }, ...programmes]} />
            </div>
          ) : null}
          {departments.length > 1 ? (
            <div className="lg:w-56">
              <span className="mb-1.5 block text-sm font-medium text-fg">Department</span>
              <Select aria-label="Department" value={department} onValueChange={setDepartment} options={[{ value: ALL, label: "All departments" }, ...departments]} />
            </div>
          ) : null}
          <div className="flex h-11 items-center gap-2.5 sm:h-10">
            <Switch id="with-seats" checked={withSeats} onCheckedChange={setWithSeats} aria-label="Only subjects with seats" />
            <label htmlFor="with-seats" className="text-sm text-fg">
              Only subjects with seats
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted" aria-live="polite">
          {filtered ? (
            <>
              <span className="font-mono tabular-nums text-fg">{results.length}</span> of {subjects.length} subjects
            </>
          ) : (
            <>
              <span className="font-mono tabular-nums text-fg">{subjects.length}</span> subjects
            </>
          )}
        </p>
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={reset}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {results.length === 0 ? (
        <EmptyState
          compact
          icon={<SearchX />}
          title="No subjects match"
          description="Try a different word, or clear the filters to see every subject."
          action={
            <Button variant="secondary" size="sm" onClick={reset}>
              Clear filters
            </Button>
          }
          className="rounded-panel bg-surface-2"
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((s) => (
            <SubjectCard key={s.electiveId} subject={s} />
          ))}
        </ul>
      )}
    </div>
  );
}
