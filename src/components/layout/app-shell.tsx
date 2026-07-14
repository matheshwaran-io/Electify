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
  Building,
  Mail,
  Clock,
  Search,
  Bell,
  Command,
  ChevronRight
} from "lucide-react";
import { logout } from "@/app/actions/auth";

interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT";
  employeeId?: string;
}

interface AppShellProps {
  children: React.ReactNode;
  session: UserSession;
}

export function AppShell({ children, session }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const navGroups = React.useMemo(() => {
    const groups: { title?: string; items: { name: string; href: string; icon: React.ComponentType<{ className?: string }>; color: string }[] }[] = [];

    // Dashboard - Indigo
    groups.push({
      items: [{ name: "Dashboard", href: "/faculty/dashboard", icon: LayoutDashboard, color: "text-indigo-500" }]
    });

    if (session.role === "SYSTEM_ADMIN") {
      groups.push({
        title: "Registration",
        items: [
          { name: "Global Events", href: "/faculty/events", icon: Calendar, color: "text-purple-500" },
          { name: "Event Templates", href: "/faculty/templates", icon: Layers, color: "text-purple-500" },
        ]
      });
      groups.push({
        title: "Students",
        items: [
          { name: "Users", href: "/faculty/users", icon: Users, color: "text-blue-500" },
        ]
      });
      groups.push({
        title: "Analytics",
        items: [
          { name: "Audit Logs", href: "/faculty/audit", icon: FileText, color: "text-emerald-500" },
        ]
      });
      groups.push({
        title: "Settings",
        items: [
          { name: "Departments", href: "/faculty/departments", icon: Building, color: "text-slate-500" },
          { name: "Invite Codes", href: "/faculty/invites", icon: Mail, color: "text-slate-500" },
          { name: "Settings", href: "/faculty/settings", icon: Settings, color: "text-slate-500" }
        ]
      });
    } else if (session.role === "COURSE_COORDINATOR") {
      groups.push({
        title: "Registration",
        items: [
          { name: "Event Templates", href: "/faculty/templates", icon: Layers, color: "text-purple-500" },
          { name: "Electives", href: "/faculty/electives", icon: BookOpen, color: "text-purple-500" },
        ]
      });
      groups.push({
        title: "Students",
        items: [
          { name: "Student Directory", href: "/faculty/students", icon: GraduationCap, color: "text-blue-500" },
        ]
      });
      groups.push({
        title: "Analytics",
        items: [
          { name: "Reports", href: "/faculty/reports", icon: FileText, color: "text-emerald-500" }
        ]
      });
    } else if (session.role === "CLASS_TUTOR") {
      groups.push({
        title: "Registration",
        items: [
          { name: "Subjects & Groups", href: "/faculty/tutor-electives", icon: BookOpen, color: "text-purple-500" },
        ]
      });
      groups.push({
        title: "Students",
        items: [
          { name: "Student Directory", href: "/faculty/section", icon: GraduationCap, color: "text-blue-500" },
        ]
      });
      groups.push({
        title: "Analytics",
        items: [
          { name: "Reports", href: "/faculty/tutor-reports", icon: FileText, color: "text-emerald-500" },
        ]
      });
      groups.push({
        title: "Settings",
        items: [
          { name: "Portal Window", href: "/faculty/window", icon: Clock, color: "text-amber-500" }
        ]
      });
    }

    return groups;
  }, [session.role]);

  // Mobile navigation uses the first 4 items from different groups to form the bottom bar
  const mobileNavItems = navGroups.flatMap(g => g.items).slice(0, 4);

  return (
    <div className="flex h-screen w-full bg-[var(--background)] text-[var(--foreground)] overflow-hidden font-sans">
      
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col bg-[var(--card)] border-r border-[var(--border)] relative z-20">
        <div className="flex items-center gap-3 h-16 px-6 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold tracking-tight">Electify</span>
        </div>

        {/* Global Search / Command Trigger */}
        <div className="px-4 pb-4 shrink-0">
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--muted-foreground)] bg-[var(--accent)] hover:bg-[var(--accent)]/80 rounded-xl transition-colors border border-[var(--border)]">
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden md:inline-flex items-center gap-1 font-mono text-[10px] bg-[var(--background)] px-1.5 py-0.5 rounded border border-[var(--border)]">
              <Command className="w-3 h-3" /> K
            </kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 space-y-6 overflow-y-auto custom-scrollbar">
          {navGroups.map((group, i) => (
            <div key={i}>
              {group.title && (
                <h4 className="px-3 mb-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  {group.title}
                </h4>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                        isActive
                          ? "bg-[var(--accent)] text-[var(--foreground)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]/50 hover:text-[var(--foreground)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={`w-5 h-5 shrink-0 ${isActive ? item.color : "opacity-70 group-hover:opacity-100 transition-opacity"}`} />
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      {isActive && (
                        <motion.div layoutId="active-nav-indicator" className="w-1 h-4 bg-indigo-500 rounded-full" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 shrink-0 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--accent)] transition-colors cursor-pointer group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {session.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-[var(--foreground)]">{session.name}</p>
              <p className="text-xs text-[var(--muted-foreground)] truncate">{session.role.replace(/_/g, " ")}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative z-10">
        {/* Top Header (Desktop & Tablet) */}
        <header className={`hidden lg:flex items-center justify-between h-16 px-8 sticky top-0 z-30 transition-all duration-200 ${scrolled ? 'bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]' : 'bg-transparent'}`}>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[var(--background)]" />
            </button>
            <button onClick={handleLogout} disabled={isLoggingOut} className="text-sm font-medium text-[var(--muted-foreground)] hover:text-red-500 transition-colors">
              {isLoggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 sticky top-0 z-30 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500 text-white">
              <BookOpen className="w-3 h-3" />
            </div>
            <span className="text-lg font-bold tracking-tight">Electify</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] rounded-full transition-colors">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto pb-20 lg:pb-8">
          <div className="p-4 lg:p-8 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </div>

        {/* ── Mobile Bottom Navigation ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)]/90 backdrop-blur-xl border-t border-[var(--border)] pb-safe">
          <div className="flex items-center justify-around px-2 h-16">
            {mobileNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center w-16 h-full gap-1"
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isActive ? 'bg-[var(--accent)] text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
                    <item.icon className={`w-5 h-5 ${isActive ? item.color : ''}`} />
                  </div>
                  <span className={`text-[10px] font-medium ${isActive ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
                    {item.name.split(' ')[0]}
                  </span>
                </Link>
              );
            })}
            <button className="flex flex-col items-center justify-center w-16 h-full gap-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-[var(--muted-foreground)]">
                <Menu className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium text-[var(--muted-foreground)]">More</span>
            </button>
          </div>
        </nav>
      </main>
    </div>
  );
}
