"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity,
  AlertTriangle,
  Database,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Radar,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MonitoringAuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
};

type MonitoringOverview = {
  health: {
    status: string;
    timestamp: string;
    uptime: number;
    environment: string | null;
    version: string | null;
    database: {
      reachable: boolean;
      users: number;
    };
  };
  auditLogs: MonitoringAuditLog[];
  integrations: {
    sentry: {
      configured: boolean;
      environment: string | null;
      release: string | null;
    };
  };
};

function formatDuration(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0s";
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${Math.floor(totalSeconds % 60)}s`;
  return `${Math.floor(totalSeconds)}s`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function MonitoringPage() {
  const { user, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/monitoring/overview");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to load monitoring overview");
      }
      setOverview(body as MonitoringOverview);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load monitoring overview",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user || user.role !== "SUPER_ADMIN") return;
    void loadOverview();
  }, [authLoading, user, loadOverview]);

  useEffect(() => {
    if (!overview) return;
    const interval = setInterval(() => {
      void loadOverview();
    }, 30000);

    return () => clearInterval(interval);
  }, [overview, loadOverview]);

  const healthTone = useMemo(() => {
    const status = overview?.health.status ?? "unknown";
    if (status === "healthy")
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "unhealthy") return "bg-red-50 text-red-700 border-red-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  }, [overview]);

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
          Only super admins can access monitoring.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
              <Radar className="h-7 w-7 text-indigo-500" /> Monitoring
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
              Super admin visibility for app health, audit activity, and
              external observability tooling.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadOverview();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  App health
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                  {overview?.health.status || (loading ? "Loading" : "Unknown")}
                </p>
              </div>
              <div
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  healthTone,
                )}
              >
                {overview?.health.status || "unknown"}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Activity className="h-4 w-4" />
              Last check{" "}
              {overview ? formatDate(overview.health.timestamp) : "pending"}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Runtime
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {overview ? formatDuration(overview.health.uptime) : "--"}
            </p>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {overview?.health.environment || "environment unknown"}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Database
            </p>
            <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
              <Database className="h-6 w-6 text-indigo-500" />
              {overview?.health.database.reachable ? "Reachable" : "Pending"}
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {overview
                ? `${overview.health.database.users} users tracked`
                : "Loading database status"}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Audit feed
            </p>
            <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
              <ShieldCheck className="h-6 w-6 text-emerald-500" />
              {overview?.auditLogs.length ?? 0}
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Recent super-admin events available below
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sentry
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Error tracking and performance monitoring.
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  overview?.integrations.sentry.configured
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
                )}
              >
                {overview?.integrations.sentry.configured
                  ? "Configured"
                  : "Not configured"}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                Environment:{" "}
                {overview?.integrations.sentry.environment || "unknown"}
              </p>
              <p>
                Release: {overview?.integrations.sentry.release || "not set"}
              </p>
              <p>
                Configured via SENTRY_DSN and SENTRY_AUTH_TOKEN in production.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent audit activity
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {lastUpdated
                  ? `Last refreshed ${lastUpdated}`
                  : "Waiting for data"}
              </p>
            </div>

            <a
              href="/workflows"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Workflow className="h-4 w-4" /> Open workflows
            </a>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-gray-600 dark:text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading monitoring
              data...
            </div>
          ) : overview?.auditLogs.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Action
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Actor
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Entity
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {overview.auditLogs.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {entry.action}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {entry.actor?.name || entry.actor?.email || "System"}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                        <div>{entry.entityType}</div>
                        <div className="text-xs text-gray-500">
                          {entry.entityId}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {formatDate(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-sm text-gray-500">
              No audit events found.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div className="space-y-1">
              <p className="font-semibold text-gray-900 dark:text-white">
                What this page covers
              </p>
              <p>
                App health comes from the local health endpoint, audit activity
                comes from the database, and Sentry shows configuration
                readiness. Add the Sentry SDK and production environment
                variables when you want error tracking and release health to
                light up fully in production.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
