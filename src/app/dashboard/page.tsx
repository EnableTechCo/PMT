"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import DashboardLayout from "@/components/DashboardLayout";
import DashboardHeader from "@/components/DashboardHeader";
import { OverviewMetricStrip } from "@/components/OverviewMetricStrip";
import { SelectMenu } from "@/components/SelectMenu";
import CreateTicketModal from "@/components/CreateTicketModal";
import KanbanBoard from "@/components/KanbanBoard";
import { Pagination } from "@/components/Pagination";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Clock as ClockIcon,
  Zap,
  AlertCircle,
  CheckCircle2,
  ListTodo,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { onRealtimeChange } from "@/lib/realtime-events";

interface Ticket {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  client?: {
    id: string;
    name: string;
    email: string;
  };
  team?: {
    id: string;
    name: string;
  } | null;
}

const statusConfig = {
  BACKLOG: {
    label: "Backlog",
    color:
      "bg-gray-500/20 dark:bg-white text-gray-400 border-gray-500/30 dark:text-gray-900 dark:border-gray-500/30",
    icon: ClockIcon,
    bgColor: "bg-gray-500/10 dark:bg-white",
  },
  TODO: {
    label: "To Do",
    color:
      "bg-slate-500/20 text-slate-500 dark:text-slate-400 border-slate-500/30",
    icon: ListTodo,
    bgColor: "bg-slate-500/10",
  },
  REFINE: {
    label: "Refine",
    color:
      "bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 border-indigo-500/30",
    icon: Filter,
    bgColor: "bg-indigo-500/10",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: Zap,
    bgColor: "bg-blue-500/10",
  },
  REVISIONS: {
    label: "REVIEW",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: AlertCircle,
    bgColor: "bg-yellow-500/10",
  },
  COMPLETE: {
    label: "Complete",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: CheckCircle2,
    bgColor: "bg-green-500/10",
  },
  CLIENT_REVIEW: {
    label: "Client Review",
    color:
      "bg-brand-600/15 text-brand-700 border border-brand-500/25 dark:text-brand-300 dark:border-brand-500/30",
    icon: Eye,
    bgColor: "bg-brand-600/10",
  },
};

const statusFilterOptions = [
  { value: "", label: "All statuses" },
  ...Object.entries(statusConfig).map(([key, config]) => ({
    value: key,
    label: config.label,
  })),
];

const rowStatusOptions = Object.entries(statusConfig).map(([key, config]) => ({
  value: key,
  label: config.label,
}));

