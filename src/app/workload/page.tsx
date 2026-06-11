"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import DashboardLayout from "@/components/DashboardLayout";
import CreateTicketModal from "@/components/CreateTicketModal";
import type {
  CreateTicketPayload,
  CreateTicketResultDetail,
  CreateTicketSubmitDetail,
} from "@/components/CreateTicketModal";
import KanbanBoard from "@/components/KanbanBoard";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SelectMenu } from "@/components/SelectMenu";
import {
  Plus,
  Search,
  Loader2,
  X,
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
  selectorId?: number | null;
  title: string;
  status: string;
  priority?: string | null;
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

function ticketDisplayId(ticket: Ticket): string {
  if (typeof ticket.selectorId === "number") {
    return `#${ticket.selectorId}`;
  }
  return "No selector ID";
}

interface WorkloadUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

type MemberDetailMetric =
  | "assigned"
  | "done"
  | "inProgress"
  | "review"
  | "overdue"
  | "urgentOpen";

type MemberDetailModalState = {
  memberId: string;
  memberName: string;
  metric: MemberDetailMetric;
} | null;

interface GithubRepoItem {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  owner: {
    login: string;
  };
}

interface GithubPullRequestItem {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url?: string;
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
  IN_REVIEW: {
    label: "In Review",
    color:
      "bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30",
    icon: Eye,
    bgColor: "bg-cyan-500/10",
  },
  QA: {
    label: "QA",
    color:
      "bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30",
    icon: AlertCircle,
    bgColor: "bg-orange-500/10",
  },
  REVISIONS: {
    label: "Revisions",
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
  const [pendingDeleteTicketId, setPendingDeleteTicketId] = useState<
    string | null
  >(null);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedView, setSelectedView] = useState<"kanban" | "list">("kanban");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [workloadUsers, setWorkloadUsers] = useState<WorkloadUser[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] =
    useState<string>("__all__");
  const [opsBusy, setOpsBusy] = useState(false);
  const [opsError, setOpsError] = useState("");
  const [opsMessage, setOpsMessage] = useState("");
  const [selectorInput, setSelectorInput] = useState("");
  const [assignOwner, setAssignOwner] = useState("");
  const [assignRepo, setAssignRepo] = useState("");
  const [assignPrNumber, setAssignPrNumber] = useState("");
  const [githubRepos, setGithubRepos] = useState<GithubRepoItem[]>([]);
  const [repoPullRequests, setRepoPullRequests] = useState<
    GithubPullRequestItem[]
  >([]);
  const [githubOptionsLoading, setGithubOptionsLoading] = useState(false);
  const [memberDetailModal, setMemberDetailModal] =
    useState<MemberDetailModalState>(null);
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

  const fetchGithubRepos = useCallback(async () => {
    if (!user || user.role !== "SUPER_ADMIN") return;

    try {
      setGithubOptionsLoading(true);
      const response = await fetch("/api/github/repos");
      const body = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Failed to load GitHub repositories",
        );
      }

      setGithubRepos(Array.isArray(body) ? (body as GithubRepoItem[]) : []);
    } catch (err) {
      setGithubRepos([]);
      setRepoPullRequests([]);
      setOpsError(
        err instanceof Error
          ? err.message
          : "Failed to load GitHub repositories",
      );
    } finally {
      setGithubOptionsLoading(false);
    }
  }, [user]);

  const fetchRepoPullRequests = useCallback(
    async (owner: string, repo: string) => {
      if (!owner || !repo) {
        setRepoPullRequests([]);
        return;
      }

      try {
        setGithubOptionsLoading(true);
        const params = new URLSearchParams({ owner, repo });
        const response = await fetch(`/api/github/pull-requests?${params}`);
        const body = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error(
            typeof body?.error === "string"
              ? body.error
              : "Failed to load repository pull requests",
          );
        }

        setRepoPullRequests(
          Array.isArray(body) ? (body as GithubPullRequestItem[]) : [],
        );
      } catch (err) {
        setRepoPullRequests([]);
        setOpsError(
          err instanceof Error
            ? err.message
            : "Failed to load repository pull requests",
        );
      } finally {
        setGithubOptionsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!authLoading && user) {
      void fetchTickets();
    }
  }, [statusFilter, priorityFilter, authLoading, user, fetchTickets]);

  useEffect(() => {
    if (!authLoading && user?.role === "SUPER_ADMIN") {
      void fetchWorkloadUsers();
      void fetchGithubRepos();
    }
  }, [authLoading, user, fetchWorkloadUsers, fetchGithubRepos]);

  useEffect(() => {
    const matchingRepos = githubRepos.filter(
      (repo) => repo.owner?.login === assignOwner,
    );

    if (!assignOwner) {
      setAssignRepo("");
      setAssignPrNumber("");
      setRepoPullRequests([]);
      return;
    }

    if (!matchingRepos.some((repo) => repo.name === assignRepo)) {
      setAssignRepo(matchingRepos[0]?.name ?? "");
    }
  }, [assignOwner, assignRepo, githubRepos]);

  useEffect(() => {
    if (!assignOwner || !assignRepo) {
      setAssignPrNumber("");
      setRepoPullRequests([]);
      return;
    }

    void fetchRepoPullRequests(assignOwner, assignRepo);
  }, [assignOwner, assignRepo, fetchRepoPullRequests]);

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

        const created = (await response.json()) as { id?: string };
        await fetchTickets();
        return created;
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    [fetchTickets],
  );

  useEffect(() => {
    const onModalSubmit = (event: Event) => {
      const customEvent = event as CustomEvent<CreateTicketSubmitDetail>;
      void (async () => {
        const created = await handleCreateTicket(customEvent.detail.payload);
        const ok = Boolean(created?.id);

        window.dispatchEvent(
          new CustomEvent<CreateTicketResultDetail>(
            "create-ticket-modal-result",
            {
              detail: {
                ok,
                message: ok ? undefined : "Failed to create ticket.",
              },
            },
          ),
        );

        if (!ok) return;

        setShowCreateModal(false);
        if (customEvent.detail.openAfterCreate && created?.id) {
          router.push(`/tickets/${created.id}`);
        }
      })();
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
  }, [handleCreateTicket, router]);

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

  const runSelectorBackfill = async () => {
    setOpsBusy(true);
    setOpsError("");
    setOpsMessage("");

    try {
      const response = await fetch("/api/tickets/selector-ids/backfill", {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || "Failed to backfill selector IDs");
      }

      setOpsMessage(
        `Selector ID backfill complete: ${body.updated ?? 0} updated out of ${body.total ?? 0} tickets.`,
      );
      await fetchTickets();
    } catch (err) {
      setOpsError(
        err instanceof Error ? err.message : "Failed to backfill selector IDs",
      );
    } finally {
      setOpsBusy(false);
    }
  };

  const assignExistingPr = async () => {
    const parsedSelector = Number.parseInt(selectorInput, 10);
    const parsedPrNumber = Number.parseInt(assignPrNumber, 10);

    if (!Number.isFinite(parsedSelector) || parsedSelector <= 0) {
      setOpsError("Selector ID must be a valid positive number.");
      return;
    }

    if (!assignOwner.trim() || !assignRepo.trim()) {
      setOpsError("Owner and repo are required.");
      return;
    }

    if (!Number.isFinite(parsedPrNumber) || parsedPrNumber <= 0) {
      setOpsError("PR number must be a valid positive number.");
      return;
    }

    setOpsBusy(true);
    setOpsError("");
    setOpsMessage("");

    try {
      const response = await fetch("/api/github/pull-requests/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: assignOwner.trim(),
          repo: assignRepo.trim(),
          number: parsedPrNumber,
          selectorId: parsedSelector,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || "Failed to link PR to ticket");
      }

      setOpsMessage(
        `PR #${parsedPrNumber} linked to ticket selector #${parsedSelector}.`,
      );
      setAssignPrNumber("");
      await fetchTickets();
    } catch (err) {
      setOpsError(
        err instanceof Error ? err.message : "Failed to link PR to ticket",
      );
    } finally {
      setOpsBusy(false);
    }
  };

  const confirmDeleteTicket = async () => {
    if (!pendingDeleteTicketId) return;
    await deleteTicketById(pendingDeleteTicketId);
    setPendingDeleteTicketId(null);
  };

  const goToTicket = (ticketId: string) => {
    router.push(`/tickets/${ticketId}`);
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (isSuperAdmin && selectedAssigneeId === "__all__" && !ticket.assignee) {
      return false;
    }

    const matchesSearch =
      isSuperAdmin ||
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.assignee?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const memberWorkloadCards = workloadUsers
    .map((workloadUser) => {
      const assignedTickets = tickets.filter(
        (ticket) => ticket.assignee?.id === workloadUser.id,
      );

      const matchesAssigneeScope =
        selectedAssigneeId === "__all__" ||
        selectedAssigneeId === workloadUser.id;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        workloadUser.name.toLowerCase().includes(query) ||
        workloadUser.email.toLowerCase().includes(query);

      const doneCount = assignedTickets.filter(
        (ticket) => ticket.status === "COMPLETE",
      ).length;
      const inProgressCountByMember = assignedTickets.filter(
        (ticket) => ticket.status === "IN_PROGRESS",
      ).length;
      const reviewCount = assignedTickets.filter(
        (ticket) =>
          ticket.status === "IN_REVIEW" ||
          ticket.status === "QA" ||
          ticket.status === "REVISIONS" ||
          ticket.status === "CLIENT_REVIEW",
      ).length;
      const overdueCountByMember = assignedTickets.filter((ticket) => {
        if (!ticket.dueDate || ticket.status === "COMPLETE") return false;
        const due = new Date(ticket.dueDate);
        return !Number.isNaN(due.getTime()) && due < new Date();
      }).length;
      const urgentOpenCount = assignedTickets.filter(
        (ticket) =>
          ticket.status !== "COMPLETE" && ticket.priority === "URGENT",
      ).length;

      return {
        ...workloadUser,
        matchesAssigneeScope,
        matchesSearch,
        assignedCount: assignedTickets.length,
        selectorPreview: assignedTickets
          .map((ticket) => ticket.selectorId)
          .filter((value): value is number => typeof value === "number")
          .slice(0, 4),
        doneCount,
        inProgressCountByMember,
        reviewCount,
        overdueCountByMember,
        urgentOpenCount,
      };
    })
    .filter((member) => member.matchesAssigneeScope && member.matchesSearch)
    .sort((a, b) => {
      if (b.assignedCount !== a.assignedCount) {
        return b.assignedCount - a.assignedCount;
      }
      if (b.urgentOpenCount !== a.urgentOpenCount) {
        return b.urgentOpenCount - a.urgentOpenCount;
      }
      return a.name.localeCompare(b.name);
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

  const getMemberDetailTickets = useCallback(
    (memberId: string, metric: MemberDetailMetric) => {
      const assignedTickets = tickets.filter(
        (ticket) => ticket.assignee?.id === memberId,
      );

      switch (metric) {
        case "assigned":
          return assignedTickets;
        case "done":
          return assignedTickets.filter(
            (ticket) => ticket.status === "COMPLETE",
          );
        case "inProgress":
          return assignedTickets.filter(
            (ticket) => ticket.status === "IN_PROGRESS",
          );
        case "review":
          return assignedTickets.filter(
            (ticket) =>
              ticket.status === "IN_REVIEW" ||
              ticket.status === "QA" ||
              ticket.status === "REVISIONS" ||
              ticket.status === "CLIENT_REVIEW",
          );
        case "overdue":
          return assignedTickets.filter((ticket) => {
            if (!ticket.dueDate || ticket.status === "COMPLETE") return false;
            const due = new Date(ticket.dueDate);
            return !Number.isNaN(due.getTime()) && due < new Date();
          });
        case "urgentOpen":
          return assignedTickets.filter(
            (ticket) =>
              ticket.status !== "COMPLETE" && ticket.priority === "URGENT",
          );
        default:
          return assignedTickets;
      }
    },
    [tickets],
  );

  const memberDetailTickets = memberDetailModal
    ? getMemberDetailTickets(
        memberDetailModal.memberId,
        memberDetailModal.metric,
      )
    : [];

  const memberDetailMeta: Record<
    MemberDetailMetric,
    {
      title: string;
      description: string;
      tone: string;
    }
  > = {
    assigned: {
      title: "Assigned tickets",
      description: "All tickets currently assigned to this member.",
      tone: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300",
    },
    done: {
      title: "Completed tickets",
      description: "Tickets this member has already finished.",
      tone: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
    },
    inProgress: {
      title: "In progress tickets",
      description: "Tickets actively being worked on right now.",
      tone: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-300",
    },
    review: {
      title: "Review tickets",
      description:
        "Tickets in internal review or client review for this member.",
      tone: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300",
    },
    overdue: {
      title: "Overdue tickets",
      description: "Open tickets past due date for this member.",
      tone: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
    },
    urgentOpen: {
      title: "Urgent open tickets",
      description: "Open urgent-priority tickets that need attention.",
      tone: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
    },
  };

  const selectorOptions = tickets
    .filter((ticket) => typeof ticket.selectorId === "number")
    .sort((left, right) => {
      return (left.selectorId ?? 0) - (right.selectorId ?? 0);
    })
    .map((ticket) => ({
      value: String(ticket.selectorId),
      label: `#${ticket.selectorId} - ${ticket.title}`,
    }));

  const ownerOptions = Array.from(
    new Set(githubRepos.map((repo) => repo.owner?.login).filter(Boolean)),
  ).map((owner) => ({
    value: owner,
    label: owner,
  }));

  const repoOptions = githubRepos
    .filter((repo) => repo.owner?.login === assignOwner)
    .map((repo) => ({
      value: repo.name,
      label: repo.name,
    }));

  const pullRequestOptions = repoPullRequests.map((pullRequest) => ({
    value: String(pullRequest.number),
    label: `#${pullRequest.number} - ${pullRequest.title}`,
  }));

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
            {!isSuperAdmin && (
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
            )}

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

        {isSuperAdmin ? (
          <div className="grid gap-4 border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                  Ticket selector operations
                </h2>
                <p className="mt-1 text-xs text-indigo-800/90 dark:text-indigo-300/90">
                  Backfill selector IDs for old tickets before linking legacy
                  PRs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void runSelectorBackfill();
                }}
                disabled={opsBusy}
                className="inline-flex items-center gap-2 border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
              >
                {opsBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Backfill selector IDs
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                  Link existing PR to ticket
                </h2>
                <p className="mt-1 text-xs text-indigo-800/90 dark:text-indigo-300/90">
                  Use selector ID + owner/repo + PR number.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <SelectMenu
                  value={selectorInput}
                  onChange={setSelectorInput}
                  options={selectorOptions}
                  placeholder="Selector ID"
                  searchable
                  searchPlaceholder="Search selector ID or ticket title"
                  disabled={opsBusy || selectorOptions.length === 0}
                  className="w-full"
                  triggerClassName="text-xs"
                  size="sm"
                />
                <SelectMenu
                  value={assignPrNumber}
                  onChange={setAssignPrNumber}
                  options={pullRequestOptions}
                  placeholder={
                    githubOptionsLoading ? "Loading PRs..." : "PR number"
                  }
                  searchable
                  searchPlaceholder="Search PR number or title"
                  disabled={
                    opsBusy ||
                    !assignOwner ||
                    !assignRepo ||
                    pullRequestOptions.length === 0
                  }
                  className="w-full"
                  triggerClassName="text-xs"
                  size="sm"
                />
                <SelectMenu
                  value={assignOwner}
                  onChange={setAssignOwner}
                  options={ownerOptions}
                  placeholder={
                    githubOptionsLoading ? "Loading owners..." : "Owner"
                  }
                  searchable
                  searchPlaceholder="Search owner"
                  disabled={opsBusy || ownerOptions.length === 0}
                  className="w-full"
                  triggerClassName="text-xs"
                  size="sm"
                />
                <SelectMenu
                  value={assignRepo}
                  onChange={setAssignRepo}
                  options={repoOptions}
                  placeholder={
                    githubOptionsLoading ? "Loading repos..." : "Repo"
                  }
                  searchable
                  searchPlaceholder="Search repo"
                  disabled={opsBusy || !assignOwner || repoOptions.length === 0}
                  className="w-full"
                  triggerClassName="text-xs"
                  size="sm"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  void assignExistingPr();
                }}
                disabled={opsBusy}
                className="inline-flex items-center gap-2 border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
              >
                {opsBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Link existing PR
              </button>
            </div>
          </div>
        ) : null}

        {isSuperAdmin && (opsError || opsMessage) ? (
          <div
            className={cn(
              "rounded-xl border p-3 text-sm",
              opsError
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300",
            )}
          >
            {opsError || opsMessage}
          </div>
        ) : null}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-500 w-4 h-4" />
              <input
                type="text"
                placeholder={
                  isSuperAdmin
                    ? "Search team members..."
                    : "Search tickets or clients..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border-2 border-brand-400 bg-white py-2 pl-10 pr-4 text-gray-900 placeholder-gray-500 transition focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-brand-600 dark:bg-[#1c1c24] dark:text-white"
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
                  triggerClassName="bg-blue-100/60 border-2 border-blue-400 dark:bg-blue-950/40 dark:border-blue-700"
                />
              )}

              <SelectMenu
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusFilterOptions}
                placeholder="Status"
                className="min-w-[200px]"
                triggerClassName="bg-purple-100/60 border-2 border-purple-400 dark:bg-purple-950/40 dark:border-purple-700"
              />

              <SelectMenu
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={priorityFilterOptions}
                placeholder="Priority"
                className="min-w-[180px]"
                triggerClassName="bg-orange-100/60 border-2 border-orange-400 dark:bg-orange-950/40 dark:border-orange-700"
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
        ) : isSuperAdmin ? (
          memberWorkloadCards.length === 0 ? (
            <div className="text-center py-12 bg-white/80 dark:bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-200/80 dark:border-gray-800/50">
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                No team members match this view
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-sm mb-4">
                Try changing assignee, status, or priority filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {memberWorkloadCards.map((member) => (
                <div
                  key={member.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#1c1c24]"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">
                        {member.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {member.email}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {member.role}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setMemberDetailModal({
                          memberId: member.id,
                          memberName: member.name,
                          metric: "assigned",
                        });
                      }}
                      className="rounded-lg bg-blue-50 p-2 text-left transition hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
                    >
                      <p className="text-blue-700 dark:text-blue-300">
                        Assigned
                      </p>
                      <p className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                        {member.assignedCount}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMemberDetailModal({
                          memberId: member.id,
                          memberName: member.name,
                          metric: "done",
                        });
                      }}
                      className="rounded-lg bg-green-50 p-2 text-left transition hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30"
                    >
                      <p className="text-green-700 dark:text-green-300">Done</p>
                      <p className="text-lg font-semibold text-green-800 dark:text-green-200">
                        {member.doneCount}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMemberDetailModal({
                          memberId: member.id,
                          memberName: member.name,
                          metric: "inProgress",
                        });
                      }}
                      className="rounded-lg bg-indigo-50 p-2 text-left transition hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30"
                    >
                      <p className="text-indigo-700 dark:text-indigo-300">
                        In progress
                      </p>
                      <p className="text-lg font-semibold text-indigo-800 dark:text-indigo-200">
                        {member.inProgressCountByMember}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMemberDetailModal({
                          memberId: member.id,
                          memberName: member.name,
                          metric: "review",
                        });
                      }}
                      className="rounded-lg bg-amber-50 p-2 text-left transition hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
                    >
                      <p className="text-amber-700 dark:text-amber-300">
                        Review
                      </p>
                      <p className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                        {member.reviewCount}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMemberDetailModal({
                          memberId: member.id,
                          memberName: member.name,
                          metric: "overdue",
                        });
                      }}
                      className="rounded-lg bg-red-50 p-2 text-left transition hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                    >
                      <p className="text-red-700 dark:text-red-300">Overdue</p>
                      <p className="text-lg font-semibold text-red-800 dark:text-red-200">
                        {member.overdueCountByMember}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMemberDetailModal({
                          memberId: member.id,
                          memberName: member.name,
                          metric: "urgentOpen",
                        });
                      }}
                      className="rounded-lg bg-orange-50 p-2 text-left transition hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30"
                    >
                      <p className="text-orange-700 dark:text-orange-300">
                        Urgent open
                      </p>
                      <p className="text-lg font-semibold text-orange-800 dark:text-orange-200">
                        {member.urgentOpenCount}
                      </p>
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {member.selectorPreview.length > 0 ? (
                      <div className="w-full">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Ticket selectors
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {member.selectorPreview.map((selector) => (
                            <span
                              key={`${member.id}-${selector}`}
                              className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/20 dark:text-brand-300"
                            >
                              #{selector}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssigneeId(member.id);
                      }}
                      className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
                    >
                      Focus member
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        router.push(`/tickets?assigneeId=${member.id}`);
                      }}
                      className="rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/20 dark:text-brand-300"
                    >
                      Open tickets
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
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
                    const displayId = ticketDisplayId(ticket);

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
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                              {displayId}
                            </p>
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
                            <SelectMenu
                              value={ticket.status}
                              onChange={(value) =>
                                handleStatusChange(ticket.id, value)
                              }
                              options={Object.entries(statusConfig).map(
                                ([key, config]) => ({
                                  value: key,
                                  label: config.label,
                                }),
                              )}
                              size="sm"
                              className="w-[10rem]"
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
        <CreateTicketModal
          isOpen={showCreateModal}
          defaultTeamId={isAllTeams ? "" : activeTeamId}
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
        {memberDetailModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#11131a]">
              <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5 dark:border-gray-800">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {memberDetailModal.memberName}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {memberDetailMeta[memberDetailModal.metric].title}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {memberDetailMeta[memberDetailModal.metric].description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMemberDetailModal(null)}
                  className="rounded-md border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                  aria-label="Close workload detail modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto px-6 py-5">
                <div
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm",
                    memberDetailMeta[memberDetailModal.metric].tone,
                  )}
                >
                  {memberDetailTickets.length} ticket
                  {memberDetailTickets.length === 1 ? "" : "s"} in this view.
                </div>

                {memberDetailTickets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No tickets match this status for{" "}
                    {memberDetailModal.memberName}.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {memberDetailTickets.map((ticket) => {
                      const status =
                        statusConfig[
                          ticket.status as keyof typeof statusConfig
                        ];
                      const StatusIcon = status.icon;

                      return (
                        <div
                          key={ticket.id}
                          className="w-full rounded-xl border border-gray-200 p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-gray-800 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/tickets/${ticket.id}`}
                                onClick={() => setMemberDetailModal(null)}
                                className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
                              >
                                {ticketDisplayId(ticket)}
                              </Link>
                              <div className="mt-1">
                                <Link
                                  href={`/tickets/${ticket.id}`}
                                  onClick={() => setMemberDetailModal(null)}
                                  className="text-base font-semibold text-gray-900 underline-offset-2 hover:text-brand-700 hover:underline dark:text-white dark:hover:text-brand-300"
                                >
                                  {ticket.title}
                                </Link>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span>
                                  {ticket.client?.name || "No client"}
                                </span>
                                <span>
                                  {ticket.assignee?.name || "Unassigned"}
                                </span>
                                <span>
                                  {ticket.dueDate
                                    ? `Due ${new Date(ticket.dueDate).toLocaleDateString()}`
                                    : "No due date"}
                                </span>
                                <span>
                                  {ticket.priority
                                    ? `Priority ${ticket.priority}`
                                    : "No priority"}
                                </span>
                              </div>
                            </div>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                                status.color,
                              )}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link
                              href={`/tickets/${ticket.id}`}
                              onClick={() => setMemberDetailModal(null)}
                              className="inline-flex items-center rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/20 dark:text-brand-300"
                            >
                              Open ticket
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
