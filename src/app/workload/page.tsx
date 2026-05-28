"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import DashboardLayout from "@/components/DashboardLayout";
import CreateTicketModal from "@/components/CreateTicketModal";
import KanbanBoard from "@/components/KanbanBoard";
import { SelectMenu } from "@/components/SelectMenu";
import {
  Plus,
  Search,
  Clock as ClockIcon,
  Zap,
  AlertCircle,
  Eye,
  Edit,
  CheckCircle2,
  Trash2,
  ListTodo,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { onRealtimeChange } from "@/lib/realtime-events";

interface Ticket {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
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

interface WorkloadUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const statusConfig = {
  BACKLOG: {
    label: "Backlog",
    color:
      "bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30",
    icon: ClockIcon,
    bgColor: "bg-gray-500/10",
  },
  TODO: {
    label: "To Do",
    color:
      "bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30",
    icon: ListTodo,
    bgColor: "bg-slate-500/10",
  },
  REFINE: {
    label: "Refine",
    color:
      "bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30",
    icon: Filter,
    bgColor: "bg-indigo-500/10",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color:
      "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
    icon: Zap,
    bgColor: "bg-blue-500/10",
  },
  REVISIONS: {
    label: "Review",
    color:
      "bg-yellow-100 text-yellow-900 border border-yellow-400 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30",
    icon: AlertCircle,
    bgColor: "bg-yellow-500/10",
  },
  COMPLETE: {
    label: "Complete",
    color:
      "bg-green-100 text-green-800 border border-green-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
    icon: CheckCircle2,
    bgColor: "bg-green-500/10",
  },
  CLIENT_REVIEW: {
    label: "Client Review",
    color:
      "bg-brand-100 text-brand-800 border border-brand-300 dark:bg-brand-600/20 dark:text-brand-400 dark:border-brand-500/30",
    icon: Eye,
    bgColor: "bg-brand-600/10",
  },
};

const priorityFilterOptions = [
  { value: "", label: "All priorities" },
  { value: "NONE", label: "None" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export default function WorkloadPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { teams, activeTeamId, isAllTeams } = useTeam();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedView, setSelectedView] = useState<"kanban" | "list">("kanban");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [workloadUsers, setWorkloadUsers] = useState<WorkloadUser[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] =
    useState<string>("__all__");
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const statusFilterOptions = [
    { value: "", label: "All statuses" },
    ...Object.entries(statusConfig).map(([key, config]) => ({
      value: key,
      label: config.label,
    })),
  ];

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (statusFilter) {
        params.append("status", statusFilter);
      }
      if (priorityFilter) {
        params.append("priority", priorityFilter);
      }

      if (user.role === "SUPER_ADMIN") {
        if (selectedAssigneeId !== "__all__") {
          params.set("assigneeId", selectedAssigneeId);
        }
      } else {
        params.set("myWorkload", "1");
      }

      const response = await fetch(`/api/tickets?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch tickets");
      }

      const data = await response.json();
      setTickets(data);
    } catch {
      setError("Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, user, selectedAssigneeId]);

  const fetchWorkloadUsers = useCallback(async () => {
    if (!user || user.role !== "SUPER_ADMIN") return;
    try {
      const response = await fetch("/api/workload/users");
      if (!response.ok) {
        throw new Error("Failed to fetch workload users");
      }
      const data = (await response.json()) as WorkloadUser[];
      setWorkloadUsers(Array.isArray(data) ? data : []);
    } catch {
      setWorkloadUsers([]);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      void fetchTickets();
    }
  }, [statusFilter, priorityFilter, authLoading, user, fetchTickets]);

  useEffect(() => {
    if (!authLoading && user?.role === "SUPER_ADMIN") {
      void fetchWorkloadUsers();
    }
  }, [authLoading, user, fetchWorkloadUsers]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onRealtimeChange((detail) => {
      if (detail.table !== "Ticket") return;
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

      if (!response.ok) {
        throw new Error("Failed to update ticket");
      }

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

  const handleCreateTicket = async (ticketData: CreateTicketPayload) => {
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ticketData),
      });

      if (!response.ok) {
        throw new Error("Failed to create ticket");
      }

      await fetchTickets();
    } catch (error) {
      console.error(error);
    }
  };

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

  const deleteTicketById = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete ticket");
      }

      fetchTickets();
    } catch {}
  };

  const handleDeleteTicket = (ticketId: string) => {
    if (!confirm("Are you sure you want to delete this ticket?")) {
      return;
    }
    void deleteTicketById(ticketId);
  };

  const goToTicket = (ticketId: string) => {
    router.push(`/tickets/${ticketId}`);
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (isSuperAdmin && selectedAssigneeId === "__all__" && !ticket.assignee) {
      return false;
    }

    const matchesSearch =
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.assignee?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const workloadUserOptions = [
    { value: "__all__", label: "All employees" },
    ...workloadUsers.map((workloadUser) => ({
      value: workloadUser.id,
      label: `${workloadUser.name} (${workloadUser.role})`,
    })),
  ];

  const selectedWorkloadUser = workloadUsers.find(
    (workloadUser) => workloadUser.id === selectedAssigneeId,
  );

  const overdueCount = filteredTickets.filter((ticket) => {
    if (!ticket.dueDate) return false;
    const due = new Date(ticket.dueDate);
    return !Number.isNaN(due.getTime()) && due < new Date();
  }).length;

  const inProgressCount = filteredTickets.filter(
    (ticket) => ticket.status === "IN_PROGRESS",
  ).length;

  const clientReviewCount = filteredTickets.filter(
    (ticket) => ticket.status === "CLIENT_REVIEW",
  ).length;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600 dark:border-gray-700"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isSuperAdmin ? "Workload" : "My Workload"}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isSuperAdmin
                ? "View workload by employee or admin."
                : "Tickets assigned to you."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-0.5 shadow-sm dark:border-gray-800 dark:bg-[#1c1c24]">
              <button
                type="button"
                onClick={() => setSelectedView("kanban")}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-all",
                  selectedView === "kanban"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
                )}
              >
                <span>Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedView("list")}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-all",
                  selectedView === "list"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
                )}
              >
                <span>List</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Ticket</span>
            </button>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-[#1c1c24]">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Scope
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {selectedAssigneeId === "__all__"
                  ? "All employees"
                  : selectedWorkloadUser?.name || "Selected employee"}
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 shadow-sm dark:border-blue-900/40 dark:bg-blue-900/10">
              <p className="text-xs uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Total assigned
              </p>
              <p className="mt-1 text-2xl font-semibold text-blue-800 dark:text-blue-200">
                {filteredTickets.length}
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 shadow-sm dark:border-indigo-900/40 dark:bg-indigo-900/10">
              <p className="text-xs uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                In progress
              </p>
              <p className="mt-1 text-2xl font-semibold text-indigo-800 dark:text-indigo-200">
                {inProgressCount}
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 shadow-sm dark:border-red-900/40 dark:bg-red-900/10">
              <p className="text-xs uppercase tracking-wide text-red-700 dark:text-red-300">
                Overdue
              </p>
              <p className="mt-1 text-2xl font-semibold text-red-800 dark:text-red-200">
                {overdueCount}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/10 sm:col-span-2 xl:col-span-4">
              <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Awaiting client review
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-800 dark:text-amber-200">
                {clientReviewCount}
              </p>
            </div>
          </div>
        )}

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
              {isSuperAdmin && (
                <SelectMenu
                  value={selectedAssigneeId}
                  onChange={setSelectedAssigneeId}
                  options={workloadUserOptions}
                  placeholder="Employee"
                  className="min-w-[240px]"
                  triggerClassName="bg-gray-100/80 dark:bg-slate-800/80"
                />
              )}

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

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600 dark:border-gray-700"></div>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-12 bg-white/80 dark:bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-200/80 dark:border-gray-800/50">
            <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
              {isSuperAdmin
                ? "No tickets for this view"
                : "No tickets in your workload"}
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mb-4">
              {isSuperAdmin
                ? "Select an employee to see all tickets assigned to them."
                : "Tickets assigned to you will appear here."}
            </p>
          </div>
        ) : selectedView === "kanban" ? (
          <KanbanBoard
            tickets={filteredTickets}
            onStatusChange={handleStatusChange}
            onTicketClick={(ticket) => goToTicket(ticket.id)}
            userRole={user.role}
            onCreateTicket={() => {
              setShowCreateModal(true);
            }}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white/90 dark:border-gray-800/50 dark:bg-gray-900/50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800/50">
                    <th className="text-left p-6 text-gray-600 dark:text-gray-400 font-medium">
                      Title
                    </th>
                    <th className="text-left p-6 text-gray-600 dark:text-gray-400 font-medium">
                      Status
                    </th>
                    <th className="text-left p-6 text-gray-600 dark:text-gray-400 font-medium">
                      Client
                    </th>
                    {isSuperAdmin ? (
                      <th className="text-left p-6 text-gray-600 dark:text-gray-400 font-medium">
                        Assignee
                      </th>
                    ) : null}
                    <th className="text-left p-6 text-gray-600 dark:text-gray-400 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => {
                    const status =
                      statusConfig[ticket.status as keyof typeof statusConfig];
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
                          goToTicket(ticket.id);
                        }}
                        className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50/90 dark:border-gray-800/30 dark:hover:bg-gray-800/30"
                      >
                        <td className="p-6">
                          <div>
                            <p className="text-gray-900 dark:text-white font-medium">
                              {ticket.title}
                            </p>
                          </div>
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
                          <p className="text-gray-700 dark:text-gray-300">
                            {ticket.client?.name || "No client"}
                          </p>
                        </td>
                        {isSuperAdmin ? (
                          <>
                            <td className="p-6">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {ticket.assignee?.name ?? "Unassigned"}
                              </p>
                              {ticket.assignee?.email ? (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {ticket.assignee.email}
                                </p>
                              ) : null}
                            </td>
                          </>
                        ) : null}
                        <td className="p-6">
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                goToTicket(ticket.id);
                              }}
                              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 relative group"
                              title="View ticket details"
                            >
                              <Eye className="w-4 h-4" />
                              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                View details
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                goToTicket(ticket.id);
                              }}
                              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 relative group"
                              title="Edit ticket"
                            >
                              <Edit className="w-4 h-4" />
                              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Edit ticket
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTicket(ticket.id);
                              }}
                              className="text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 p-1 relative group"
                              title="Delete ticket"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Delete ticket
                              </span>
                            </button>
                            <select
                              value={ticket.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleStatusChange(ticket.id, e.target.value)
                              }
                              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800/50 dark:text-white"
                            >
                              {Object.entries(statusConfig).map(
                                ([key, config]) => (
                                  <option key={key} value={key}>
                                    {config.label}
                                  </option>
                                ),
                              )}
                            </select>
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
        <CreateTicketModal
          isOpen={showCreateModal}
          defaultTeamId={isAllTeams ? "" : activeTeamId}
          teams={teams}
        />
      </div>
    </DashboardLayout>
  );
}