const priorityFilterOptions = [
  { value: "", label: "All priorities" },
  { value: "NONE", label: "None" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    isAllTeams,
    setAllTeamsMode,
    loading: teamListLoading,
  } = useTeam();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedView, setSelectedView] = useState<"kanban" | "list">("kanban");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  const fetchTickets = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (priorityFilter) params.append("priority", priorityFilter);

      if (user.role === "USER") {
        if (!activeTeamId) {
          setTickets([]);
          setLoading(false);
          return;
        }
        params.append("teamId", activeTeamId);
      } else if (user.role === "SUPER_ADMIN") {
        if (!isAllTeams && activeTeamId) {
          params.append("teamId", activeTeamId);
        }
      }

      const response = await fetch(`/api/tickets?${params}`);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch tickets");
      }

      const data = await response.json();
      setTickets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, priorityFilter, activeTeamId, isAllTeams]);

  useEffect(() => {
    if (authLoading || !user) return;
    void fetchTickets();
  }, [authLoading, user, fetchTickets]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onRealtimeChange((detail) => {
      if (
        detail.table !== "Ticket" &&
        detail.table !== "Project" &&
        detail.table !== "Client"
      ) {
        return;
      }
      void fetchTickets();
    });

    return unsubscribe;
  }, [user, fetchTickets]);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update ticket");
      fetchTickets();
    } catch {}
  };

  type CreateTicketPayload = {
    title: string;
    status: string;
    clientId?: string;
    teamId: string;
    assigneeId?: string;
    priority: string;
    startDate?: string;
    dueDate?: string;
  };

  const handleCreateTicket = useCallback(
    async (ticketData: CreateTicketPayload) => {
      try {
        const response = await fetch("/api/tickets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(ticketData),
        });

        if (!response.ok) throw new Error("Failed to create ticket");

        await response.json();
        fetchTickets();
      } catch {}
    },
    [fetchTickets],
  );

  useEffect(() => {
    const onModalSubmit = (event: Event) => {
      const customEvent = event as CustomEvent<CreateTicketPayload>;
      void handleCreateTicket(customEvent.detail);
      setShowCreateModal(false);
    };

    const onModalClose = () => {
      setShowCreateModal(false);
    };

    window.addEventListener(
      "create-ticket-modal-submit",
      onModalSubmit as EventListener,
    );
    window.addEventListener("create-ticket-modal-close", onModalClose);

    return () => {
      window.removeEventListener(
        "create-ticket-modal-submit",
        onModalSubmit as EventListener,
      );
      window.removeEventListener("create-ticket-modal-close", onModalClose);
    };
  }, [handleCreateTicket]);

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.client?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const pagedTickets = filteredTickets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, priorityFilter, activeTeamId, isAllTeams]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 border-t-brand-600 dark:border-gray-700"></div>
      </div>
    );
  }

  if (!user) return null;

  if (user.role === "SUPER_ADMIN") {
    return (
      <DashboardLayout>
        <div className="w-full space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                Super Admin Overview
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Full project oversight and team management.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/executive"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
              >
                Executive analytics
              </Link>
              <Link
                href="/teams"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-[#1c1c24] dark:text-white dark:hover:bg-white/5"
              >
                Manage teams
              </Link>
              <Link
                href="/projects"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-[#1c1c24] dark:text-white dark:hover:bg-white/5"
              >
                Projects
              </Link>
            </div>
          </div>
          {/* Add graphs and overview here */}
          <OverviewMetricStrip
            metrics={[
              {
                label: "total tickets",
                value: tickets.length,
              },
              {
                label: "in progress",
                value: tickets.filter((t) => t.status === "IN_PROGRESS").length,
              },
              {
                label: "completed",
                value: tickets.filter((t) => t.status === "COMPLETE").length,
              },
              {
                label: "teams",
                value: teams.length,
              },
            ]}
          />
          {/* Team selector for super admin */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-600">
              Team scope
            </span>
            <SelectMenu
              value={isAllTeams ? "__all__" : activeTeamId}
              onChange={(v) => {
                if (v === "__all__") setAllTeamsMode(true);
                else {
                  setAllTeamsMode(false);
                  setActiveTeamId(v);
                }
              }}
              disabled={teamListLoading}
              options={[
                { value: "__all__", label: "All teams" },
                ...teams.map((team) => ({
                  value: team.id,
                  label: team.name,
                })),
              ]}
              className="min-w-[220px]"
            />
            <SelectMenu
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={priorityFilterOptions}
              placeholder="Priority"
              className="min-w-[160px]"
            />
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create ticket</span>
            </button>
          </div>
          {/* Kanban for overview */}
          <KanbanBoard
            tickets={filteredTickets}
            onStatusChange={handleStatusChange}
            onTicketClick={(ticket) => {
              router.push(`/tickets/${ticket.id}`);
            }}
            userRole={user.role}
            onCreateTicket={() => setShowCreateModal(true)}
          />

          <CreateTicketModal
            isOpen={showCreateModal}
            defaultTeamId={isAllTeams ? "" : activeTeamId}
            teams={teams}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">
        <DashboardHeader
          user={user}
          teams={teams}
          teamListLoading={teamListLoading}
          selectedView={selectedView}
          setSelectedView={setSelectedView}
          setShowCreateModal={setShowCreateModal}
        />

        {selectedView === "kanban" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search tickets or clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder-gray-500 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-[#1c1c24] dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {user.role === "SUPER_ADMIN" ? (
                    <SelectMenu
                      value={activeTeamId}
                      onChange={setActiveTeamId}
                      disabled={teamListLoading || teams.length === 0}
                      options={teams.map((team) => ({
                        value: team.id,
                        label: team.name,
                      }))}
                      placeholder="Team"
                      className="min-w-[180px]"
                      triggerClassName="bg-gray-100/80 dark:bg-slate-800/80"
                    />
                  ) : null}

                  <SelectMenu
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={statusFilterOptions}
                    placeholder="Status"
                    className="min-w-[200px]"
                    triggerClassName="bg-gray-100/80 dark:bg-slate-800/80"
                  />

                  <SelectMenu
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    options={priorityFilterOptions}
                    placeholder="Priority"
                    className="min-w-[180px]"
                    triggerClassName="bg-gray-100/80 dark:bg-slate-800/80"
                  />
                </div>
              </div>
            </div>

            <KanbanBoard
              tickets={filteredTickets}
              onStatusChange={handleStatusChange}
              onTicketClick={(ticket) => {
                router.push(`/tickets/${ticket.id}`);
              }}
              userRole={user.role}
              onCreateTicket={() => setShowCreateModal(true)}
            />
          </div>
        )}

        {selectedView === "list" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search tickets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder-gray-500 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-[#1c1c24] dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {user.role === "SUPER_ADMIN" ? (
                    <SelectMenu
                      value={activeTeamId}
                      onChange={setActiveTeamId}
                      disabled={teamListLoading || teams.length === 0}
                      options={teams.map((team) => ({
                        value: team.id,
                        label: team.name,
                      }))}
                      placeholder="Team"
                      className="min-w-[180px]"
                      triggerClassName="bg-gray-100/80 dark:bg-slate-800/80"
                    />
                  ) : null}

                  <SelectMenu
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={statusFilterOptions}
                    placeholder="Status"
                    className="min-w-[200px]"
                    triggerClassName="bg-gray-100/80 dark:bg-slate-800/80"
                  />

                  <SelectMenu
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    options={priorityFilterOptions}
                    placeholder="Priority"
                    className="min-w-[180px]"
                    triggerClassName="bg-gray-100/80 dark:bg-slate-800/80"
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600 dark:border-gray-700"></div>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] py-12 text-center shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
                <p className="text-gray-600 text-lg mb-2">No tickets found</p>
                <p className="text-gray-500 text-sm mb-4">
                  Try adjusting your search or filters
                </p>
                {user.role === "USER" && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary"
                  >
                    Create your first ticket
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-6 text-gray-500 font-medium">
                          Title
                        </th>
                        <th className="text-left p-6 text-gray-500 font-medium">
                          Assignee
                        </th>
                        <th className="text-left p-6 text-gray-500 font-medium">
                          Status
                        </th>
                        <th className="text-left p-6 text-gray-500 font-medium">
                          Client
                        </th>
                        <th className="text-left p-6 text-gray-500 font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedTickets.map((ticket) => {
                        const status =
                          statusConfig[
                            ticket.status as keyof typeof statusConfig
                          ];
                        const StatusIcon = status.icon;

                        return (
                          <tr
                            key={ticket.id}
                            onClick={(e) => {
                              if (
                                (e.target as HTMLElement).closest(
                                  "button, select, option, a",
                                )
                              ) {
                                return;
                              }
                              router.push(`/tickets/${ticket.id}`);
                            }}
                            className="border-b border-gray-200 transition-colors hover:bg-gray-600 cursor-pointer"
                          >
                            <td className="p-6">
                              <div>
                                <p className="text-slate-900 font-medium dark:text-white">
                                  {ticket.title}
                                </p>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                  by {ticket.creator.name}
                                </p>
                              </div>
                            </td>
                            <td className="p-6">
                              <p className="text-gray-300 dark:text-gray-400 dark:hover:text-gray-900">
                                {ticket.assignee?.name || "Unassigned"}
                              </p>
                            </td>
                            <td className="p-6">
                              <span
                                className={cn(
                                  "inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border",
                                  status.color,
                                )}
                              >
                                <StatusIcon className="w-3 h-3" />
                                <span>{status.label}</span>
                              </span>
                            </td>
                            <td className="p-6">
                              <p className="text-gray-300">
                                {ticket.client?.name || "No client"}
                              </p>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  className="text-gray-500 hover:text-gray-900 dark:text-white p-1 relative group"
                                  onClick={() =>
                                    router.push(`/tickets/${ticket.id}`)
                                  }
                                  title="View ticket details"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-white text-slate-900 text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    View details
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className="text-gray-500 hover:text-gray-900 dark:text-white p-1 relative group"
                                  onClick={() =>
                                    router.push(`/tickets/${ticket.id}`)
                                  }
                                  title="Edit ticket"
                                >
                                  <Edit className="w-4 h-4" />
                                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-white text-slate-900 text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    Edit ticket
                                  </span>
                                </button>
                                <SelectMenu
                                  value={ticket.status}
                                  onChange={(v) =>
                                    handleStatusChange(ticket.id, v)
                                  }
                                  options={rowStatusOptions}
                                  size="sm"
                                  className="w-[9.75rem]"
                                  menuClassName="z-[100]"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <CreateTicketModal
          isOpen={showCreateModal}
          defaultTeamId={activeTeamId}
          teams={teams}
        />
      </div>
    </DashboardLayout>
  );
}
