"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronsLeft,
  ChevronsRight,
  Keyboard,
  Layers,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Moon,
  MoreHorizontal,
  Search,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { Logo, LogoMark } from "@/components/brand";
import { HeroGeometricBackground } from "@/components/background/hero-geometric-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette, type Command } from "@/components/ui/command-palette";
import { Kbd } from "@/components/ui/kbd";
import { Avatar } from "@/components/ui/layout";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuLinkItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";
import { buildNav, isActive, ROLE_CONTROL, ROLE_LABEL, type NavGroup, type Role } from "@/components/layout/nav-config";
import { RealtimeStatus } from "@/components/layout/realtime-status";
import { SectionSwitcher, sectionName, useSwitchSection, type AssignedSection } from "@/components/layout/section-switcher";
import { ShortcutsDialog, useGlobalShortcuts } from "@/components/layout/shortcuts";

interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: Role;
  employeeId?: string;
  sectionId?: string;
}

interface AppShellProps {
  children: React.ReactNode;
  session: UserSession;
  assignedSections?: AssignedSection[];
  activeWorkspace?: string;
  initialCollapsed?: boolean;
}

const SIDEBAR_COOKIE = "electify_sidebar";

export function AppShell({ children, session, assignedSections = [], activeWorkspace = "COORDINATOR", initialCollapsed = false }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const { switchTo } = useSwitchSection();

  const groups = React.useMemo(() => buildNav(session.role, activeWorkspace), [session.role, activeWorkspace]);
  const items = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const showSections =
    (session.role === "CLASS_TUTOR" || (session.role === "COURSE_COORDINATOR" && activeWorkspace === "TUTOR")) &&
    assignedSections.length > 0;

  // Close transient navigation when the route changes.
  React.useEffect(() => {
    setDrawerOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const toggleSidebar = React.useCallback(() => {
    setCollapsed((c) => {
      document.cookie = `${SIDEBAR_COOKIE}=${c ? "expanded" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  }, []);

  const handleLogout = React.useCallback(async () => {
    setSigningOut(true);
    await logout();
    toast.success("Signed out");
    router.push("/login");
  }, [router]);

  const goKeys = React.useMemo(() => Object.fromEntries(items.filter((i) => i.key).map((i) => [i.key!, i.href])), [items]);
  useGlobalShortcuts({
    onPalette: () => setPaletteOpen((o) => !o),
    onHelp: () => setHelpOpen(true),
    onToggleSidebar: toggleSidebar,
    onGo: (href) => router.push(href),
    goKeys,
  });

  const commands = React.useMemo<Command[]>(() => {
    const nav: Command[] = groups.flatMap((g) =>
      g.items.map((i) => ({
        id: `nav-${i.href}`,
        group: "Go to",
        label: i.label,
        hint: g.label,
        icon: <i.icon />,
        shortcut: i.key ? ["G", i.key.toUpperCase()] : undefined,
        perform: () => router.push(i.href),
      }))
    );
    const sections: Command[] = showSections
      ? assignedSections
          .filter((s) => s.id !== session.sectionId)
          .map((s) => ({
            id: `section-${s.id}`,
            group: "Switch section",
            label: `Switch to ${sectionName(s)}`,
            hint: `${s.programme} · ${s.batch}`,
            icon: <span className="font-mono text-xs font-medium">{s.label}</span>,
            keywords: [s.programme, s.batch],
            perform: () => switchTo(s),
          }))
      : [];
    const actions: Command[] = [
      { id: "theme-light", group: "Preferences", label: "Use light theme", icon: <Sun />, perform: () => setTheme("light") },
      { id: "theme-dark", group: "Preferences", label: "Use dark theme", icon: <Moon />, perform: () => setTheme("dark") },
      { id: "theme-system", group: "Preferences", label: "Match system theme", icon: <Monitor />, perform: () => setTheme("system") },
      { id: "sidebar", group: "Preferences", label: collapsed ? "Expand sidebar" : "Collapse sidebar", icon: <ChevronsLeft />, shortcut: ["["], perform: toggleSidebar },
      { id: "shortcuts", group: "Help", label: "Keyboard shortcuts", icon: <Keyboard />, shortcut: ["?"], perform: () => setHelpOpen(true) },
      { id: "settings", group: "Account", label: "Profile and settings", icon: <Settings />, perform: () => router.push("/faculty/settings") },
      ...(session.role === "COURSE_COORDINATOR"
        ? [{ id: "portal", group: "Account", label: "Switch portal", icon: <Layers />, perform: () => router.push("/faculty/portal-select") }]
        : []),
      { id: "signout", group: "Account", label: "Sign out", icon: <LogOut />, perform: handleLogout },
    ];
    return [...nav, ...sections, ...actions];
  }, [groups, showSections, assignedSections, session.sectionId, session.role, collapsed, router, setTheme, switchTo, toggleSidebar, handleLogout]);

  // Portal selection after sign-in is a standalone screen.
  if (pathname === "/faculty/portal-select") {
    return (
      <div className="relative flex min-h-dvh flex-col">
        <HeroGeometricBackground />
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-canvas/80 px-5 backdrop-blur-md sm:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="inline-flex h-9 items-center gap-2 rounded-control px-3 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <LogOut className="size-4" /> {signingOut ? "Signing out" : "Sign out"}
            </button>
          </div>
        </header>
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">{children}</main>
      </div>
    );
  }

  const primary = items.filter((i) => i.primary).slice(0, 4);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas text-fg">
      {/* ── Desktop sidebar ── */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 68 : 256 }}
        transition={spring.gentle}
        className="relative z-20 hidden shrink-0 flex-col border-r border-border bg-canvas lg:flex"
      >
        <SidebarContent
          groups={groups}
          pathname={pathname}
          collapsed={collapsed}
          session={session}
          showSections={showSections}
          sections={assignedSections}
          onSearch={() => setPaletteOpen(true)}
          onToggle={toggleSidebar}
          onHelp={() => setHelpOpen(true)}
          onLogout={handleLogout}
          signingOut={signingOut}
        />
      </motion.aside>

      {/* ── Main ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact top bar below lg */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-canvas/85 px-3 backdrop-blur-md pt-safe lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="hidden size-10 items-center justify-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg md:inline-flex"
          >
            <MenuIcon className="size-5" />
          </button>
          <Link href="/faculty/dashboard" className="flex h-10 items-center rounded-control px-1" aria-label="Electify dashboard">
            <Logo size="sm" label={false} />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <RealtimeStatus compact />
            <button
              type="button"
              aria-label="Search and jump"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex size-10 items-center justify-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <Search className="size-5" />
            </button>
            <ThemeToggle className="size-10" />
          </div>
        </header>

        <main id="main" className="relative flex-1 overflow-y-auto overscroll-contain scrollbar-thin pb-24 md:pb-10">
          {showSections ? (
            <div className="border-b border-border px-4 py-2.5 lg:hidden">
              <SectionSwitcher sections={assignedSections} activeId={session.sectionId} />
            </div>
          ) : null}
          <div key={session.sectionId ?? "all"} className="mx-auto w-full max-w-[88rem] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* ── Tablet drawer ── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} swipeDirection="left">
        <SheetContent side="left" showClose={false} className="w-72">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            groups={groups}
            pathname={pathname}
            collapsed={false}
            session={session}
            showSections={showSections}
            sections={assignedSections}
            onSearch={() => {
              setDrawerOpen(false);
              setPaletteOpen(true);
            }}
            onHelp={() => setHelpOpen(true)}
            onLogout={handleLogout}
            signingOut={signingOut}
          />
        </SheetContent>
      </Sheet>

      {/* ── Phone bottom bar ── */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-canvas/90 backdrop-blur-xl pb-safe md:hidden"
      >
        <ul className="grid h-16" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
          {primary.map((item) => (
            <li key={item.href}>
              <BottomLink label={shortLabel(item.label)} href={item.href} icon={item.icon} active={isActive(pathname, item.href)} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className="flex h-full w-full flex-col items-center justify-center gap-1 text-fg-muted"
            >
              <MoreHorizontal className="size-5" />
              <span className="text-2xs font-medium">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} swipeDirection="down">
        <SheetContent side="bottom" showClose={false}>
          <SheetTitle className="sr-only">More</SheetTitle>
          <div className="overflow-y-auto px-3 pb-4 pt-3">
            <div className="mb-3 flex items-center gap-3 rounded-control border border-border bg-surface-2/50 p-3">
              <Avatar name={session.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{session.name}</p>
                <p className="truncate text-xs text-fg-muted">
                  {ROLE_LABEL[session.role]} {ROLE_CONTROL[session.role] ? `· ${ROLE_CONTROL[session.role]}` : ""}
                </p>
              </div>
            </div>
            <NavList groups={groups} pathname={pathname} collapsed={false} large />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/faculty/settings" className="flex h-11 items-center justify-center gap-2 rounded-control border border-border text-sm font-medium">
                <Settings className="size-4" /> Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-11 items-center justify-center gap-2 rounded-control border border-border text-sm font-medium text-danger-text"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} groups={groups} />
    </div>
  );
}

function shortLabel(label: string) {
  return label.split(/[\s&]+/)[0];
}

function BottomLink({ label, href, icon: Icon, active }: { label: string; href: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("relative flex h-full flex-col items-center justify-center gap-1 transition-colors", active ? "text-fg" : "text-fg-muted")}
    >
      <span className="relative flex h-8 w-14 items-center justify-center">
        {active ? <motion.span layoutId="bottom-active" transition={spring.snappy} className="absolute inset-0 rounded-full bg-surface-3" /> : null}
        <Icon className="relative size-5" />
      </span>
      <span className="text-2xs font-medium">{label}</span>
    </Link>
  );
}

function SidebarContent({
  groups,
  pathname,
  collapsed,
  session,
  showSections,
  sections,
  onSearch,
  onToggle,
  onHelp,
  onLogout,
  signingOut,
}: {
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  session: UserSession;
  showSections: boolean;
  sections: AssignedSection[];
  onSearch: () => void;
  onToggle?: () => void;
  onHelp: () => void;
  onLogout: () => void;
  signingOut: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex h-14 shrink-0 items-center gap-2", collapsed ? "justify-center px-2" : "px-4")}>
        <Link href="/faculty/dashboard" aria-label="Electify dashboard" className="flex h-10 items-center rounded-control">
          {collapsed ? <LogoMark size="md" label={false} /> : <Logo size="sm" label={false} />}
        </Link>
        {!collapsed ? (
          <div className="ml-auto">
            <RealtimeStatus compact />
          </div>
        ) : null}
      </div>

      <div className={cn("space-y-2 pb-3", collapsed ? "px-3" : "px-3")}>
        {showSections ? <SectionSwitcher sections={sections} activeId={session.sectionId} collapsed={collapsed} /> : null}
        {collapsed ? (
          <Tooltip content="Search and jump" shortcut={<><Kbd>⌘</Kbd><Kbd>K</Kbd></>} side="right">
            <button
              type="button"
              aria-label="Search and jump"
              onClick={onSearch}
              className="flex size-10 items-center justify-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <Search className="size-4" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={onSearch}
            className="flex h-9 w-full items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm text-fg-subtle shadow-1 transition-colors hover:text-fg-muted"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Search or jump to</span>
            <span className="flex gap-0.5">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        )}
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 scrollbar-thin">
        <NavList groups={groups} pathname={pathname} collapsed={collapsed} />
      </nav>

      <div className={cn("shrink-0 space-y-1 border-t border-border p-3", collapsed && "flex flex-col items-center")}>
        <UserMenu session={session} collapsed={collapsed} onHelp={onHelp} onLogout={onLogout} signingOut={signingOut} />
        {onToggle ? (
          <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} shortcut={<Kbd>[</Kbd>} side="right">
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-control text-sm text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg",
                collapsed ? "w-10 justify-center" : "w-full px-2.5"
              )}
            >
              {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
              {!collapsed ? <span>Collapse</span> : null}
            </button>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

function NavList({ groups, pathname, collapsed, large }: { groups: NavGroup[]; pathname: string; collapsed: boolean; large?: boolean }) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed ? <p className="mb-1 px-2.5 text-xs font-medium text-fg-subtle">{group.label}</p> : <div className="mx-auto mb-2 h-px w-6 bg-border" />}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const link = (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative isolate flex items-center gap-2.5 rounded-full text-sm transition-colors duration-150",
                    large ? "h-11 px-4" : "h-9 px-3",
                    collapsed && "w-10 justify-center px-0",
                    active ? "font-medium text-fg" : "text-fg-muted hover:bg-surface-2/70 hover:text-fg"
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId={large ? "nav-active-sheet" : "nav-active"}
                      transition={spring.snappy}
                      className="absolute inset-0 -z-10 rounded-full bg-surface-2 shadow-[inset_0_0_0_1px_var(--border)]"
                    />
                  ) : null}
                  <item.icon className={cn("size-4 shrink-0", active ? "text-fg" : "text-fg-subtle group-hover:text-fg-muted")} />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );
              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip content={item.label} side="right" shortcut={item.key ? <><Kbd>G</Kbd><Kbd>{item.key.toUpperCase()}</Kbd></> : undefined}>
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function UserMenu({
  session,
  collapsed,
  onHelp,
  onLogout,
  signingOut,
}: {
  session: UserSession;
  collapsed: boolean;
  onHelp: () => void;
  onLogout: () => void;
  signingOut: boolean;
}) {
  const { theme, setTheme } = useTheme();
  return (
    <Menu>
      <MenuTrigger
        aria-label="Account menu"
        className={cn(
          "flex items-center gap-2.5 rounded-control text-left transition-colors hover:bg-surface-2 data-popup-open:bg-surface-2",
          collapsed ? "size-10 justify-center" : "w-full px-2 py-1.5"
        )}
      >
        <Avatar name={session.name} size="sm" />
        {!collapsed ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-fg">{session.name}</span>
            <span className="block truncate text-xs text-fg-muted">
              {ROLE_LABEL[session.role] ?? session.role} {ROLE_CONTROL[session.role] ? `· ${ROLE_CONTROL[session.role]}` : ""}
            </span>
          </span>
        ) : null}
      </MenuTrigger>
      <MenuContent side={collapsed ? "right" : "top"} align="start" className="w-60">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium text-fg">{session.name}</p>
          <p className="truncate text-xs text-fg-muted">{session.email}</p>
        </div>
        <MenuSeparator />
        <MenuLinkItem href="/faculty/settings">
          <Settings /> Profile and settings
        </MenuLinkItem>
        {session.role === "COURSE_COORDINATOR" ? (
          <MenuLinkItem href="/faculty/portal-select">
            <Layers /> Switch portal
          </MenuLinkItem>
        ) : null}
        <MenuItem onClick={onHelp}>
          <Keyboard /> Keyboard shortcuts
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        <div className="grid grid-cols-3 gap-1 px-1 pb-1">
          {([
            ["system", Monitor, "System"],
            ["light", Sun, "Light"],
            ["dark", Moon, "Dark"],
          ] as const).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              className="flex h-14 flex-col items-center justify-center gap-1 rounded-badge text-xs text-fg-muted hover:bg-surface-2 aria-pressed:bg-surface-2 aria-pressed:text-fg"
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
        <MenuSeparator />
        <MenuItem tone="danger" onClick={onLogout} disabled={signingOut}>
          <LogOut /> {signingOut ? "Signing out" : "Sign out"}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
