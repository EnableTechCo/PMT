"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import DashboardLayout from "@/components/DashboardLayout";
import { SelectMenu } from "@/components/SelectMenu";
import { onRealtimeChange } from "@/lib/realtime-events";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  health: string;
  progress: number;
  team: { id: string; name: string };
  portfolio: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  _count: { milestones: number; tickets: number };
};

export default function ProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    teams,
    activeTeamId,
    setActiveTeamId,
    loading: teamLoading,
  } = useTeam();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user || user.role === "CLIENT") return;
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (user.role === "USER") {
        if (!activeTeamId) {
          setProjects([]);
          setLoading(false);
          return;
        }
        params.set("teamId", activeTeamId);
      } else if (user.role === "SUPER_ADMIN" && activeTeamId) {
        params.set("teamId", activeTeamId);
      }
      const res = await fetch(`/api/projects?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to load projects");
      }
      setProjects(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      if (projects.length === 0) {
        setProjects([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, activeTeamId, projects.length]);

  useEffect(() => {
    if (authLoading || !user || user.role === "CLIENT") return;
    void load();
  }, [authLoading, user, load]);

  useEffect(() => {
    if (authLoading || !user || user.role === "CLIENT") return;

    const unsubscribe = onRealtimeChange((detail) => {
      if (
        detail.table !== "Project" &&
        detail.table !== "Client" &&
        detail.table !== "Team" &&
        detail.table !== "GithubRepo" &&
        detail.table !== "Milestone" &&
        detail.table !== "Ticket"
      ) {
        return;
      }
      void load();
    });

    return unsubscribe;
  }, [authLoading, user, load]);

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
        <p className="text-gray-600">
          Use the client portal for your projects.
        </p>
      </DashboardLayout>
    );
  }

  const activeTeamName = teams.find((team) => team.id === activeTeamId)?.name;
  const isInitialLoading = loading && projects.length === 0;

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Projects
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Track projects for your team
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {user.role === "SUPER_ADMIN" && (
              <Link
                href="/executive"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
              >
                Executive charts
              </Link>
            )}
            {user.role === "SUPER_ADMIN" ? (
              <SelectMenu
                value={activeTeamId}
                onChange={setActiveTeamId}
                disabled={teamLoading || teams.length === 0}
                options={teams.map((team) => ({
                  value: team.id,
                  label: team.name,
                }))}
                placeholder="Team"
                className="min-w-[180px]"
                triggerClassName="bg-gray-100/80 dark:bg-slate-800/80"
              />
            ) : (
              <div className="min-w-[180px] rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-[#111217] dark:text-gray-200">
                {teamLoading ? "Loading team…" : activeTeamName || "My team"}
              </div>
            )}
          </div>
        </div>

        {user.role === "USER" && teams.length === 0 && !teamLoading && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            You need to be on a team to load projects.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {isInitialLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-500" />
          </div>
        ) : (
          <>
            {loading && projects.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white/90 p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-[#111217]/80">
                Refreshing projects…
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="rounded-xl border border-gray-200 bg-white p-5 transition hover:border-indigo-300 dark:border-gray-700 bg-[var(--surface-elevated)] shadow-card dark:border-gray-800 dark:bg-[#1c1c24]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      {p.name}
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.health === "GREEN"
                          ? "bg-green-100 text-green-800"
                          : p.health === "AMBER"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {p.health}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {p.team.name}
                    {p.client ? ` · ${p.client.name}` : ""}
                  </p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {p.progress}% · {p._count.tickets} tickets ·{" "}
                    {p._count.milestones} milestones
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}

        {!loading && projects.length === 0 && !error && (
          <p className="text-center text-gray-500">
            No projects for this filter.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
