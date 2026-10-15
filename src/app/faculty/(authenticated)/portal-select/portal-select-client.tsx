"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, BookOpen, Building2, Clock, FileBarChart, GraduationCap, Layers, Users, type LucideIcon } from "lucide-react";
import { setWorkspacePortal } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useSpotlight } from "@/components/ui/interactions";
import { Spinner } from "@/components/ui/spinner";
import { cleanDisplayName } from "@/lib/format";

interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT";
}

interface PortalSelectClientProps {
  session: UserSession;
  assignedSectionsCount: number;
  currentWorkspace: string;
}

type Workspace = "COORDINATOR" | "TUTOR";

export function PortalSelectClient({ session, assignedSectionsCount, currentWorkspace }: PortalSelectClientProps) {
  const router = useRouter();
  const [loadingPortal, setLoadingPortal] = useState<Workspace | null>(null);

  const handleSelectPortal = async (workspace: Workspace) => {
    const name = workspace === "COORDINATOR" ? "Course Coordinator" : "Class Tutor";
    try {
      setLoadingPortal(workspace);
      const res = await setWorkspacePortal(workspace);
      if (res.success) {
        toast.success(`${name} workspace activated`, { description: "You can switch back from your account menu." });
        router.push("/faculty/dashboard");
        router.refresh();
      } else {
        throw new Error("Couldn't switch workspace");
      }
    } catch (err: any) {
      toast.error(err.message || "Couldn't switch workspace");
      setLoadingPortal(null);
    }
  };

  const displayName = cleanDisplayName(session.name);

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-8 text-center animate-enter">
        <h1 className="text-3xl font-light tracking-display text-fg sm:text-4xl">Welcome back, {displayName}</h1>
        <p className="mx-auto mt-2 max-w-lg text-fg-muted">
          Choose where to work. You can switch between them any time from your account menu.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <WorkspaceCard
          icon={GraduationCap}
          title="Course Coordinator"
          badge={<Badge tone="outline" size="sm">Semi Control</Badge>}
          description="Programme-wide view: seat allotments across departments and classes, catalogue, and combined reports."
          points={[
            { icon: BookOpen, label: "Electives and department/class seat quotas" },
            { icon: Layers, label: "Registration event templates" },
            { icon: Building2, label: "Programme student directory" },
            { icon: FileBarChart, label: "Section-by-section reports" },
          ]}
          current={currentWorkspace === "COORDINATOR"}
          loading={loadingPortal === "COORDINATOR"}
          disabled={loadingPortal !== null}
          onSelect={() => handleSelectPortal("COORDINATOR")}
          delay={60}
        />
        <WorkspaceCard
          icon={Users}
          title="Class Tutor"
          description="Class-level control: your assigned section roster, live registration window, and class reports."
          badge={
            <Badge tone={assignedSectionsCount > 0 ? "primary" : "warning"} size="sm">
              {assignedSectionsCount > 0
                ? `${assignedSectionsCount} section${assignedSectionsCount > 1 ? "s" : ""} · Class Control`
                : "Class Control"}
            </Badge>
          }
          points={[
            { icon: Users, label: "Section roster and eligibility" },
            { icon: BookOpen, label: "Subject groups and seat limits" },
            { icon: Clock, label: "Live window and timers" },
            { icon: FileBarChart, label: "Reports and manual registration" },
          ]}
          current={currentWorkspace === "TUTOR"}
          loading={loadingPortal === "TUTOR"}
          disabled={loadingPortal !== null}
          onSelect={() => handleSelectPortal("TUTOR")}
          delay={120}
        />
      </div>
    </div>
  );
}

function WorkspaceCard({
  icon: Icon,
  title,
  description,
  points,
  badge,
  current,
  loading,
  disabled,
  onSelect,
  delay,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  points: { icon: LucideIcon; label: string }[];
  badge?: React.ReactNode;
  current: boolean;
  loading: boolean;
  disabled: boolean;
  onSelect: () => void;
  delay: number;
}) {
  const ref = useSpotlight<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-describedby={undefined}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "spotlight group flex flex-col rounded-card border bg-surface p-6 text-left shadow-1 animate-enter",
        "transition-[border-color,box-shadow,transform] duration-200 ease-snappy hover:-translate-y-0.5 hover:shadow-2 active:translate-y-0",
        "disabled:cursor-wait disabled:hover:translate-y-0",
        current ? "border-primary/50 ring-1 ring-primary/30" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-control border border-border bg-surface-2 text-primary-text">
          <Icon className="size-5" />
        </span>
        <div className="flex items-center gap-2">
          {badge}
          {current ? (
            <Badge tone="success" size="sm" dot>
              Current
            </Badge>
          ) : null}
        </div>
      </div>
      <h2 className="mt-5 text-lg font-medium tracking-tight text-fg">{title}</h2>
      <p className="mt-1 text-sm text-fg-muted">{description}</p>
      <ul className="mt-5 space-y-2.5">
        {points.map(({ icon: PIcon, label }) => (
          <li key={label} className="flex items-center gap-2.5 text-sm text-fg-muted">
            <PIcon className="size-4 shrink-0 text-fg-subtle" /> {label}
          </li>
        ))}
      </ul>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary-text">
        {loading ? (
          <>
            <Spinner /> Opening
          </>
        ) : (
          <>
            Open {title.toLowerCase()} workspace
            <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </>
        )}
      </span>
    </button>
  );
}
