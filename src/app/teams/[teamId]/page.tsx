"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { ArrowLeft, Mail, UserMinus } from "lucide-react";
import { onRealtimeChange } from "@/lib/realtime-events";

type Member = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
};

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";
  const { user, loading: authLoading } = useAuth();

  const [teamName, setTeamName] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const loadTeamMeta = useCallback(async () => {
    const res = await fetch("/api/teams");
    if (!res.ok) return;
    const teams: { id: string; name: string }[] = await res.json();
    const t = teams.find((x) => x.id === teamId);
    setTeamName(t?.name ?? "");
  }, [teamId]);

  const loadMembers = useCallback(async () => {
    if (!teamId) return;
    setError("");
    const res = await fetch(`/api/teams/${teamId}/members`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        typeof body.error === "string" ? body.error : "Failed to load members",
      );
      setMembers([]);
      return;
    }
    const data = await res.json();
    setMembers(data.members ?? []);
  }, [teamId]);

  useEffect(() => {
    if (authLoading || !user || user.role !== "SUPER_ADMIN") return;
    setLoading(true);
    void (async () => {
      await loadTeamMeta();
      await loadMembers();
      setLoading(false);
    })();
  }, [authLoading, user, loadTeamMeta, loadMembers]);

  useEffect(() => {
    if (authLoading || !user || user.role !== "SUPER_ADMIN") return;

    const unsubscribe = onRealtimeChange((detail) => {
      if (detail.table !== "Team" && detail.table !== "TeamMembership") return;
      void loadTeamMeta();
      void loadMembers();
    });

    return unsubscribe;
  }, [authLoading, user, loadTeamMeta, loadMembers]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to add member");
      setEmail("");
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (userId: string) => {
    if (!confirm("Remove this person from the team?")) return;
    setError("");
    const res = await fetch(
      `/api/teams/${teamId}/members?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Remove failed");
      return;
    }
    await loadMembers();
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (user.role !== "SUPER_ADMIN") {
    return (
      <DashboardLayout>
        <p className="text-gray-600 dark:text-gray-400">
          Only department heads can manage team members.
        </p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <Link
            href="/teams"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            <ArrowLeft className="h-4 w-4" />
            All teams
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {loading && !teamName ? "Team" : teamName || "Team"}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View members and add staff by email. New staff will be invited
            automatically if they do not already have an account.
          </p>
        </div>

        <form
          onSubmit={onAdd}
          className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Staff email
            </label>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add to team"}
          </button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-500" />
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-900">
            {members.length === 0 ? (
              <li className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No members yet. Add someone by email above.
              </li>
            ) : (
              members.map((m) => (
                <li
                  key={m.membershipId}
                  className="flex flex-col gap-3 px-4 py-4 text-gray-900 dark:text-white sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {m.email}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                        {m.role.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(m.userId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <UserMinus className="h-4 w-4" />
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
