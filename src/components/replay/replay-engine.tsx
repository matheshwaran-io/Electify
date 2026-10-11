"use client";

import { useEffect, useState, useMemo } from "react";
import { getReplayEvents, ReplayRegistration } from "@/app/actions/replay";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Trophy,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  Hash,
  Medal,
  Award,
} from "lucide-react";
import { format } from "date-fns";
import { listDelay, transition } from "@/lib/motion";

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

  const registrations = useMemo<ReplayRegistration[]>(() => data?.registrations || [], [data?.registrations]);
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
        <Loader2 className="w-8 h-8 animate-spin text-fg-muted" />
      </div>
    );
  }

  if (!registrations.length) {
    return (
      <div className="flex items-center justify-center h-full text-fg-muted">
        No registrations found for this event yet.
      </div>
    );
  }

  function getRankBadge(rank: number) {
    if (rank === 1)
      return (
        <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
          <Trophy className="w-4 h-4 text-warning-text" />
        </div>
      );
    if (rank === 2)
      return (
        <div className="w-8 h-8 rounded-full bg-fg-subtle/20 flex items-center justify-center shrink-0">
          <Medal className="w-4 h-4 text-fg-subtle" />
        </div>
      );
    if (rank === 3)
      return (
        <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
          <Award className="w-4 h-4 text-warning-text" />
        </div>
      );
    return (
      <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
        <span className="text-xs font-medium text-fg-muted">
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
      <div className="bg-surface border border-border rounded-card p-6 shadow-1 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-medium text-fg">
              Registration Replay
            </h2>
            <p className="text-sm text-fg-muted mt-0.5">
              {eventDetails?.name}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center px-4 py-2 bg-primary/10 rounded-control">
              <p className="text-xs font-medium text-primary-text">
                Total
              </p>
              <p className="text-2xl font-mono font-normal text-primary-text">
                {data?.totalRegistered || 0}
              </p>
            </div>
            <div className="text-center px-4 py-2 bg-success/10 rounded-control">
              <p className="text-xs font-medium text-success-text">
                Self
              </p>
              <p className="text-2xl font-mono font-normal text-success-text">
                {data?.totalSelfRegistered || 0}
              </p>
            </div>
            <div className="text-center px-4 py-2 bg-warning/10 rounded-control">
              <p className="text-xs font-medium text-warning-text">
                Manual
              </p>
              <p className="text-2xl font-mono font-normal text-warning-text">
                {data?.totalManual || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-surface border border-border rounded-card px-5 py-3 shadow-1 shrink-0 flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <input
            type="text"
            placeholder="Search by name, register number, or elective..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border-strong rounded-control text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface-2 rounded-control p-1 border border-border">
          {(["all", "self", "manual"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-badge text-xs font-medium capitalize transition-colors ${ filterType === type ? "bg-primary/20 text-primary-text" : "text-fg-muted hover:bg-surface-2" }`}
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
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1 scrollbar-thin">
        <AnimatePresence initial={false}>
          {filteredRegistrations.map((reg, idx) => {
            const isExpanded = expandedId === reg.id;

            return (
              <motion.div
                key={reg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ ...transition.fade, delay: listDelay(idx, 0.015) }}
                className={`bg-surface border rounded-control transition-all duration-200 overflow-hidden ${
                  reg.rank <= 3
                    ? "border-warning/30 shadow-1"
                    : "border-border"
                }`}
              >
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : reg.id)
                  }
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-2/30 transition-colors"
                >
                  {/* Rank Badge */}
                  {getRankBadge(reg.rank)}

                  {/* Student Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fg truncate">
                        {reg.studentName}
                      </span>
                      {reg.isManual && (
                        <span className="px-1.5 py-0.5 bg-warning/15 text-warning-text text-2xs font-medium rounded-badge shrink-0">
                          Manual
                        </span>
                      )}
                    </div>
                    {reg.registerNumber && (
                      <p className="text-xs text-fg-muted mt-0.5">
                        {reg.registerNumber}
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-fg">
                      {format(
                        new Date(reg.submittedAt),
                        "dd MMM yyyy, hh:mm:ss a"
                      )}
                    </p>
                    <p
                      className={`text-2xs font-medium mt-0.5 ${ reg.rank === 1 ? "text-warning-text" : "text-fg-muted" }`}
                    >
                      {getTimeDiff(reg.submittedAt)}
                    </p>
                  </div>

                  {/* Expand Icon */}
                  <div className="shrink-0 text-fg-muted">
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
                      transition={transition.fade}
                      className="border-t border-border overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-surface-2/50">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="flex items-center gap-2 text-xs text-fg-muted">
                            <Hash className="w-3.5 h-3.5" />
                            <span>
                              Receipt:{" "}
                              <span className="font-mono text-fg">
                                {reg.receiptNumber || "N/A"}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-fg-muted">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              Rank:{" "}
                              <span className="font-medium text-fg">
                                #{reg.rank}
                              </span>{" "}
                              of {data?.totalRegistered}
                            </span>
                          </div>
                        </div>

                        <p className="text-2xs font-medium text-fg-muted mb-2">
                          Selected Electives
                        </p>
                        <div className="space-y-1.5">
                          {reg.selections.length > 0 ? (
                            reg.selections.map((sel, sIdx) => (
                              <div
                                key={sIdx}
                                className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-control"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-fg truncate">
                                    {sel.courseCode
                                      ? `${sel.courseCode} - ${sel.electiveName}`
                                      : sel.electiveName}
                                  </p>
                                  <p className="text-2xs text-fg-muted">
                                    {sel.groupName}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-fg-muted italic">
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
          <div className="text-center py-12 text-fg-muted text-sm">
            No registrations match your search.
          </div>
        )}
      </div>
    </div>
  );
}
