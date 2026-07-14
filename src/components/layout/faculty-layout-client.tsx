"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  BookOpen, 
  FileText, 
  LogOut, 
  Menu, 
  X,
  Calendar,
  Layers,
  GraduationCap,
  ShieldAlert,
  Building,
  Mail,
  Clock
} from "lucide-react";
import { logout } from "@/app/actions/auth";

interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT";
  employeeId?: string;
}

const ROLE_DISPLAY: Record<string, string> = {
  SYSTEM_ADMIN: "System Administrator",
  COURSE_COORDINATOR: "Course Coordinator",
  CLASS_TUTOR: "Class Tutor",
  STUDENT: "Student",
};

interface FacultyLayoutClientProps {
  children: React.ReactNode;
  session: UserSession;
}

export function FacultyLayoutClient({ children, session }: FacultyLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const navItems = React.useMemo(() => {
    const items: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
      { name: "Dashboard", href: "/faculty/dashboard", icon: LayoutDashboard }
    ];

    if (session.role === "SYSTEM_ADMIN") {
      items.push(
        { name: "Global Events", href: "/faculty/events", icon: Calendar },
        { name: "Departments", href: "/faculty/departments", icon: Building },
        { name: "Event Templates", href: "/faculty/templates", icon: Layers },
        { name: "Users", href: "/faculty/users", icon: Users },
        { name: "Invite Codes", href: "/faculty/invites", icon: Mail },
        { name: "Audit Logs", href: "/faculty/audit", icon: ShieldAlert },
        { name: "Settings", href: "/faculty/settings", icon: Settings }
      );
    } else if (session.role === "COURSE_COORDINATOR") {
      items.push(
        { name: "Event Templates", href: "/faculty/templates", icon: Layers },
        { name: "Electives", href: "/faculty/electives", icon: BookOpen },
        { name: "Students", href: "/faculty/students", icon: GraduationCap },
        { name: "Reports", href: "/faculty/reports", icon: FileText }
      );
    } else if (session.role === "CLASS_TUTOR") {
      items.push(
        { name: "Electives", href: "/faculty/tutor-electives", icon: BookOpen },
        { name: "Students", href: "/faculty/section", icon: GraduationCap },
        { name: "Reports", href: "/faculty/tutor-reports", icon: FileText },
        { name: "Portal Window", href: "/faculty/window", icon: Clock }
      );
    }

    return items;
  }, [session.role]);

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="flex items-center justify-between h-20 px-6 border-b border-[var(--border)] shrink-0">
        <Link href="/faculty/dashboard" className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-blue-500/20">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">
            Electify
          </span>
        </Link>
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="lg:hidden p-2 rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "group-hover:text-indigo-500 transition-colors"}`} />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--accent)]/50 border border-[var(--border)]">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-lg shrink-0">
            {session.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-[var(--foreground)]">
              {session.name}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] truncate">
              {ROLE_DISPLAY[session.role] ?? session.role.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-3 w-full px-4 py-3 mt-2 text-sm font-medium text-red-500 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          {isLoggingOut ? "Logging out..." : "Log out"}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
      
      {/* ── Desktop Sidebar (always visible, no animation) ── */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col bg-[var(--card)] border-r border-[var(--border)]">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-[var(--card)] border-r border-[var(--border)] shadow-2xl lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="flex items-center justify-between h-16 px-4 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md lg:hidden shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-bold">Electify</span>
          </div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm">
            {session.name.charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
