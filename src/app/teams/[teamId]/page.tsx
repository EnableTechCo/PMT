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
  invitationStatus: "INVITED_NOT_CONFIRMED" | "INVITE_EXPIRED" | "ACTIVATED";
};

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";
  const { user, loading: authLoading } = useAuth();

  const [teamName, setTeamName] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [fullName, setFullName] = useState("");
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
    setNotice("");
    setWarning("");
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
    setNotice("");
    setWarning("");
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to add member");
      if (body.invited) {
        if (body.inviteEmailSent === false) {
          setWarning(
            typeof body.warning === "string"
              ? body.warning
              : "Member added, but invitation email failed to send.",
          );
        } else {
          setNotice("Member invited and added to the team.");
        }
      } else {
        setNotice("Member added to the team.");
      }
      setFullName("");
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
    setNotice("");
    setWarning("");
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

  const statusLabel = (status: Member["invitationStatus"]) => {
    if (status === "ACTIVATED") return "Activated";
    if (status === "INVITE_EXPIRED") return "Invite expired";
    return "Invited - not activated";
  };

  const statusClasses = (status: Member["invitationStatus"]) => {
    if (status === "ACTIVATED") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    }

    if (status === "INVITE_EXPIRED") {
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    }

    return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  };

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
          className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Full name
              </label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ignatius Surname"
              />
            </div>

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
          </div>

          <div className="mt-4">
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add to team"}
            </button>
          </div>
        </form>

        {notice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            {notice}
          </div>
        )}

        {warning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {warning}
          </div>
        )}

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
                      <p className="mt-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {m.role.replace("_", " ")}
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClasses(m.invitationStatus)}`}
                      >
                        {statusLabel(m.invitationStatus)}
                      </span>
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
