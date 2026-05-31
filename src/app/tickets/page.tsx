"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Pagination } from "@/components/Pagination";
import CreateTicketModal from "@/components/CreateTicketModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Plus,
  Filter,
  Search,
  Calendar,
  User,
  Building,
  Eye,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock as ClockIcon,
  Zap,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { onRealtimeChange } from "@/lib/realtime-events";

interface Ticket {
  id: string;
  title: string;
  description?: string | null;
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
  project?: {
    id: string;
    name: string;
  } | null;
}

const statusConfig = {
  BACKLOG: {
    label: "Backlog",
    color:
      "bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30",
    icon: ClockIcon,
  },
  TODO: {
    label: "To Do",
    color:
      "bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30",
    icon: ListTodo,
  },
  REFINE: {
    label: "Refine",
    color:
      "bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30",
    icon: Filter,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color:
      "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
    icon: Zap,
  },
  REVISIONS: {
    label: "Review",
    color:
      "bg-yellow-100 text-yellow-900 border border-yellow-400 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30",
    icon: AlertCircle,
  },
  COMPLETE: {
    label: "Complete",
    color:
      "bg-green-100 text-green-800 border border-green-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
    icon: CheckCircle,
  },
  CLIENT_REVIEW: {
    label: "Client Review",
    color:
      "bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30",
    icon: Eye,
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

export default function TicketsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    isAllTeams,
    setAllTeamsMode,
    loading: teamLoading,
  } = useTeam();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingDeleteTicketId, setPendingDeleteTicketId] = useState<
    string | null
  >(null);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  const [priorityFilter, setPriorityFilter] = useState<string>("");

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    if (user.role === "CLIENT") {
      setLoading(false);
      return;
    }
    try {
      setError("");
      const params = new URLSearchParams();
      if (statusFilter) {
        params.append("status", statusFilter);
      }
      if (priorityFilter) {
        params.append("priority", priorityFilter);
      }
      if (user.role === "USER") {
        if (!activeTeamId) {
          setTickets([]);
          setLoading(false);
          return;
        }
        params.set("teamId", activeTeamId);
      } else if (user.role === "SUPER_ADMIN") {
        if (!isAllTeams && activeTeamId) {
          params.set("teamId", activeTeamId);
        }
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
  }, [statusFilter, priorityFilter, user, activeTeamId, isAllTeams]);

  useEffect(() => {
    if (user && user.role !== "CLIENT") fetchTickets();
  }, [statusFilter, priorityFilter, fetchTickets, user]);

  useEffect(() => {
    if (!user || user.role === "CLIENT") return;

    const unsubscribe = onRealtimeChange((detail) => {
      if (
        detail.table !== "Ticket" &&
        detail.table !== "Client" &&
        detail.table !== "Project" &&
        detail.table !== "Team"
      ) {
        return;
      }
      void fetchTickets();
    });

    return unsubscribe;
  }, [user, fetchTickets]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, priorityFilter, activeTeamId, isAllTeams]);

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
    projectId?: string;
    description?: string;
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

        if (!response.ok) {
          throw new Error("Failed to create ticket");
        }

        await fetchTickets();
      } catch {
        setError("Failed to create ticket");
      }
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
    setPendingDeleteTicketId(ticketId);
  };

  const confirmDeleteTicket = async () => {
    if (!pendingDeleteTicketId) return;
    await deleteTicketById(pendingDeleteTicketId);
    setPendingDeleteTicketId(null);
  };

  const goToTicket = (id: string) => {
    router.push(`/tickets/${id}`);
  };

  const filteredTickets = tickets.filter(
    (ticket) =>
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.assignee?.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const pagedTickets = filteredTickets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              All Tickets
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage and track all your project tickets
            </p>
          </div>

          <div className="flex items-center gap-3">
            {user.role !== "CLIENT" && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Ticket</span>
              </button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/80 dark:bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-gray-800/50 p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tickets, clients, or assignees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-3">
              <select
                value={
                  user.role === "SUPER_ADMIN"
                    ? isAllTeams
                      ? "__all__"
                      : activeTeamId
                    : activeTeamId
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (user.role === "SUPER_ADMIN") {
                    if (v === "__all__") setAllTeamsMode(true);
                    else {
                      setAllTeamsMode(false);
                      setActiveTeamId(v);
                    }
                  } else {
                    setActiveTeamId(v);
                  }
                }}
                disabled={
                  teamLoading || teams.length === 0 || user.role === "CLIENT"
                }
                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              >
                {user?.role === "SUPER_ADMIN" && (
                  <option value="__all__">All teams</option>
                )}
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              >
                <option value="">All Statuses</option>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              >
                {priorityFilterOptions.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Tickets Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              No tickets found
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "space-y-4",
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  : "",
              )}
            >
              {pagedTickets.map((ticket) => {
                const status =
                  statusConfig[ticket.status as keyof typeof statusConfig];
                const StatusIcon = status.icon;

                return (
                  <div
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
                    className="group cursor-pointer rounded-xl border border-gray-200/80 bg-white/90 p-6 backdrop-blur-xl transition-all duration-200 hover:border-brand-300/50 dark:border-gray-800/50 dark:bg-gray-900/50 dark:hover:border-gray-700/50"
                  >
                    {/* Header */}
                    <div className="mb-4 flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="mb-1 font-semibold text-gray-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                          {ticket.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Click card to view full details
                        </p>
                        <div className="mt-2 flex items-center space-x-2">
                          <span
                            className={cn(
                              "inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border",
                              status.color,
                            )}
                          >
                            <StatusIcon className="w-3 h-3" />
                            <span>{status.label}</span>
                          </span>
                        </div>
                      </div>

                      {(user.role === "USER" ||
                        user.role === "SUPER_ADMIN") && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              goToTicket(ticket.id);
                            }}
                            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-white/10 dark:hover:text-brand-400"
                            title="View ticket details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTicket(ticket.id);
                            }}
                            className="rounded-md p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                            title="Delete ticket"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <Building className="w-4 h-4" />
                        <span>{ticket.client?.name || "No client"}</span>
                      </div>

                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <User className="w-4 h-4" />
                        <span>{ticket.assignee?.name || "Unassigned"}</span>
                      </div>

                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    {user.role === "USER" || user.role === "SUPER_ADMIN" ? (
                      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-800/50">
                        <select
                          value={ticket.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleStatusChange(ticket.id, e.target.value)
                          }
                          className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        >
                          {Object.entries(statusConfig).map(([key, config]) => (
                            <option key={key} value={key}>
                              {config.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}

        <CreateTicketModal
          isOpen={showCreateModal}
          defaultTeamId={
            user.role === "SUPER_ADMIN"
              ? isAllTeams
                ? ""
                : activeTeamId
              : activeTeamId
          }
          teams={teams}
        />
        <ConfirmDialog
          isOpen={pendingDeleteTicketId !== null}
          title="Delete ticket"
          message="Are you sure you want to delete this ticket?"
          confirmLabel="Delete"
          onCancel={() => setPendingDeleteTicketId(null)}
          onConfirm={() => {
            void confirmDeleteTicket();
          }}
        />
      </div>
    </DashboardLayout>
  );
}
