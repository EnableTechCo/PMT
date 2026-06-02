"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard,
  Briefcase,
  Ticket,
  Users2,
  Search,
  Plus,
  LogOut,
  Menu,
  X,
  Settings,
  User,
  ChevronDown,
  ChevronRight,
  Power,
  Moon,
  Sun,
  BarChart3,
  FolderKanban,
  Handshake,
  Bell,
  FileText,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeam } from "@/contexts/TeamContext";
import { SelectMenu } from "@/components/SelectMenu";
import ConfirmDialog from "@/components/ConfirmDialog";
import { onRealtimeChange } from "@/lib/realtime-events";

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  ticketId: string | null;
  read: boolean;
  createdAt: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type NavItem = {
  name: string;
  href: string;
  icon: any;
  children?: NavItem[];
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileWorkspaceOpen, setMobileWorkspaceOpen] = useState(false);
  const [desktopWorkspaceOpen, setDesktopWorkspaceOpen] = useState(false);
  const [mobileNavGroups, setMobileNavGroups] = useState<
    Record<string, boolean>
  >({});
  const [desktopNavGroups, setDesktopNavGroups] = useState<
    Record<string, boolean>
  >({});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    isAllTeams,
    setAllTeamsMode,
    loading: teamNavLoading,
  } = useTeam();

  const navigation: NavItem[] = useMemo(
    () =>
      user?.role === "CLIENT"
        ? [
            {
              name: "Dashboard",
              href: "/client/dashboard",
              icon: LayoutDashboard,
            },
          ]
        : user?.role === "SUPER_ADMIN"
          ? [
              { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
              { name: "Executive", href: "/executive", icon: BarChart3 },
              { name: "Clients", href: "/clients", icon: Handshake },
              { name: "Feedback", href: "/feedback", icon: Bell },
              { name: "Workload", href: "/workload", icon: Briefcase },
              { name: "Tickets", href: "/tickets", icon: Ticket },
              { name: "Docs", href: "/docs", icon: FileText },
              { name: "Projects", href: "/projects", icon: FolderKanban },
              { name: "Teams", href: "/teams", icon: Users2 },
              { name: "Monitoring", href: "/monitoring", icon: Activity },
            ]
          : [
              { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
              { name: "Clients", href: "/clients", icon: Handshake },
              { name: "Feedback", href: "/feedback", icon: Bell },
              { name: "Workload", href: "/workload", icon: Briefcase },
              { name: "Tickets", href: "/tickets", icon: Ticket },
              { name: "Docs", href: "/docs", icon: FileText },
              { name: "Projects", href: "/projects", icon: FolderKanban },
            ],
    [user?.role],
  );
  const quickActions =
    user?.role === "CLIENT"
      ? [
          {
            name: "Dashboard",
            href: "/client/dashboard",
            icon: LayoutDashboard,
          },
        ]
      : [
          { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { name: "Tickets", href: "/tickets", icon: Ticket },
          { name: "Feedback", href: "/feedback", icon: Bell },
          { name: "Workload", href: "/workload", icon: Briefcase },
          { name: "Projects", href: "/projects", icon: FolderKanban },
        ];

  const pathname = usePathname();

  const isNavActive = useCallback(
    (item: NavItem): boolean => {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return true;
      }
      return item.children?.some((child) => isNavActive(child)) ?? false;
    },
    [pathname],
  );

  const flatNavigation = useMemo(() => {
    const items: NavItem[] = [];
    const visit = (nodes: NavItem[]) => {
      for (const node of nodes) {
        items.push(node);
        if (node.children?.length) {
          visit(node.children);
        }
      }
    };
    visit(navigation);
    return items;
  }, [navigation]);

  const isClient = user?.role === "CLIENT";
  const breadcrumbLabel =
    flatNavigation
      .slice()
      .sort((a, b) => b.href.length - a.href.length)
      .find(
        (nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`),
      )?.name || "Workspace";

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as AppNotification[];
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user || isClient) return;
    void loadNotifications();
  }, [user, isClient, pathname, loadNotifications]);

  useEffect(() => {
    if (!user || isClient) return;

    const unsubscribe = onRealtimeChange((detail) => {
      if (detail.table !== "Notification") return;
      void loadNotifications();
    });

    return unsubscribe;
  }, [user, isClient, loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const monitoringAlertCount = notifications.filter((n) => {
    if (n.read) return false;
    return (
      n.type === "PR_READY_FOR_REVIEW" ||
      n.type === "MONITORING_ERROR" ||
      n.type.startsWith("MONITORING_")
    );
  }).length;

  const markNotificationsRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      await loadNotifications();
    } catch {
      /* ignore */
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      await loadNotifications();
    } catch {
      /* ignore */
    }
  };

  const executeLogout = async () => {
    setLogoutBusy(true);
    try {
      await logout();
      window.location.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
      window.location.replace("/");
    } finally {
      setLogoutBusy(false);
      setShowLogoutConfirm(false);
    }
  };

  const requestLogout = () => {
    setShowUserMenu(false);
    setShowQuickActions(false);
    setNotifOpen(false);
    setShowLogoutConfirm(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log("Searching for:", searchQuery);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] text-[var(--text-primary)]">
      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          sidebarOpen ? "block" : "hidden",
        )}
      >
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed left-0 top-0 h-full w-64 border-r border-[var(--border)] bg-gradient-to-b from-slate-50/95 to-[var(--sidebar)] dark:border-gray-800 dark:from-[#16161c] dark:to-[#13131a]">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-4 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                PMT HUB
              </h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-700 hover:text-gray-900 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Mobile Search */}
          <div className="border-b border-[var(--border)] p-4 dark:border-gray-800">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/80 dark:text-white dark:focus:bg-gray-900"
              />
            </form>
          </div>

          <nav className="flex-1 space-y-0.5 p-3">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const isExpanded =
                mobileNavGroups[item.name] ??
                item.children?.some(
                  (child) =>
                    pathname === child.href ||
                    pathname.startsWith(`${child.href}/`),
                ) ??
                false;

              if (item.children?.length) {
                return (
                  <div key={item.name} className="mb-1">
                    <div
                      className={cn(
                        "group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                        isNavActive(item)
                          ? "bg-brand-600/[0.08] text-brand-800 ring-1 ring-brand-500/15 dark:bg-brand-600/10 dark:text-brand-200 dark:ring-brand-400/20"
                          : "text-gray-600 hover:bg-white/80 hover:text-gray-900 hover:shadow-sm dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-white",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          isNavActive(item)
                            ? "text-brand-600 dark:text-brand-400"
                            : "text-gray-500 group-hover:text-brand-600 dark:text-gray-500 dark:group-hover:text-brand-400",
                        )}
                      />
                      <Link
                        href={item.href}
                        className="flex-1 text-left"
                        onClick={() => setSidebarOpen(false)}
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setMobileNavGroups((prev) => ({
                            ...prev,
                            [item.name]: !isExpanded,
                          }))
                        }
                        className="rounded-md p-1 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className="mt-1 space-y-1 pl-9">
                        {item.children.map((child) => {
                          const isChildActive =
                            pathname === child.href ||
                            pathname.startsWith(`${child.href}/`);
                          return (
                            <Link
                              key={child.name}
                              href={child.href}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium",
                                isChildActive
                                  ? "bg-gray-100 text-gray-900 ring-1 ring-gray-300 shadow-sm dark:bg-brand-600/15 dark:text-brand-200 dark:ring-brand-400/25"
                                  : "text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-white",
                              )}
                              onClick={() => setSidebarOpen(false)}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                              <span>{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                    isActive
                      ? "bg-gray-100 text-gray-900 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)] ring-1 ring-gray-300 dark:bg-brand-600/15 dark:text-brand-200 dark:ring-brand-400/25"
                      : "text-gray-600 hover:bg-white/80 hover:text-gray-900 hover:shadow-sm dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-white",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-transform duration-200 ease-out group-hover:scale-110",
                      isActive
                        ? "text-gray-800 dark:text-brand-400"
                        : "text-gray-500 group-hover:text-brand-600 dark:text-gray-500 dark:group-hover:text-brand-400",
                    )}
                  />
                  <span className="flex-1 text-left">{item.name}</span>
                  {item.name === "Monitoring" && monitoringAlertCount > 0 ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {monitoringAlertCount > 99 ? "99+" : monitoringAlertCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}

            {user?.role !== "SUPER_ADMIN" && !isClient ? (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setMobileWorkspaceOpen((prev) => !prev)}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-all duration-200 ease-out hover:bg-white/80 hover:text-gray-900 hover:shadow-sm dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
                >
                  <Users2 className="h-[18px] w-[18px] shrink-0 text-gray-500 group-hover:text-brand-600 dark:text-gray-500 dark:group-hover:text-brand-400" />
                  <span className="flex-1 text-left">Workspace</span>
                  {mobileWorkspaceOpen ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                </button>

                {mobileWorkspaceOpen ? (
                  <div className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-white/70 p-2 dark:border-gray-800 dark:bg-white/[0.03]">
                    {teamNavLoading ? (
                      <p className="px-2 py-1 text-xs text-gray-500">
                        Loading teams...
                      </p>
                    ) : user.role === "SUPER_ADMIN" ? (
                      <>
                        <div className="flex items-center justify-between px-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Scope
                          </span>
                          <Link
                            href="/teams"
                            className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                            onClick={() => setSidebarOpen(false)}
                          >
                            Manage
                          </Link>
                        </div>
                        <div className="max-h-44 space-y-1 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setAllTeamsMode(true);
                              setSidebarOpen(false);
                            }}
                            className={cn(
                              "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                              isAllTeams
                                ? "bg-brand-50 font-medium text-brand-800 dark:bg-brand-950/50 dark:text-brand-200"
                                : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5",
                            )}
                          >
                            All teams
                          </button>
                          {teams.map((team) => (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => {
                                setAllTeamsMode(false);
                                setActiveTeamId(team.id);
                                setSidebarOpen(false);
                              }}
                              className={cn(
                                "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                                !isAllTeams && activeTeamId === team.id
                                  ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-white"
                                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5",
                              )}
                            >
                              {team.name}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <SelectMenu
                        value={activeTeamId}
                        onChange={(v) => {
                          setActiveTeamId(v);
                          setSidebarOpen(false);
                        }}
                        disabled={teams.length === 0}
                        options={teams.map((t) => ({
                          value: t.id,
                          label: t.name,
                        }))}
                        placeholder="Choose team"
                        className="w-full"
                      />
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>

          {/* Mobile User Info */}
          <div className="border-t border-[var(--border)] p-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {user.name}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user.role}
                </p>
              </div>
              <button
                onClick={requestLogout}
                className="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64">
        <div className="flex h-full flex-col border-r border-[var(--border)] bg-gradient-to-b from-slate-50/95 to-[var(--sidebar)] dark:border-gray-800 dark:from-[#16161c] dark:to-[#13131a]">
          <div className="h-20 flex items-center gap-2 border-b border-[var(--border)] p-4 dark:border-gray-800">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Enable Tech Co
              <br />
              <span className="-mt-1 block text-sm font-normal text-gray-500 dark:text-gray-400">
                Project Management Tool
              </span>
            </h1>
          </div>

          <div className="border-b border-[var(--border)] p-4 dark:border-gray-800">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/80 dark:text-white dark:focus:bg-gray-900"
              />
            </form>
          </div>

          <nav className="flex-1 space-y-0.5 p-3">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const isExpanded =
                desktopNavGroups[item.name] ??
                item.children?.some(
                  (child) =>
                    pathname === child.href ||
                    pathname.startsWith(`${child.href}/`),
                ) ??
                false;

              if (item.children?.length) {
                return (
                  <div key={item.name} className="mb-1">
                    <div
                      className={cn(
                        "group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out",
                        isNavActive(item)
                          ? "bg-gray-100 text-gray-900 ring-1 ring-gray-300 shadow-sm dark:bg-brand-600/10 dark:text-brand-200 dark:ring-brand-400/20"
                          : "text-gray-600 hover:bg-white/80 hover:text-gray-900 hover:shadow-sm dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-white",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          isNavActive(item)
                            ? "text-gray-800 dark:text-brand-400"
                            : "text-gray-500 group-hover:text-brand-600 dark:text-gray-500 dark:group-hover:text-brand-400",
                        )}
                      />
                      <Link href={item.href} className="flex-1 text-left">
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setDesktopNavGroups((prev) => ({
                            ...prev,
                            [item.name]: !isExpanded,
                          }))
                        }
                        className="rounded-md p-1 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className="mt-1 space-y-1 pl-9">
                        {item.children.map((child) => {
                          const isChildActive =
                            pathname === child.href ||
                            pathname.startsWith(`${child.href}/`);
                          return (
                            <Link
                              key={child.name}
                              href={child.href}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium",
                                isChildActive
                                  ? "bg-gray-100 text-gray-900 ring-1 ring-gray-300 shadow-sm dark:bg-brand-600/15 dark:text-brand-200 dark:ring-brand-400/25"
                                  : "text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-white",
                              )}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                              <span>{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out mb-1",
                    isActive
                      ? "bg-brand-600/[0.12] text-brand-800 ring-1 ring-brand-500/20 dark:bg-brand-600/15 dark:text-brand-200 dark:ring-brand-400/25"
                      : "text-gray-600 hover:bg-white/80 hover:text-gray-900 hover:shadow-sm dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-white",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-transform duration-200 ease-out group-hover:scale-110",
                      isActive
                        ? "text-brand-600 dark:text-brand-400"
                        : "text-gray-500 group-hover:text-brand-600 dark:text-gray-500 dark:group-hover:text-brand-400",
                    )}
                  />
                  <span className="flex-1 text-left">{item.name}</span>
                  {item.name === "Monitoring" && monitoringAlertCount > 0 ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {monitoringAlertCount > 99 ? "99+" : monitoringAlertCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}

            {user?.role !== "SUPER_ADMIN" && !isClient ? (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setDesktopWorkspaceOpen((prev) => !prev)}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-all duration-200 ease-out hover:bg-white/80 hover:text-gray-900 hover:shadow-sm dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
                >
                  <Users2 className="h-[18px] w-[18px] shrink-0 text-gray-500 group-hover:text-brand-600 dark:text-gray-500 dark:group-hover:text-brand-400" />
                  <span className="flex-1 text-left">Workspace</span>
                  {desktopWorkspaceOpen ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                </button>

                {desktopWorkspaceOpen ? (
                  <div className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-white/70 p-2 dark:border-gray-800 dark:bg-white/[0.03]">
                    {teamNavLoading ? (
                      <p className="px-2 py-1 text-xs text-gray-500">
                        Loading teams...
                      </p>
                    ) : user.role === "SUPER_ADMIN" ? (
                      <>
                        <div className="flex items-center justify-between px-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            Scope
                          </span>
                          <Link
                            href="/teams"
                            className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                          >
                            Manage
                          </Link>
                        </div>
                        <div className="max-h-44 space-y-1 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => setAllTeamsMode(true)}
                            className={cn(
                              "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                              isAllTeams
                                ? "bg-brand-50 font-medium text-brand-800 dark:bg-brand-950/50 dark:text-brand-200"
                                : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5",
                            )}
                          >
                            All teams
                          </button>
                          {teams.map((team) => (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => {
                                setAllTeamsMode(false);
                                setActiveTeamId(team.id);
                              }}
                              className={cn(
                                "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                                !isAllTeams && activeTeamId === team.id
                                  ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-white"
                                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5",
                              )}
                            >
                              {team.name}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <SelectMenu
                        value={activeTeamId}
                        onChange={setActiveTeamId}
                        disabled={teams.length === 0}
                        options={teams.map((t) => ({
                          value: t.id,
                          label: t.name,
                        }))}
                        placeholder="Choose team"
                        className="w-full"
                      />
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>

          {/* Desktop User Info */}
          <div className="relative border-t border-[var(--border)] p-4 dark:border-gray-800">
            <div
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1 transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white mouse-pointer">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {user.name}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                aria-expanded={showUserMenu}
                aria-haspopup="true"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute bottom-16 left-3 right-3 overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-card dark:border-gray-700 dark:bg-[#1c1c24]">
                <div className="space-y-0.5 p-2">
                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Profile</span>
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    <Settings className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Settings</span>
                  </Link>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    {theme === "light" ? (
                      <Moon className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Sun className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="font-medium">
                      {theme === "light" ? "Dark mode" : "Light mode"}
                    </span>
                  </button>
                  <div className="my-1 h-px bg-[var(--border)] dark:bg-gray-700" />
                  <button
                    type="button"
                    onClick={requestLogout}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <Power className="h-4 w-4" />
                    <span className="font-medium">Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top bar */}
      <div className="lg:pl-64">
        <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface-elevated)]/95 backdrop-blur-md dark:border-gray-800 dark:bg-[#16161c]/95">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            {/* Left side - Navigation and Search */}
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-700 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Breadcrumb and Page Title */}
              <div className="hidden lg:flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="cursor-pointer transition-colors hover:text-gray-900 dark:hover:text-white">
                    Home
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">/</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {breadcrumbLabel}
                  </span>
                </div>
              </div>

              {/* Desktop Search */}
              <div className="relative hidden lg:block">
                <form onSubmit={handleSearch} className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search workspace…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-72 rounded-md border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-900/80 dark:text-white dark:focus:bg-gray-900 xl:w-80"
                  />
                </form>
              </div>

              {/* Mobile Search */}
              <div className="lg:hidden">
                <button className="text-gray-700 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-lg">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Right side - Actions and User */}
            <div className="flex items-center space-x-4">
              {user?.role !== "SUPER_ADMIN" && !isClient ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickActions(false);
                      setShowUserMenu(false);
                      setNotifOpen((prev) => {
                        const next = !prev;
                        if (next) void loadNotifications();
                        return next;
                      });
                    }}
                    className="relative rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                    title="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 ? (
                      <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </button>

                  {notifOpen ? (
                    <div className="absolute right-0 top-12 z-50 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-card dark:border-gray-700 dark:bg-[#1c1c24]">
                      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 dark:border-gray-700">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          Notifications
                        </p>
                        {unreadCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => void markAllNotificationsRead()}
                            className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                          >
                            Mark all read
                          </button>
                        ) : null}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            No notifications yet
                          </p>
                        ) : (
                          notifications.map((n) => (
                            <button
                              type="button"
                              key={n.id}
                              onClick={() => {
                                void (async () => {
                                  if (!n.read) {
                                    await markNotificationsRead([n.id]);
                                  }
                                  setNotifOpen(false);
                                  if (n.ticketId) {
                                    router.push(`/tickets/${n.ticketId}`);
                                  }
                                })();
                              }}
                              className={cn(
                                "w-full border-b border-[var(--border)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5",
                                !n.read &&
                                  "bg-brand-600/[0.06] dark:bg-brand-600/10",
                              )}
                            >
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {n.title}
                              </p>
                              {n.body ? (
                                <p className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                                  {n.body}
                                </p>
                              ) : null}
                              <p className="mt-1 text-[11px] text-gray-400">
                                {new Date(n.createdAt).toLocaleString()}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Quick Actions */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    setShowUserMenu(false);
                    setShowQuickActions(!showQuickActions);
                  }}
                  className="rounded-md bg-brand-600 p-2 text-white shadow-sm transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
                  title="Quick actions"
                >
                  <Plus className="h-5 w-5" />
                </button>

                {showQuickActions && (
                  <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-card dark:border-gray-700 dark:bg-[#1c1c24]">
                    <div className="p-2">
                      <h3 className="mb-1 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Quick actions
                      </h3>
                      <div className="space-y-0.5">
                        {quickActions.map((action) => (
                          <Link
                            key={action.name}
                            href={action.href}
                            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                            onClick={() => setShowQuickActions(false)}
                          >
                            <action.icon className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">{action.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User Menu (Desktop) */}
              <div className="hidden lg:flex items-center space-x-4">
                {/* User Info */}
                <div className="flex items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.name}
                    </p>
                    <p className="text-xs capitalize text-gray-500 dark:text-gray-400">
                      {user.role.toLowerCase().replace(/_/g, " ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
                    aria-expanded={showUserMenu}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white shadow-sm ring-2 ring-white transition-colors hover:bg-brand-600 dark:ring-gray-900">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </button>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={requestLogout}
                  className="rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                  title="Sign out"
                >
                  <Power className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>

      {/* Backdrop for dropdowns */}
      {(showQuickActions || showUserMenu || notifOpen) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowQuickActions(false);
            setShowUserMenu(false);
            setNotifOpen(false);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Sign out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        confirmVariant="danger"
        busy={logoutBusy}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          void executeLogout();
        }}
      />
    </div>
  );
}
