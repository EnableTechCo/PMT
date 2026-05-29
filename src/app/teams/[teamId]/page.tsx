"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ArrowLeft, Mail, RotateCcw, UserMinus } from "lucide-react";
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
  const [role, setRole] = useState<"USER" | "SUPER_ADMIN">("USER");
  const [busy, setBusy] = useState(false);
  const [resendingForUserId, setResendingForUserId] = useState<string | null>(
    null,
  );
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

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
    setNotice("");
    setWarning("");
    setBusy(true);
    const endpoint = `/api/teams/${teamId}/members`;
    const payload = {
      name: fullName.trim(),
      email: email.trim(),
      role,
    };

    console.groupCollapsed("[Team Add] Add to team request");
    console.log("endpoint:", endpoint);
    console.log("payload:", payload);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      console.log("response status:", res.status);
      console.log("response ok:", res.ok);
      console.log("response body:", body);
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
      setRole("USER");
      await loadMembers();
    } catch (err) {
      console.error("[Team Add] request failed:", err);
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      console.groupEnd();
      setBusy(false);
    }
  };

  const onRemove = async () => {
    const targetMember = memberToRemove;
    if (!targetMember) return;

    // Close modal immediately so errors are shown on the page, not behind an overlay.
    setMemberToRemove(null);
    setError("");
    setNotice("");
    setWarning("");
    setRemoving(true);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/members?userId=${encodeURIComponent(targetMember.userId)}`,
        { method: "DELETE" },
      );
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Remove failed");
        return;
      }

      await loadMembers();
      setNotice(`Removed ${targetMember.name} from this team.`);
    } catch {
      setError("Remove failed. Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  const onResendInvite = async (member: Member) => {
    setError("");
    setNotice("");
    setWarning("");
    setResendingForUserId(member.userId);

    try {
      const res = await fetch(
        `/api/teams/${teamId}/members/${member.userId}/resend-invite`,
        {
          method: "POST",
        },
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Failed to send invitation email",
        );
      }

      setNotice(
        typeof body.message === "string"
          ? body.message
          : `Invitation email sent to ${member.email}`,
      );
      await loadMembers();
    } catch (err) {
      setWarning(
        err instanceof Error ? err.message : "Failed to send invitation email",
      );
    } finally {
      setResendingForUserId(null);
    }
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
          <div className="grid gap-3 sm:grid-cols-3">
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

            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Role
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "USER" | "SUPER_ADMIN")
                }
              >
                <option value="USER">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
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
                  <div className="flex items-center gap-2">
                    {m.invitationStatus !== "ACTIVATED" && (
                      <button
                        type="button"
                        onClick={() => {
                          void onResendInvite(m);
                        }}
                        disabled={resendingForUserId === m.userId}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {resendingForUserId === m.userId
                          ? "Sending..."
                          : "Resend invite"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMemberToRemove(m)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      <UserMinus className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <ConfirmDialog
        isOpen={memberToRemove !== null}
        title="Remove team member"
        message={
          memberToRemove
            ? `Remove ${memberToRemove.name} from this team? This only removes team membership and does not delete the user account.`
            : ""
        }
        confirmLabel="Remove"
        busy={removing}
        onCancel={() => setMemberToRemove(null)}
        onConfirm={() => {
          void onRemove();
        }}
      />
    </DashboardLayout>
  );
}
