"use client";

import { useEffect, useState, useMemo } from "react";
import { getReplayEvents, ReplayRegistration } from "@/app/actions/replay";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Trophy,
  Users,
  UserCheck,
  UserCog,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  Hash,
  Medal,
  Award,
} from "lucide-react";
import { format } from "date-fns";

export function ReplayEngine({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "self" | "manual">(
    "all"
  );

  useEffect(() => {
    async function load() {
      const res = await getReplayEvents(eventId);
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    load();
  }, [eventId]);

  const registrations: ReplayRegistration[] = data?.registrations || [];
  const eventDetails = data?.eventDetails;

  const filteredRegistrations = useMemo(() => {
    let list = registrations;

    if (filterType === "self") {
      list = list.filter((r) => !r.isManual);
    } else if (filterType === "manual") {
      list = list.filter((r) => r.isManual);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.studentName.toLowerCase().includes(q) ||
          (r.registerNumber && r.registerNumber.toLowerCase().includes(q)) ||
          r.selections.some(
            (s) =>
              s.electiveName.toLowerCase().includes(q) ||
              (s.courseCode && s.courseCode.toLowerCase().includes(q))
          )
      );
    }

    return list;
  }, [registrations, filterType, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (!registrations.length) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
        No registrations found for this event yet.
      </div>
    );
  }

  function getRankBadge(rank: number) {
    if (rank === 1)
      return (
        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          <Trophy className="w-4 h-4 text-amber-500" />
        </div>
      );
    if (rank === 2)
      return (
        <div className="w-8 h-8 rounded-full bg-slate-400/20 flex items-center justify-center shrink-0">
          <Medal className="w-4 h-4 text-slate-400" />
        </div>
      );
    if (rank === 3)
      return (
        <div className="w-8 h-8 rounded-full bg-amber-700/20 flex items-center justify-center shrink-0">
          <Award className="w-4 h-4 text-amber-700" />
        </div>
      );
    return (
      <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-[var(--muted-foreground)]">
          {rank}
        </span>
      </div>
    );
  }

  // Calculate time difference from first registration
  const firstSubmission = registrations[0]
    ? new Date(registrations[0].submittedAt)
    : null;

  function getTimeDiff(dateStr: string) {
    if (!firstSubmission) return "";
    const diff = new Date(dateStr).getTime() - firstSubmission.getTime();
    if (diff === 0) return "First!";
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0)
      return `+${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `+${minutes}m ${seconds % 60}s`;
    return `+${seconds}s`;
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header Stats */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-sm shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">
              Registration Replay
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              {eventDetails?.name}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center px-4 py-2 bg-indigo-500/10 rounded-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Total
              </p>
              <p className="text-2xl font-mono font-bold text-indigo-500">
                {data?.totalRegistered || 0}
              </p>
            </div>
            <div className="text-center px-4 py-2 bg-emerald-500/10 rounded-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Self
              </p>
              <p className="text-2xl font-mono font-bold text-emerald-500">
                {data?.totalSelfRegistered || 0}
              </p>
            </div>
            <div className="text-center px-4 py-2 bg-amber-500/10 rounded-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Manual
              </p>
              <p className="text-2xl font-mono font-bold text-amber-500">
                {data?.totalManual || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl px-5 py-3 shadow-sm shrink-0 flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search by name, register number, or elective..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <div className="flex items-center gap-1 bg-[var(--background)] rounded-lg p-1 border border-[var(--border)]">
          {(["all", "self", "manual"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-colors ${
                filterType === type
                  ? "bg-indigo-500/20 text-indigo-500"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              }`}
            >
              {type === "all"
                ? `All (${data?.totalRegistered || 0})`
                : type === "self"
                ? `Self (${data?.totalSelfRegistered || 0})`
                : `Manual (${data?.totalManual || 0})`}
            </button>
          ))}
        </div>
      </div>

      {/* Registration List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1 custom-scrollbar">
        <AnimatePresence initial={false}>
          {filteredRegistrations.map((reg, idx) => {
            const isExpanded = expandedId === reg.id;

            return (
              <motion.div
                key={reg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: idx * 0.015, duration: 0.2 }}
                className={`bg-[var(--card)] border rounded-xl transition-all duration-200 overflow-hidden ${
                  reg.rank <= 3
                    ? "border-amber-500/30 shadow-sm"
                    : "border-[var(--border)]"
                }`}
              >
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : reg.id)
                  }
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--accent)]/30 transition-colors"
                >
                  {/* Rank Badge */}
                  {getRankBadge(reg.rank)}

                  {/* Student Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--foreground)] truncate">
                        {reg.studentName}
                      </span>
                      {reg.isManual && (
                        <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-500 text-[10px] font-bold rounded uppercase tracking-wider shrink-0">
                          Manual
                        </span>
                      )}
                    </div>
                    {reg.registerNumber && (
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        {reg.registerNumber}
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-[var(--foreground)]">
                      {format(
                        new Date(reg.submittedAt),
                        "dd MMM yyyy, hh:mm:ss a"
                      )}
                    </p>
                    <p
                      className={`text-[10px] font-bold mt-0.5 ${
                        reg.rank === 1
                          ? "text-amber-500"
                          : "text-[var(--muted-foreground)]"
                      }`}
                    >
                      {getTimeDiff(reg.submittedAt)}
                    </p>
                  </div>

                  {/* Expand Icon */}
                  <div className="shrink-0 text-[var(--muted-foreground)]">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {/* Expanded Detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-[var(--border)] overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-[var(--background)]/50">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                            <Hash className="w-3.5 h-3.5" />
                            <span>
                              Receipt:{" "}
                              <span className="font-mono text-[var(--foreground)]">
                                {reg.receiptNumber || "N/A"}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              Rank:{" "}
                              <span className="font-bold text-[var(--foreground)]">
                                #{reg.rank}
                              </span>{" "}
                              of {data?.totalRegistered}
                            </span>
                          </div>
                        </div>

                        <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted-foreground)] mb-2">
                          Selected Electives
                        </p>
                        <div className="space-y-1.5">
                          {reg.selections.length > 0 ? (
                            reg.selections.map((sel, sIdx) => (
                              <div
                                key={sIdx}
                                className="flex items-center gap-2 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-[var(--foreground)] truncate">
                                    {sel.courseCode
                                      ? `${sel.courseCode} - ${sel.electiveName}`
                                      : sel.electiveName}
                                  </p>
                                  <p className="text-[10px] text-[var(--muted-foreground)]">
                                    {sel.groupName}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-[var(--muted-foreground)] italic">
                              Elective selections not available (may have been
                              reset)
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredRegistrations.length === 0 && (
          <div className="text-center py-12 text-[var(--muted-foreground)] text-sm">
            No registrations match your search.
          </div>
        )}
      </div>
    </div>
  );
}
