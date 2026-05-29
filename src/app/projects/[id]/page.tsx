"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { onRealtimeChange } from "@/lib/realtime-events";

type Milestone = {
  id: string;
  title: string;
  dueDate: string | null;
  completedAt: string | null;
};

type TicketSummary = {
  id: string;
  title: string;
  status: string;
  client?: { name: string } | null;
  assignee?: { name: string } | null;
  createdAt: string;
};

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  progress: number;
  health: string;
  status: string;
  team: { id: string; name: string };
  milestones: Milestone[];
  githubRepos?: Array<{ id: string; owner: string; name: string; url: string }>;
  _count: { tickets: number };
};

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (authLoading || !user || user.role === "CLIENT") return;
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) throw new Error("Not found");
        setProject(await res.json());
      } catch {
        setError("Could not load project.");
      }
    })();
  }, [authLoading, user, id]);

  useEffect(() => {
    if (authLoading || !user || user.role === "CLIENT" || !project) return;
    void (async () => {
      try {
        const res = await fetch(`/api/tickets?projectId=${id}`);
        if (!res.ok) return;
        setTickets(await res.json());
      } catch {
        // ignore
      }
    })();
  }, [authLoading, user, id, project]);

  useEffect(() => {
    if (authLoading || !user || user.role === "CLIENT") return;

    const unsubscribe = onRealtimeChange((detail) => {
      if (
        detail.table !== "Project" &&
        detail.table !== "Milestone" &&
        detail.table !== "Ticket" &&
        detail.table !== "GithubRepo"
      ) {
        return;
      }

      void (async () => {
        try {
          const [projectRes, ticketsRes] = await Promise.all([
            fetch(`/api/projects/${id}`),
            fetch(`/api/tickets?projectId=${id}`),
          ]);
          if (projectRes.ok) {
            setProject(await projectRes.json());
          }
          if (ticketsRes.ok) {
            setTickets(await ticketsRes.json());
          }
        } catch {
          // ignore realtime refresh errors
        }
      })();
    });

    return unsubscribe;
  }, [authLoading, user, id]);

  const toggleMilestone = async (m: Milestone) => {
    const res = await fetch(`/api/milestones/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !m.completedAt }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setProject((p) =>
      p
        ? {
            ...p,
            milestones: p.milestones.map((x) =>
              x.id === updated.id ? updated : x,
            ),
          }
        : p,
    );
  };

  const deleteProject = async () => {
    if (!project || user?.role !== "SUPER_ADMIN" || deleting) return;

    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Failed to delete project.",
        );
      }

      router.push("/projects");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete project.",
      );
    } finally {
      setShowDeleteConfirm(false);
      setDeleting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (user.role === "CLIENT") {
    return (
      <DashboardLayout>
        <p className="text-gray-600">Unavailable.</p>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <p className="text-gray-600">{error || "Loading…"}</p>
        <Link href="/projects" className="mt-4 text-indigo-600">
          Back to projects
        </Link>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full">
        <Link href="/projects" className="text-sm text-indigo-600">
          ← Projects
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-4 mb-4">
            {project.name}
          </h1>
          {user.role === "SUPER_ADMIN" && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="mb-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              {deleting ? "Deleting..." : "Delete project"}
            </button>
          )}
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-indigo-500"
            style={{ width: `${project.progress}%` }}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="space-y-6 mt-8">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Milestones
              </h2>
              <ul className="mt-3 space-y-2">
                {project.milestones.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
                  >
                    <span
                      className={
                        m.completedAt
                          ? "text-gray-400 line-through"
                          : "text-gray-900 dark:text-white"
                      }
                    >
                      {m.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleMilestone(m)}
                      className="text-sm text-indigo-600"
                    >
                      {m.completedAt ? "Reopen" : "Complete"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm dark:border-gray-800 dark:bg-[#111217]/80">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Project tickets
                  </h2>
                  <p className="text-sm text-gray-500">
                    {tickets.length} ticket{tickets.length === 1 ? "" : "s"}{" "}
                    linked to this project.
                  </p>
                </div>
                <Link
                  href="/tickets"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  View all tickets
                </Link>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="py-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
                        Ticket
                      </th>
                      <th className="py-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="py-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
                        Assignee
                      </th>
                      <th className="py-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-4 pr-6 text-sm text-gray-900 dark:text-white">
                          <Link
                            href={`/tickets/${ticket.id}`}
                            className="font-medium hover:text-brand-600"
                          >
                            {ticket.title}
                          </Link>
                        </td>
                        <td className="py-4 pr-6 text-sm text-gray-700 dark:text-gray-300">
                          {ticket.status
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </td>
                        <td className="py-4 pr-6 text-sm text-gray-700 dark:text-gray-300">
                          {ticket.assignee?.name || "Unassigned"}
                        </td>
                        <td className="py-4 text-sm text-gray-700 dark:text-gray-300">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6 mt-8">
            <div className="rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-sm dark:border-gray-800 dark:bg-[#111217]/80">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                GitHub Repositories
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Link repos at the project level so tickets can attach branches
                and pull requests.
              </p>
              <div className="mt-4 space-y-3">
                {project.githubRepos && project.githubRepos.length > 0 ? (
                  project.githubRepos.map((repo) => (
                    <a
                      key={repo.id}
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition hover:border-brand-500 hover:bg-brand-50/50 dark:border-gray-800 dark:bg-white/5 dark:text-white"
                    >
                      <div className="font-semibold">
                        {repo.owner}/{repo.name}
                      </div>
                      <div className="text-gray-500 text-xs">View repo</div>
                    </a>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-white/5">
                    No GitHub repositories linked yet.
                  </div>
                )}
              </div>
              <Link
                href="/settings"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Manage GitHub connections
              </Link>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete project"
        message={`Delete ${project.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        busy={deleting}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          void deleteProject();
        }}
      />
    </DashboardLayout>
  );
}
