import {
  Activity,
  BookOpen,
  Building2,
  Calendar,
  Database,
  FileBarChart,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  Layers,
  Mail,
  Radio,
  Server,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

export type Role = "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** Second key of the `g` then key shortcut. */
  key?: string
  /** Shown in the phone bottom bar (max 4, plus More). */
  primary?: boolean
}

export type NavGroup = { label: string; items: NavItem[] }

/**
 * Navigation per role. Apart from Academic sessions (new), every route listed here is one the role could already
 * reach before the redesign; nothing is newly exposed, only regrouped.
 */
export function buildNav(role: Role, workspace: string): NavGroup[] {
  const dashboard: NavItem = { label: "Dashboard", href: "/faculty/dashboard", icon: LayoutDashboard, key: "d", primary: true }
  const liveMonitor: NavItem = { label: "Live monitor", href: "/faculty/monitor", icon: Radio, key: "l", primary: true }
  const replay: NavItem = { label: "Replay", href: "/faculty/replay", icon: History, key: "p" }
  const database: NavItem = { label: "Database", href: "/faculty/database", icon: Database, key: "b" }

  if (role === "SYSTEM_ADMIN") {
    return [
      { label: "Session control", items: [dashboard, liveMonitor, replay] },
      {
        label: "Academic registry",
        items: [
          { label: "Registration events", href: "/faculty/events", icon: Calendar, key: "e", primary: true },
          { label: "Year Servers", href: "/faculty/academic-sessions", icon: Server, key: "y" },
          { label: "Departments", href: "/faculty/departments", icon: Building2, key: "t" },
        ],
      },
      {
        label: "Administration",
        items: [
          { label: "Event templates", href: "/faculty/templates", icon: Layers, key: "m" },
          { label: "User access", href: "/faculty/users", icon: Users, key: "u", primary: true },
          { label: "Invite codes", href: "/faculty/invites", icon: Mail, key: "i" },
          { label: "Audit logs", href: "/faculty/audit", icon: ShieldCheck, key: "a", primary: true },
          database,
          { label: "Settings", href: "/faculty/settings", icon: Settings, key: "," },
        ],
      },
    ]
  }

  const tutorGroups: NavGroup[] = [
    {
      label: "Session control",
      items: [
        dashboard,
        liveMonitor,
        { label: "Live window", href: "/faculty/window", icon: Activity, key: "w" },
        replay,
      ],
    },
    {
      label: "Academic registry",
      items: [
        { label: "Electives & baskets", href: "/faculty/tutor-electives", icon: BookOpen, key: "e" },
        { label: "Students", href: "/faculty/section", icon: GraduationCap, key: "s", primary: true },
        { label: "Reports", href: "/faculty/tutor-reports", icon: FileBarChart, key: "r", primary: true },
      ],
    },
    { label: "Administration", items: [database] },
  ]

  if (role === "CLASS_TUTOR") return tutorGroups

  if (role === "COURSE_COORDINATOR") {
    if (workspace === "TUTOR") return tutorGroups
    return [
      {
        label: "Session control",
        items: [
          dashboard,
          liveMonitor,
          { label: "Live window", href: "/faculty/window", icon: Activity, key: "w" },
          replay,
        ],
      },
      {
        label: "Academic registry",
        items: [
          { label: "Electives & baskets", href: "/faculty/electives", icon: BookOpen, key: "e", primary: true },
          { label: "Registration events", href: "/faculty/events", icon: Calendar, key: "v" },
          { label: "Year Servers", href: "/faculty/academic-sessions", icon: Server, key: "y" },
          { label: "Departments & classes", href: "/faculty/departments", icon: Building2, key: "c" },
          { label: "Students", href: "/faculty/students", icon: GraduationCap, key: "s", primary: true },
          { label: "Reports", href: "/faculty/reports", icon: FileText, key: "r", primary: true },
        ],
      },
      {
        label: "Administration",
        items: [{ label: "Event templates", href: "/faculty/templates", icon: Layers, key: "m" }, database],
      },
    ]
  }

  return [{ label: "Session control", items: [dashboard, liveMonitor] }]
}

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export const ROLE_LABEL: Record<string, string> = {
  SYSTEM_ADMIN: "Admin",
  COURSE_COORDINATOR: "Course Controller",
  CLASS_TUTOR: "Faculty",
  STUDENT: "Students",
}

export const ROLE_CONTROL: Record<string, string> = {
  SYSTEM_ADMIN: "Full Control",
  COURSE_COORDINATOR: "Semi Control",
  CLASS_TUTOR: "Class Control",
  STUDENT: "Elective",
}
