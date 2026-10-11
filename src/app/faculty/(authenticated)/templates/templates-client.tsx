"use client";

import { useState } from "react";
import { Layers, Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/layout";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";

type Template = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  programmeName: string | null;
  creatorName?: string | null;
  groupCount?: number;
};

export function TemplatesClient({ templates }: { templates: Template[] }) {
  const [search, setSearch] = useState("");
  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.programmeName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Event templates" description="Reusable setups for creating registration events." />

      {templates.length > 0 ? (
        <div className="mb-5 sm:max-w-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates or programmes"
            aria-label="Search templates"
            leading={<Search />}
            trailing={
              search ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="inline-flex size-8 items-center justify-center rounded-full text-fg-subtle hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              ) : null
            }
          />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title={templates.length === 0 ? "No templates yet" : "No templates match"}
          description={templates.length === 0 ? "Templates saved by course controllers appear here." : "Try a different search."}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((template, i) => (
            <li
              key={template.id}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              className="flex flex-col rounded-card bg-surface-2 p-5 animate-enter"
            >
              <div className="flex items-start gap-3">
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-fg shadow-1">
                  <Layers className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-medium text-fg">{template.name}</h2>
                  <p className="text-sm text-fg-muted">{template.programmeName ?? "No programme"}</p>
                </div>
              </div>
              {template.description ? <p className="mt-3 line-clamp-2 text-sm text-fg-muted">{template.description}</p> : null}
              <dl className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-fg-muted [margin-top:max(1rem,auto)]">
                <div>
                  <dt className="sr-only">Groups</dt>
                  <dd>
                    <span className="font-mono tabular-nums text-fg">{template.groupCount ?? 0}</span> group{template.groupCount === 1 ? "" : "s"}
                    {template.creatorName ? <> · by {template.creatorName}</> : null}
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Created</dt>
                  <dd>{formatDate(template.createdAt)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
