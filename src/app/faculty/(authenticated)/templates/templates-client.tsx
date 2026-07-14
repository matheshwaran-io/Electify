"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Layers, Search } from "lucide-react";
import { format } from "date-fns";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Event Templates</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Reusable templates for creating registration events.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="w-full pl-11 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted-foreground)]">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 hover:border-indigo-500/50 transition-colors"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[var(--foreground)] truncate">{template.name}</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">{template.programmeName ?? "No programme"}</p>
                </div>
              </div>
              {template.description && (
                <p className="text-sm text-[var(--muted-foreground)] line-clamp-2 mb-3">{template.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] border-t border-[var(--border)] pt-3 mt-3">
                <span>{template.groupCount ?? 0} group(s)</span>
                <span>{format(new Date(template.createdAt), "MMM d, yyyy")}</span>
              </div>
              {template.creatorName && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">by {template.creatorName}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
