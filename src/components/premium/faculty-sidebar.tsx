"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LogOut,
  LayoutDashboard,
  Settings as SettingsIcon,
  BookOpen,
  Users,
  BarChart3,
  Menu,
  X,
  CalendarRange,
  KeyRound,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

interface SidebarProps {
  session: {
    userId: string;
    email: string;
    name: string;
    role: string;
    facultyType?: "COURSE_COORDINATOR" | "CLASS_TUTOR";
  };
  isSuperAdmin: boolean;
}

export function FacultySidebar({ session, isSuperAdmin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    toast.success("Successfully logged out.");
    router.push("/faculty/login");
    router.refresh();
  };

  const showInvites = isSuperAdmin || session.facultyType === "COURSE_COORDINATOR";

  const navLinks = [
    { href: "/faculty/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/faculty/electives", label: "Electives", icon: BookOpen },
    { href: "/faculty/students", label: "Students", icon: Users },
    { href: "/faculty/reports", label: "Reports", icon: BarChart3 },
    ...(showInvites
      ? [{ href: "/faculty/invites", label: "Invite Codes", icon: KeyRound }]
      : []),
    ...(isSuperAdmin
      ? [
          { href: "/faculty/audit", label: "Audit Logs", icon: ClipboardList },
          { href: "/faculty/window", label: "Reg Control Center", icon: CalendarRange },
          { href: "/faculty/settings", label: "Settings", icon: SettingsIcon },
        ]
      : []),
  ];

  return (
    <>
      {/* ── Desktop Sidebar ──────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200/60 dark:border-slate-900/60 bg-white/70 dark:bg-slate-950/40 backdrop-blur-md h-screen sticky top-0 z-30">
        {/* Brand */}
        <div className="h-16 px-6 border-b border-slate-200/60 dark:border-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-buttons overflow-hidden bg-white dark:bg-slate-900 shadow-md p-0.5">
              <Image src="/logo.png" alt="Electify Logo" width={32} height={32} className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
              Electify Portal
            </span>
          </div>
          <ThemeToggle />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative flex items-center gap-3 px-4 min-h-[48px] rounded-buttons text-sm font-semibold transition-all group",
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-900/30"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/5 border-l-2 border-indigo-600 dark:border-indigo-500 rounded-r-buttons rounded-l-none"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon
                  className={cn(
                    "w-4.5 h-4.5 z-10 shrink-0",
                    isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-slate-500"
                  )}
                />
                <span className="z-10">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile / Logout footer */}
        <div className="p-4 border-t border-slate-200/60 dark:border-slate-900/60 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-extrabold text-sm uppercase">
              {session.name.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate leading-none">
                {session.name}
              </p>
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1 tracking-wider">
                {session.role === "SUPER_ADMIN"
                  ? "Super Admin"
                  : session.facultyType === "COURSE_COORDINATOR"
                  ? "Coordinator"
                  : "Class Tutor"}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="touch-none w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-buttons text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all border border-transparent hover:border-rose-500/10 min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Bar ───────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 w-full h-16 border-b border-slate-200/60 dark:border-slate-900/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-buttons overflow-hidden bg-white dark:bg-slate-900 shadow-md p-0.5">
            <Image src="/logo.png" alt="Electify Logo" width={32} height={32} className="w-full h-full object-contain" />
          </div>
          <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
            Electify Portal
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            className="touch-none flex items-center justify-center w-11 h-11 rounded-buttons bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 text-slate-700 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-800 transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mobileOpen ? "close" : "open"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </motion.div>
            </AnimatePresence>
          </button>
        </div>
      </header>

      {/* ── Mobile Full-Screen Drawer ─────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 top-16 bg-black/40 backdrop-blur-sm z-30"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer Panel — slides from left */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="md:hidden fixed top-16 left-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-900 shadow-2xl z-40 flex flex-col overflow-y-auto"
            >
              {/* Nav links */}
              <nav className="flex-1 p-4 space-y-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 min-h-[52px] rounded-buttons text-sm font-semibold transition-all active:scale-[0.98]",
                        isActive
                          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-l-2 border-indigo-600 dark:border-indigo-500 font-extrabold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900/50"
                      )}
                    >
                      <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* User info + logout at bottom */}
              <div className="border-t border-slate-100 dark:border-slate-900 p-4 space-y-3 pb-safe">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-extrabold text-sm uppercase">
                    {session.name.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{session.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {session.role === "SUPER_ADMIN"
                        ? "Super Admin"
                        : session.facultyType === "COURSE_COORDINATOR"
                        ? "Coordinator"
                        : "Class Tutor"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="touch-none w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-buttons text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all border border-rose-500/15 min-h-[48px] active:bg-rose-100 dark:active:bg-rose-950/30"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
