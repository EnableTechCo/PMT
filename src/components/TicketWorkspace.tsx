"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import TipTapEditor from "@/components/TipTapEditor";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SelectMenu } from "@/components/SelectMenu";
import { cn } from "@/lib/utils";
import { onRealtimeChange } from "@/lib/realtime-events";
import {
  ArrowLeft,
  Trash2,
  Paperclip,
  Send,
  Activity,
  MessageSquare,
  Github,
  GitBranch,
  GitPullRequest,
  ExternalLink,
  Plus,
  RefreshCw,
  X,
  Search,
  CalendarIcon,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PRIORITIES = [
  { value: "NONE", label: "None" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
] as const;

const STATUSES = [
  "BACKLOG",
  "TODO",
  "REFINE",
  "IN_PROGRESS",
  "REVISIONS",
  "COMPLETE",
  "CLIENT_REVIEW",
] as const;

interface ClientObligation {
  id: string;
  ticketId: string;
  title: string;
  description?: string | null;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" | "OVERDUE";
  dueAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  evidenceNote?: string | null;
  evidenceUrl?: string | null;
  createdAt: string;
}

export default function TicketWorkspace({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [ticket, setTicket] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [obligations, setObligations] = useState<ClientObligation[]>([]);
  const [obligationsLoading, setObligationsLoading] = useState(false);
  const [creatingObligation, setCreatingObligation] = useState(false);
  const [obligationTitle, setObligationTitle] = useState("");
  const [obligationDueAt, setObligationDueAt] = useState("");

  // GitHub integration states
  const [_checkingGithub, setCheckingGithub] = useState(true);
  const [githubConnected, setGithubConnected] = useState(false);
  const [_githubUser, setGithubUser] = useState<{
    login: string;
    avatarUrl: string;
  } | null>(null);

  // Modals state
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showPRModal, setShowPRModal] = useState(false);
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    | { type: "unlinkBranch"; id: string }
    | { type: "unlinkPr"; id: string }
    | { type: "deleteTicket" }
    | null
  >(null);

  // Lists from APIs
  const [availableRepos, setAvailableRepos] = useState<any[]>([]);
  const [availableBranches, setAvailableBranches] = useState<any[]>([]);
  const [availablePRs, setAvailablePRs] = useState<any[]>([]);

  const [searchRepo, setSearchRepo] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingPRs, setLoadingPRs] = useState(false);

  const [activeRepo, setActiveRepo] = useState<{
    owner: string;
    name: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (res.status === 404) {
        setError("Ticket not found");
        setTicket(null);
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setTicket(data);
    } catch {
      setError("Could not load ticket");
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const checkGithubAuth = useCallback(async () => {
    try {
      setCheckingGithub(true);
      const res = await fetch("/api/github/auth");
      const data = await res.json();
      if (res.ok && data.connected) {
        setGithubConnected(true);
        setGithubUser(data.githubUser);
      } else {
        setGithubConnected(false);
        setGithubUser(null);
      }
    } catch {
      setGithubConnected(false);
    } finally {
      setCheckingGithub(false);
    }
  }, []);

  const loadObligations = useCallback(async () => {
    try {
      setObligationsLoading(true);
      const response = await fetch(`/api/tickets/${ticketId}/obligations`);
      if (!response.ok) {
        setObligations([]);
        return;
      }
      const data = (await response.json()) as ClientObligation[];
      setObligations(Array.isArray(data) ? data : []);
    } catch {
      setObligations([]);
    } finally {
      setObligationsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!authLoading && user) {
      void load();
      void loadObligations();
      void checkGithubAuth();
    }
  }, [authLoading, user, load, loadObligations, checkGithubAuth]);

  useEffect(() => {
    if (authLoading || !user) return;

    const unsubscribe = onRealtimeChange(() => {
      void load();
      void loadObligations();
    });

    return unsubscribe;
  }, [authLoading, user, load, loadObligations]);

  const loadBranches = async (owner: string, repo: string) => {
    setLoadingBranches(true);
    try {
      const res = await fetch(
        `/api/github/branches?owner=${owner}&repo=${repo}`,
      );
      if (res.ok) {
        setAvailableBranches(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBranches(false);
    }
  };

  const loadPRs = async (owner: string, repo: string) => {
    setLoadingPRs(true);
    try {
      const res = await fetch(
        `/api/github/pull-requests?owner=${owner}&repo=${repo}`,
      );
      if (res.ok) {
        setAvailablePRs(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPRs(false);
    }
  };

  const loadRepos = async (query = "") => {
    setLoadingRepos(true);
    try {
      const url = query
        ? `/api/github/repos?q=${encodeURIComponent(query)}`
        : `/api/github/repos`;
      const res = await fetch(url);
      if (res.ok) {
        setAvailableRepos(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleLinkRepo = async (owner: string, name: string, url: string) => {
    if (!t.project?.id) return;
    try {
      const res = await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: t.project.id,
          owner,
          name,
          url,
        }),
      });
      if (res.ok) {
        setShowRepoModal(false);
        void load();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to link repo");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLinkBranch = async (
    branchName: string,
    repoOwner: string,
    repoName: string,
  ) => {
    const url = `https://github.com/${repoOwner}/${repoName}/tree/${branchName}`;
    try {
      const res = await fetch("/api/github/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          name: branchName,
          url,
        }),
      });
      if (res.ok) {
        setShowBranchModal(false);
        void load();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to link branch");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLinkPR = async (pr: {
    title: string;
    number: number;
    html_url: string;
    state: string;
  }) => {
    try {
      const res = await fetch("/api/github/pull-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          title: pr.title,
          number: pr.number,
          url: pr.html_url,
          state: pr.state,
        }),
      });
      if (res.ok) {
        setShowPRModal(false);
        void load();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to link PR");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnlinkBranch = async (id: string) => {
    try {
      const res = await fetch(`/api/github/branches?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) void load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnlinkPR = async (id: string) => {
    try {
      const res = await fetch(`/api/github/pull-requests?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) void load();
    } catch (e) {
      console.error(e);
    }
  };

  const patchTicket = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setTicket(data);
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const createObligation = async () => {
    const title = obligationTitle.trim();
    if (!title) return;
    setCreatingObligation(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/obligations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          dueAt: obligationDueAt
            ? new Date(obligationDueAt).toISOString()
            : null,
        }),
      });
      if (response.ok) {
        setObligationTitle("");
        setObligationDueAt("");
        void loadObligations();
      }
    } finally {
      setCreatingObligation(false);
    }
  };

  const updateObligationStatus = async (
    obligationId: string,
    status: ClientObligation["status"],
  ) => {
    const response = await fetch(
      `/api/tickets/${ticketId}/obligations/${obligationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (response.ok) {
      void loadObligations();
    }
  };

  const postComment = async () => {
    const body = commentText.trim();
    if (!body) return;
    const res = await fetch(`/api/tickets/${ticketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      setCommentText("");
      void load();
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) void load();
    } finally {
      setUploadBusy(false);
    }
  };

  const deleteTicket = async () => {
    const res = await fetch(`/api/tickets/${ticketId}`, { method: "DELETE" });
    if (res.ok) router.push("/tickets");
  };

  const confirmTitle =
    confirmAction?.type === "unlinkBranch"
      ? "Unlink branch"
      : confirmAction?.type === "unlinkPr"
        ? "Unlink pull request"
        : "Delete ticket";

  const confirmMessage =
    confirmAction?.type === "unlinkBranch"
      ? "Are you sure you want to unlink this branch?"
      : confirmAction?.type === "unlinkPr"
        ? "Are you sure you want to unlink this pull request?"
        : "Delete this ticket permanently?";

  const runConfirmAction = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === "unlinkBranch") {
      await handleUnlinkBranch(confirmAction.id);
      setConfirmAction(null);
      return;
    }

    if (confirmAction.type === "unlinkPr") {
      await handleUnlinkPR(confirmAction.id);
      setConfirmAction(null);
      return;
    }

    await deleteTicket();
    setConfirmAction(null);
  };

  useEffect(() => {
    if (!ticket || loading) return;
    const title = typeof ticket.title === "string" ? ticket.title.trim() : "";
    if (!title) return;
    const prev = document.title;
    document.title = `${title} · Ticket`;
    return () => {
      document.title = prev;
    };
  }, [ticket, loading]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-canvas)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
      </div>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !ticket) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl py-12 text-center">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {error || "Not found"}
          </p>
          <Link
            href="/tickets"
            className="mt-4 inline-block text-brand-600 hover:underline"
          >
            Back to tickets
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const t = ticket as {
    id: string;
    title: string;
    description: string | null;
    acceptanceCriteria?: string | null;
    status: string;
    priority?: string | null;
    startDate: string | null;
    dueDate: string | null;
    createdAt?: string;
    updatedAt?: string;
    creator: { id: string; name: string; email: string };
    assignee?: { id: string; name: string; email: string } | null;
    client?: { id: string; name: string; email: string } | null;
    team?: { id: string; name: string } | null;
    project?: {
      id: string;
      name: string;
      githubRepos?: Array<{
        id: string;
        owner: string;
        name: string;
        url: string;
      }>;
    } | null;
    githubBranches?: Array<{
      id: string;
      name: string;
      url: string;
      createdAt: string;
    }>;
    githubPullRequests?: Array<{
      id: string;
      title: string;
      number: number;
      url: string;
      state: string;
      createdAt: string;
    }>;
    comments?: Array<{
      id: string;
      body: string;
      createdAt: string;
      author: { id: string; name: string; email: string };
    }>;
    checklistItems?: Array<{
      id: string;
      title: string;
      done: boolean;
      sortOrder: number;
    }>;
    attachments?: Array<{
      id: string;
      filename: string;
      url: string;
      size: number | null;
      uploadedBy: { id: string; name: string };
      createdAt: string;
    }>;
    activities?: Array<{
      id: string;
      type: string;
      summary: string;
      createdAt: string;
      actor: { id: string; name: string };
    }>;
  };

  const canEdit =
    user.role === "SUPER_ADMIN" ||
    user.role === "USER" ||
    (user.role === "CLIENT" && t.status === "CLIENT_REVIEW");

  const priorityValue = t.priority ?? "MEDIUM";

  const formatWhen = (iso: string | undefined) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return "—";
    }
  };

  const statusLabel = (s: string) => {
    if (s === "REVISIONS") return "Review";
    return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <DashboardLayout>
      <div className="w-full pb-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/tickets"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-brand-600 dark:text-gray-400"
            >
              <ArrowLeft className="h-4 w-4" />
              Tickets
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              {t.title || "Untitled ticket"}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs sm:text-sm">
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 font-medium text-gray-800 dark:border-gray-700 dark:bg-white/10 dark:text-gray-200">
                {statusLabel(t.status)}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 font-medium text-gray-800 dark:border-gray-700 dark:bg-white/10 dark:text-gray-200">
                Priority:{" "}
                {PRIORITIES.find((p) => p.value === priorityValue)?.label ??
                  priorityValue}
              </span>
              {t.project ? (
                <span className="rounded-full border border-gray-200 px-2.5 py-1 text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  Project: {t.project.name}
                </span>
              ) : null}
              {t.client ? (
                <span className="rounded-full border border-gray-200 px-2.5 py-1 text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  Client: {t.client.name}
                </span>
              ) : null}
              {t.assignee ? (
                <span className="rounded-full border border-gray-200 px-2.5 py-1 text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  Assignee: {t.assignee.name}
                </span>
              ) : (
                <span className="rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-gray-500 dark:border-gray-600">
                  Unassigned
                </span>
              )}
            </div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Created by {t.creator.name} · {formatWhen(t.createdAt)}
              {t.updatedAt && t.updatedAt !== t.createdAt
                ? ` · Updated ${formatWhen(t.updatedAt)}`
                : null}
            </p>
            <p className="mt-2 mb-4 font-mono text-xs text-gray-400 break-all">
              Ticket ID: {t.id}
            </p>
          </div>
          {(user.role === "SUPER_ADMIN" || t.creator.id === user.id) && (
            <button
              type="button"
              onClick={() => setConfirmAction({ type: "deleteTicket" })}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                Description
              </h2>
              {canEdit ? (
                <textarea
                  className="min-h-[160px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  defaultValue={t.description ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (t.description ?? "")) {
                      void patchTicket({ description: e.target.value });
                    }
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                  {t.description || "—"}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                    Client Obligations
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Track client-owned deliverables and hold review timelines
                    accountable.
                  </p>
                </div>
              </div>

              {user.role !== "CLIENT" ? (
                <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_220px_auto]">
                  <input
                    value={obligationTitle}
                    onChange={(e) => setObligationTitle(e.target.value)}
                    placeholder="Client action required"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                  <input
                    type="datetime-local"
                    value={obligationDueAt}
                    onChange={(e) => setObligationDueAt(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void createObligation()}
                    disabled={creatingObligation}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingObligation ? "Adding..." : "Add"}
                  </button>
                </div>
              ) : null}

              {obligationsLoading ? (
                <p className="text-sm text-gray-500">Loading obligations...</p>
              ) : obligations.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No client obligations yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {obligations.map((obligation) => (
                    <li
                      key={obligation.id}
                      className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {obligation.title}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Status: {obligation.status}
                            {obligation.dueAt
                              ? ` · Due ${new Date(obligation.dueAt).toLocaleString()}`
                              : ""}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {user.role === "CLIENT" &&
                          obligation.status === "PENDING" ? (
                            <button
                              type="button"
                              onClick={() =>
                                void updateObligationStatus(
                                  obligation.id,
                                  "SUBMITTED",
                                )
                              }
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                            >
                              Mark submitted
                            </button>
                          ) : null}

                          {user.role !== "CLIENT" &&
                          obligation.status === "SUBMITTED" ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void updateObligationStatus(
                                    obligation.id,
                                    "APPROVED",
                                  )
                                }
                                className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void updateObligationStatus(
                                    obligation.id,
                                    "REJECTED",
                                  )
                                }
                                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                Acceptance Criteria (QA)
              </h2>
              {canEdit ? (
                <textarea
                  className="min-h-[140px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  defaultValue={t.acceptanceCriteria ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (t.acceptanceCriteria ?? "")) {
                      void patchTicket({ acceptanceCriteria: e.target.value });
                    }
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                  {t.acceptanceCriteria || "—"}
                </p>
              )}
            </section>

            {/* GitHub Integration Section */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-card dark:border-gray-800 dark:bg-[#1c1c24] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-200">
                    <Github className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                      GitHub Workspace
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Sync branches and pull requests with this ticket
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!githubConnected ? (
                    <Link
                      href="/settings"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/25"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Connect GitHub in Settings
                    </Link>
                  ) : !t.project ? (
                    <span className="text-xs text-gray-400">
                      Assign a project to link code repositories
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {t.project.githubRepos &&
                      t.project.githubRepos.length > 0 ? (
                        <>
                          <button
                            onClick={() => {
                              const r = t.project!.githubRepos![0];
                              setActiveRepo({ owner: r.owner, name: r.name });
                              void loadBranches(r.owner, r.name);
                              setShowBranchModal(true);
                            }}
                            className="btn-primary py-1.5 px-3 text-xs inline-flex items-center gap-1.5"
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            Link Branch
                          </button>
                          <button
                            onClick={() => {
                              const r = t.project!.githubRepos![0];
                              setActiveRepo({ owner: r.owner, name: r.name });
                              void loadPRs(r.owner, r.name);
                              setShowPRModal(true);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80 cursor-pointer"
                          >
                            <GitPullRequest className="w-3.5 h-3.5" />
                            Link PR
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            void loadRepos();
                            setShowRepoModal(true);
                          }}
                          className="btn-primary py-1.5 px-3 text-xs inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Link Repo to Project
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Items List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Branches */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                    Linked Branches ({(t.githubBranches ?? []).length})
                  </h3>
                  {!t.githubBranches || t.githubBranches.length === 0 ? (
                    <p className="text-xs text-gray-500 bg-slate-50/50 dark:bg-white/5 rounded-lg p-3 border border-dashed border-gray-200 dark:border-gray-800">
                      No branches linked yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {t.githubBranches.map((b) => (
                        <li
                          key={b.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5"
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 truncate bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {b.name}
                            </span>
                            <a
                              href={b.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-brand-500"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          {canEdit && (
                            <button
                              onClick={() =>
                                setConfirmAction({
                                  type: "unlinkBranch",
                                  id: b.id,
                                })
                              }
                              className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-2 py-1 rounded transition-colors cursor-pointer"
                            >
                              Unlink
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* PRs */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <GitPullRequest className="w-3.5 h-3.5 text-red-500" />
                    Linked Pull Requests ({(t.githubPullRequests ?? []).length})
                  </h3>
                  {!t.githubPullRequests ||
                  t.githubPullRequests.length === 0 ? (
                    <p className="text-xs text-gray-500 bg-slate-50/50 dark:bg-white/5 rounded-lg p-3 border border-dashed border-gray-200 dark:border-gray-800">
                      No pull requests linked yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {t.githubPullRequests.map((pr) => {
                        const isMerged = pr.state === "merged";
                        const isOpen = pr.state === "open";
                        return (
                          <li
                            key={pr.id}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5"
                          >
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                                #{pr.number} {pr.title}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                  isMerged &&
                                    "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
                                  isOpen &&
                                    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                                  !isOpen &&
                                    !isMerged &&
                                    "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
                                )}
                              >
                                {pr.state}
                              </span>
                              <a
                                href={pr.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-brand-500"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            {canEdit && (
                              <button
                                onClick={() =>
                                  setConfirmAction({
                                    type: "unlinkPr",
                                    id: pr.id,
                                  })
                                }
                                className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-2 py-1 rounded transition-colors cursor-pointer"
                              >
                                Unlink
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
              <div className="mb-4 flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-brand-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                  Attachments
                </h2>
              </div>
              <ul className="space-y-2">
                {(t.attachments ?? []).map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      {a.filename}
                    </a>
                    <span className="ml-2 text-xs text-gray-500">
                      · {a.uploadedBy.name}
                    </span>
                  </li>
                ))}
              </ul>
              {canEdit && (
                <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400">
                  <input
                    type="file"
                    className="hidden"
                    onChange={onUpload}
                    disabled={uploadBusy}
                  />
                  {uploadBusy ? "Uploading…" : "+ Upload file"}
                </label>
              )}
            </section>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-brand-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                  Activity
                </h2>
              </div>
              <ul className="space-y-4">
                {(t.activities ?? []).map((a) => (
                  <li
                    key={a.id}
                    className="flex gap-4 border-b border-gray-100 pb-4 last:border-0 dark:border-gray-800"
                  >
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {a.summary}
                      </p>
                      <p className="text-xs text-gray-500">
                        {a.actor.name} ·{" "}
                        {new Date(a.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {(t.activities?.length ?? 0) === 0 && (
                <p className="text-sm text-gray-500">No activity yet.</p>
              )}
            </section>

            <section className="space-y-6">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-brand-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                    Comments
                  </h2>
                </div>
                <ul className="space-y-6">
                  {(t.comments ?? []).map((c) => (
                    <li
                      key={c.id}
                      className="border-b border-gray-100 pb-6 last:border-0 dark:border-gray-800"
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {c.author.name}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                        {c.body}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        {new Date(c.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
                {(t.comments?.length ?? 0) === 0 && (
                  <p className="text-sm text-gray-500">No comments yet.</p>
                )}
              </div>
              {canEdit && (
                <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 dark:border-gray-800 dark:bg-[#1c1c24]">
                  <TipTapEditor
                    content={commentText}
                    setContent={setCommentText}
                  />
                  <button
                    type="button"
                    onClick={() => void postComment()}
                    className="inline-flex items-center justify-center gap-2 self-end rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                  >
                    <Send className="h-4 w-4" />
                    Comment
                  </button>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
              <h3 className="mb-3 text-xs font-bold uppercase text-gray-500">
                Edit fields
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="mb-1 block text-gray-500">Status</label>
                  <SelectMenu
                    value={t.status}
                    onChange={(value) => {
                      void patchTicket({ status: value });
                    }}
                    disabled={!canEdit}
                    options={STATUSES.map((s) => ({
                      value: s,
                      label: statusLabel(s),
                    }))}
                    className="w-full"
                    triggerClassName="border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-gray-500">Priority</label>
                  <SelectMenu
                    value={priorityValue}
                    onChange={(value) => {
                      void patchTicket({ priority: value });
                    }}
                    disabled={!canEdit || user.role === "CLIENT"}
                    options={PRIORITIES.map((p) => ({
                      value: p.value,
                      label: p.label,
                    }))}
                    className="w-full"
                    triggerClassName="border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-gray-500">Start date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={!canEdit || user.role === "CLIENT"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !t.startDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />

                        {t.startDate
                          ? format(new Date(t.startDate), "PPP")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          t.startDate ? new Date(t.startDate) : undefined
                        }
                        onSelect={(date) => {
                          void patchTicket({
                            startDate: date ? date.toISOString() : null,
                          });
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="border-t border-[var(--border)] pt-4 dark:border-gray-800">
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                    Record
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    {t.assignee ? (
                      <li>
                        <span className="text-gray-500">Assignee email</span>
                        <p className="break-all">{t.assignee.email}</p>
                      </li>
                    ) : null}
                    <li>
                      <span className="text-gray-500">Created</span>
                      <p>{formatWhen(t.createdAt)}</p>
                    </li>
                    <li>
                      <span className="text-gray-500">Last updated</span>
                      <p>{formatWhen(t.updatedAt)}</p>
                    </li>
                  </ul>
                </div>
              </div>
              {saving && <p className="mt-2 text-xs text-gray-500">Saving…</p>}
            </div>
          </aside>
        </div>
      </div>

      {/* GitHub Modals */}
      {showBranchModal && activeRepo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1c1c24] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-[#191922] dark:to-[#1c1c24]">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Link Git Branch
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Select a branch from {activeRepo.owner}/{activeRepo.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBranchModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-96 space-y-3">
              {loadingBranches ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-sm text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
                  <span>Loading branches from GitHub...</span>
                </div>
              ) : availableBranches.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-500">
                  No branches found in this repository.
                </p>
              ) : (
                <div className="space-y-2">
                  {availableBranches.map((branch) => (
                    <button
                      key={branch.name}
                      onClick={() =>
                        void handleLinkBranch(
                          branch.name,
                          activeRepo.owner,
                          activeRepo.name,
                        )
                      }
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-slate-50/50 dark:bg-white/5 hover:border-brand-500/30 hover:bg-brand-50/10 dark:hover:bg-brand-500/5 hover:shadow-sm text-left transition-all duration-150 group cursor-pointer"
                    >
                      <span className="font-mono text-xs text-slate-800 dark:text-slate-200 font-semibold group-hover:text-brand-600">
                        {branch.name}
                      </span>
                      <span className="text-[10px] font-semibold text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Link Branch &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPRModal && activeRepo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1c1c24] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-[#191922] dark:to-[#1c1c24]">
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-5 h-5 text-red-500" />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Link Pull Request
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Select a pull request from {activeRepo.owner}/
                    {activeRepo.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPRModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-96 space-y-3">
              {loadingPRs ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-sm text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
                  <span>Loading PRs from GitHub...</span>
                </div>
              ) : availablePRs.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-500">
                  No pull requests found in this repository.
                </p>
              ) : (
                <div className="space-y-2">
                  {availablePRs.map((pr) => (
                    <button
                      key={pr.id}
                      onClick={() => void handleLinkPR(pr)}
                      className="w-full flex items-center justify-between gap-4 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-slate-50/50 dark:bg-white/5 hover:border-brand-500/30 hover:bg-brand-50/10 dark:hover:bg-brand-500/5 hover:shadow-sm text-left transition-all duration-150 group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate group-hover:text-brand-600">
                          #{pr.number} {pr.title}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Created by {pr.user?.login}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={cn(
                            "inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                            pr.state === "open" &&
                              "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                            pr.state === "closed" &&
                              "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
                          )}
                        >
                          {pr.state}
                        </span>
                        <span className="text-[10px] font-semibold text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          Link &rarr;
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={
          confirmAction?.type === "deleteTicket" ? "Delete" : "Unlink"
        }
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          void runConfirmAction();
        }}
      />

      {showRepoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1c1c24] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-[#191922] dark:to-[#1c1c24]">
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-slate-800 dark:text-white" />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Link Git Repository to Project
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enable branch tracking for this project's tickets
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRepoModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search repository name..."
                  value={searchRepo}
                  onChange={(e) => setSearchRepo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadRepos(searchRepo);
                  }}
                  className="w-full pl-10 input-modern"
                />
                <button
                  onClick={() => void loadRepos(searchRepo)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-xs font-semibold cursor-pointer"
                >
                  Search
                </button>
              </div>

              <div className="overflow-y-auto max-h-80 space-y-3 pr-1">
                {loadingRepos ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-sm text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
                    <span>Searching GitHub repositories...</span>
                  </div>
                ) : availableRepos.length === 0 ? (
                  <p className="text-center py-8 text-sm text-gray-500">
                    No repositories found. Enter search term above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availableRepos.map((repo) => (
                      <button
                        key={repo.id}
                        onClick={() =>
                          void handleLinkRepo(
                            repo.owner.login,
                            repo.name,
                            repo.html_url,
                          )
                        }
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-slate-50/50 dark:bg-white/5 hover:border-brand-500/30 hover:bg-brand-50/10 dark:hover:bg-brand-500/5 hover:shadow-sm text-left transition-all duration-150 group cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate group-hover:text-brand-600">
                            {repo.full_name}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">
                            {repo.description || "No description"}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          Link to Project &rarr;
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
