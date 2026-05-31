"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2,
  Play,
  RotateCcw,
  Square,
  ExternalLink,
  Workflow,
} from "lucide-react";

type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  owner?: { login: string };
  default_branch?: string;
};

type GithubWorkflow = {
  id: number;
  name: string;
  path: string;
  state: string;
  updated_at: string;
};

type GithubRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  workflow_id: number;
  html_url: string;
  run_number: number;
  head_branch: string;
  created_at: string;
  updated_at: string;
};

export default function WorkflowsPage() {
  const { user, loading: authLoading } = useAuth();
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [workflows, setWorkflows] = useState<GithubWorkflow[]>([]);
  const [runs, setRuns] = useState<GithubRun[]>([]);

  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("main");

  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [runningWorkflowId, setRunningWorkflowId] = useState<number | null>(
    null,
  );
  const [actingRunId, setActingRunId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const runByWorkflow = useMemo(() => {
    const map = new Map<number, GithubRun[]>();
    for (const run of runs) {
      const list = map.get(run.workflow_id) ?? [];
      list.push(run);
      map.set(run.workflow_id, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    return map;
  }, [runs]);

  const workflowNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const wf of workflows) {
      map.set(wf.id, wf.name);
    }
    return map;
  }, [workflows]);

  const selectedRepo = useMemo(
    () =>
      repos.find((r) => r.name === repo && r.owner?.login === owner) ?? null,
    [repos, owner, repo],
  );

  const loadRepos = useCallback(async () => {
    setLoadingRepos(true);
    setError("");
    try {
      const res = await fetch("/api/github/repos");
      const body = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(body.error || "Failed to fetch repositories");
      }
      const data = Array.isArray(body) ? (body as GithubRepo[]) : [];
      setRepos(data);

      if (data.length > 0) {
        const first = data[0];
        const nextOwner = first.owner?.login || "";
        if (nextOwner) setOwner(nextOwner);
        setRepo(first.name);
        setRef(first.default_branch || "main");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch repositories",
      );
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  const loadWorkflows = useCallback(async () => {
    if (!owner || !repo) return;

    setLoadingWorkflows(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(
        `/api/github/workflows?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      );
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || "Failed to fetch workflows");
      }

      setWorkflows(Array.isArray(body.workflows) ? body.workflows : []);
      setRuns(Array.isArray(body.runs) ? body.runs : []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch workflows",
      );
    } finally {
      setLoadingWorkflows(false);
    }
  }, [owner, repo]);

  useEffect(() => {
    if (authLoading || !user || user.role !== "SUPER_ADMIN") return;
    void loadRepos();
  }, [authLoading, user, loadRepos]);

  useEffect(() => {
    if (!owner || !repo) return;
    void loadWorkflows();
  }, [owner, repo, loadWorkflows]);

  useEffect(() => {
    if (!owner || !repo) return;
    const interval = setInterval(() => {
      void loadWorkflows();
    }, 20000);

    return () => clearInterval(interval);
  }, [owner, repo, loadWorkflows]);

  const runWorkflow = async (workflowId: number) => {
    setRunningWorkflowId(workflowId);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/github/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, workflowId, ref: ref || "main" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to dispatch workflow");
      }
      setMessage("Workflow dispatched successfully.");
      await loadWorkflows();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to dispatch workflow",
      );
    } finally {
      setRunningWorkflowId(null);
    }
  };

  const actOnRun = async (runId: number, action: "rerun" | "cancel") => {
    setActingRunId(runId);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/github/workflows/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, runId, action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Failed to ${action} run`);
      }
      setMessage(
        action === "rerun"
          ? "Run re-queued successfully."
          : "Run cancelled successfully.",
      );
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} run`);
    } finally {
      setActingRunId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (user.role !== "SUPER_ADMIN") {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          Only super admins can access workflow orchestration.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
            <Workflow className="h-7 w-7 text-indigo-500" /> GitHub Workflows
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Super admin control panel to dispatch, rerun, and cancel GitHub
            Actions workflows.
          </p>
        </div>

        <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 md:grid-cols-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Repository
            </label>
            <select
              value={`${owner}/${repo}`}
              onChange={(e) => {
                const [nextOwner, nextRepo] = e.target.value.split("/");
                setOwner(nextOwner || "");
                setRepo(nextRepo || "");
                const found = repos.find(
                  (r) => r.owner?.login === nextOwner && r.name === nextRepo,
                );
                setRef(found?.default_branch || "main");
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              disabled={loadingRepos || repos.length === 0}
            >
              {repos.map((r) => (
                <option
                  key={`${r.owner?.login}/${r.name}`}
                  value={`${r.owner?.login}/${r.name}`}
                >
                  {r.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Owner
            </label>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value.trim())}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              placeholder="org-or-user"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Repo
            </label>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value.trim())}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              placeholder="repository-name"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Ref
            </label>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value.trim())}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              placeholder="main"
            />
          </div>

          <div className="md:col-span-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void loadRepos();
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Refresh Repos
            </button>
            <button
              type="button"
              onClick={() => {
                void loadWorkflows();
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={loadingWorkflows || !owner || !repo}
            >
              {loadingWorkflows ? "Loading..." : "Refresh Workflows"}
            </button>
            {selectedRepo?.full_name ? (
              <a
                href={`https://github.com/${selectedRepo.full_name}/actions`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Open Actions <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Workflows
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Auto-refreshes every 20s
              {lastUpdated ? ` • Last updated ${lastUpdated}` : ""}
            </p>
          </div>

          {loadingWorkflows ? (
            <div className="flex items-center gap-2 p-6 text-sm text-gray-600 dark:text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading workflows...
            </div>
          ) : workflows.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              No workflows found for this repository.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {workflows.map((wf) => {
                const latest = (runByWorkflow.get(wf.id) ?? [])[0];
                return (
                  <li key={wf.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {wf.name}
                        </p>
                        <p className="text-xs text-gray-500">{wf.path}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          State: {wf.state}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          void runWorkflow(wf.id);
                        }}
                        disabled={runningWorkflowId === wf.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {runningWorkflowId === wf.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Run
                      </button>
                    </div>

                    {latest ? (
                      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-800/50">
                        <div className="flex flex-wrap items-center gap-3 text-gray-600 dark:text-gray-300">
                          <span>Latest run #{latest.run_number}</span>
                          <span>Status: {latest.status}</span>
                          <span>Conclusion: {latest.conclusion || "n/a"}</span>
                          <a
                            href={latest.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-300"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              void actOnRun(latest.id, "rerun");
                            }}
                            disabled={actingRunId === latest.id}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-white dark:border-gray-600 dark:hover:bg-gray-700"
                          >
                            <RotateCcw className="h-3 w-3" /> Rerun
                          </button>

                          {(latest.status === "queued" ||
                            latest.status === "in_progress") && (
                            <button
                              type="button"
                              onClick={() => {
                                void actOnRun(latest.id, "cancel");
                              }}
                              disabled={actingRunId === latest.id}
                              className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
                            >
                              <Square className="h-3 w-3" /> Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Recent Runs
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Latest executed workflows in this repository.
            </p>
          </div>

          {runs.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              No workflow runs yet for this repository.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      Workflow
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      Run
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      Conclusion
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      Started
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {workflowNameById.get(run.workflow_id) || run.name}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        #{run.run_number}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {run.head_branch || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {run.status}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {run.conclusion || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {new Date(run.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={run.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              void actOnRun(run.id, "rerun");
                            }}
                            disabled={actingRunId === run.id}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            <RotateCcw className="h-3 w-3" /> Rerun
                          </button>
                          {(run.status === "queued" ||
                            run.status === "in_progress") && (
                            <button
                              type="button"
                              onClick={() => {
                                void actOnRun(run.id, "cancel");
                              }}
                              disabled={actingRunId === run.id}
                              className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
                            >
                              <Square className="h-3 w-3" /> Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
