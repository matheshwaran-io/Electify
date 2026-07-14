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
  Menu, 
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
import { ThemeToggle } from "@/components/theme-toggle";

interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT";
  employeeId?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: "info" | "success" | "warning";
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let initial: NotificationItem[] = [];
    if (session.role === "SYSTEM_ADMIN") {
      initial = [
        {
          id: "1",
          title: "New Staff Registration",
          description: "Angel Rubavathi registered as CLASS_TUTOR.",
          time: "10m ago",
          read: false,
          type: "success",
        },
        {
          id: "2",
          title: "Database Synced",
          description: "Drizzle migrations synced with Supabase production.",
          time: "1h ago",
          read: false,
          type: "info",
        },
        {
          id: "3",
          title: "System Backup",
          description: "Automated daily backup finished successfully.",
          time: "4h ago",
          read: true,
          type: "info",
        },
      ];
    } else if (session.role === "COURSE_COORDINATOR") {
      initial = [
        {
          id: "1",
          title: "Registration Live",
          description: "Elective registration for 2026 Batch is now active.",
          time: "30m ago",
          read: false,
          type: "success",
        },
        {
          id: "2",
          title: "High Registration Activity",
          description: "Section A has achieved 85% completion rate.",
          time: "2h ago",
          read: false,
          type: "info",
        },
        {
          id: "3",
          title: "Template Saved",
          description: "New template 'ODD Semester 2026' was created.",
          time: "1d ago",
          read: true,
          type: "info",
        },
      ];
    } else if (session.role === "CLASS_TUTOR") {
      initial = [
        {
          id: "1",
          title: "Window Timing Update",
          description: "The registration window was updated to match coordinator timelines.",
          time: "15m ago",
          read: false,
          type: "info",
        },
        {
          id: "2",
          title: "Pending Registrations",
          description: "9 students in your section have not completed registration.",
          time: "3h ago",
          read: false,
          type: "warning",
        },
        {
          id: "3",
          title: "Class Profile Assigned",
          description: "You have been assigned as Class Tutor for Section A.",
          time: "1d ago",
          read: true,
          type: "success",
        },
      ];
    } else {
      initial = [
        {
          id: "1",
          title: "Elective Seat Alert",
          description: "Professional Elective I seats are filling up fast.",
          time: "5m ago",
          read: false,
          type: "warning",
        },
        {
          id: "2",
          title: "Registration Open",
          description: "Your batch registration window is now active.",
          time: "1h ago",
          read: false,
          type: "success",
        },
      ];
    }
    setNotifications(initial);
  }, [session.role]);

  const hasUnread = notifications.some(n => !n.read);

  const toggleRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

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
      <aside className="hidden lg:flex w-[260px] shrink-0 flex-col bg-[var(--background)] border-r border-[var(--border)] relative z-20">
        <div className="flex items-center gap-3 h-16 px-6 shrink-0 mt-2">
          <img src="/logo.png" alt="Electify Logo" className="w-8 h-8 rounded-lg" />
          <span className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">Electify</span>
        </div>

        {/* Global Search / Command Trigger */}
        <div className="px-4 pb-4 shrink-0 mt-2">
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--muted-foreground)] bg-[var(--accent)]/50 hover:bg-[var(--accent)] rounded-lg transition-colors border border-[var(--border)]/50 shadow-sm">
            <Search className="w-4 h-4 opacity-70" />
            <span className="flex-1 text-left font-medium">Search...</span>
            <kbd className="hidden md:inline-flex items-center gap-1 font-mono text-[10px] bg-[var(--background)] px-1.5 py-0.5 rounded border border-[var(--border)]/50 opacity-70">
              <Command className="w-3 h-3" /> K
            </kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-6 overflow-y-auto custom-scrollbar">
          {navGroups.map((group, i) => (
            <div key={i}>
              {group.title && (
                <h4 className="px-3 mb-1.5 text-[11px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                  {group.title}
                </h4>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group relative ${
                        isActive
                          ? "bg-[var(--accent)] text-[var(--foreground)] font-medium"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]/50 hover:text-[var(--foreground)]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon className={`w-4 h-4 shrink-0 ${isActive ? item.color : "opacity-70 group-hover:opacity-100 transition-opacity"}`} />
                        <span className="text-sm">{item.name}</span>
                      </div>
                      {isActive && (
                        <motion.div layoutId="active-nav-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-current rounded-r-full" style={{ color: "var(--foreground)" }} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-3 shrink-0 border-t border-[var(--border)]/50">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--accent)]/50 transition-colors cursor-pointer group border border-transparent hover:border-[var(--border)]/50 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--foreground)] font-semibold text-xs shrink-0 border border-[var(--border)]">
              {session.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate text-[var(--foreground)]">{session.name}</p>
              <p className="text-[11px] font-medium text-[var(--muted-foreground)] truncate">{session.role.replace(/_/g, " ")}</p>
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
            <ThemeToggle />

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] rounded-full transition-colors focus:outline-none"
              >
                <Bell className="w-5 h-5" />
                {hasUnread && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[var(--background)]" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent"
                      onClick={() => setShowNotifications(false)}
                    />
                    
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] rounded-2xl overflow-hidden z-50 backdrop-blur-xl"
                    >
                      <div className="p-4 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Notifications</h3>
                        {hasUnread && (
                          <button 
                            onClick={markAllAsRead}
                            className="text-[11px] text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>

                      <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-50 dark:divide-white/[0.02]">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map((item) => (
                            <div 
                              key={item.id} 
                              onClick={() => toggleRead(item.id)}
                              className={`p-4 flex gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors ${!item.read ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''}`}
                            >
                              <div className="mt-0.5">
                                {item.type === "success" && <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />}
                                {item.type === "warning" && <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />}
                                {item.type === "info" && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className={`text-xs font-semibold truncate ${!item.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                    {item.title}
                                  </p>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{item.time}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {notifications.length > 0 && (
                        <div className="p-2 bg-slate-50 dark:bg-white/[0.01] border-t border-slate-100 dark:border-white/[0.05] text-center">
                          <button 
                            onClick={clearAll}
                            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 font-semibold w-full py-1.5"
                          >
                            Clear all notifications
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

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
            <ThemeToggle />

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] rounded-full transition-colors focus:outline-none"
              >
                <Bell className="w-5 h-5" />
                {hasUnread && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[var(--background)]" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent"
                      onClick={() => setShowNotifications(false)}
                    />
                    
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] rounded-2xl overflow-hidden z-50 backdrop-blur-xl"
                    >
                      <div className="p-4 border-b border-slate-100 dark:border-white/[0.05] flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Notifications</h3>
                        {hasUnread && (
                          <button 
                            onClick={markAllAsRead}
                            className="text-[11px] text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
                          >
                            Mark
                          </button>
                        )}
                      </div>

                      <div className="max-h-[240px] overflow-y-auto divide-y divide-slate-50 dark:divide-white/[0.02]">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map((item) => (
                            <div 
                              key={item.id} 
                              onClick={() => toggleRead(item.id)}
                              className={`p-3 flex gap-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors ${!item.read ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''}`}
                            >
                              <div className="mt-0.5">
                                {item.type === "success" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />}
                                {item.type === "warning" && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />}
                                {item.type === "info" && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className={`text-[11px] font-semibold truncate ${!item.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                    {item.title}
                                  </p>
                                  <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0">{item.time}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {notifications.length > 0 && (
                        <div className="p-2 bg-slate-50 dark:bg-white/[0.01] border-t border-slate-100 dark:border-white/[0.05] text-center">
                          <button 
                            onClick={clearAll}
                            className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 font-semibold w-full py-1"
                          >
                            Clear all
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
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
