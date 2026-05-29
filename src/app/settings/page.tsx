"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Github,
  Settings as SettingsIcon,
  Key,
  CheckCircle2,
  AlertCircle,
  Shield,
  User,
  Loader2,
  Trash2,
  ExternalLink,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GithubUser {
  login: string;
  avatarUrl: string;
}

type GithubConnectionSource = "system" | "user";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex h-full w-full items-center justify-center p-8">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading settings...
            </div>
          </div>
        </DashboardLayout>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "github" | "security">(
    "github",
  );

  // GitHub integration state
  const [githubToken, setGithubToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [githubUser, setGithubUser] = useState<GithubUser | null>(null);
  const [githubSource, setGithubSource] =
    useState<GithubConnectionSource | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [connectError, setConnectError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailMessage, setTestEmailMessage] = useState("");
  const [testEmailError, setTestEmailError] = useState("");
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // User Profile display state (dummy/read-only for beauty)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      checkGithubStatus();
    }
  }, [user]);

  useEffect(() => {
    const githubStatus = searchParams.get("github");
    if (!githubStatus) return;

    if (githubStatus === "connected") {
      setSuccessMsg("Successfully authenticated with GitHub OAuth.");
      setConnectError("");
      void checkGithubStatus();
      return;
    }

    if (githubStatus === "oauth_not_configured") {
      setConnectError(
        "GitHub OAuth is not configured on this deployment. Ask your admin to set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
      );
      return;
    }

    if (githubStatus === "oauth_failed") {
      setConnectError("GitHub OAuth failed. Please try connecting again.");
      return;
    }

    if (githubStatus === "oauth_state_invalid") {
      setConnectError("GitHub OAuth state validation failed. Please retry.");
    }
  }, [searchParams]);

  async function sendTestEmail() {
    setTestEmailLoading(true);
    setTestEmailMessage("");
    setTestEmailError("");

    try {
      const res = await fetch("/api/settings/test-email", {
        method: "POST",
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Failed to send test email",
        );
      }

      setTestEmailMessage(
        typeof body.message === "string"
          ? body.message
          : "Test email sent successfully.",
      );
    } catch (error) {
      setTestEmailError(
        error instanceof Error
          ? error.message
          : "Failed to send test email",
      );
    } finally {
      setTestEmailLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-brand-500 animate-spin-slow" />
            Settings
          </h1>
          <p className="text-gray-500 mt-1">
            Manage your profile, security, and repository integrations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar tabs */}
          <div className="md:col-span-1 flex flex-col space-y-1 bg-white/60 dark:bg-[#1c1c24]/60 backdrop-blur-md border border-gray-200 dark:border-gray-800 p-4 rounded-xl shadow-card h-fit">
            <button
              onClick={() => setActiveTab("profile")}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === "profile"
                  ? "bg-brand-600/[0.12] text-brand-800 ring-1 ring-brand-500/20 dark:bg-brand-600/15 dark:text-brand-200"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5",
              )}
            >
              <User className="w-4 h-4" />
              My Profile
            </button>
            <button
              onClick={() => setActiveTab("github")}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === "github"
                  ? "bg-brand-600/[0.12] text-brand-800 ring-1 ring-brand-500/20 dark:bg-brand-600/15 dark:text-brand-200"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5",
              )}
            >
              <Github className="w-4 h-4" />
              GitHub Integration
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === "security"
                  ? "bg-brand-600/[0.12] text-brand-800 ring-1 ring-brand-500/20 dark:bg-brand-600/15 dark:text-brand-200"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5",
              )}
            >
              <Shield className="w-4 h-4" />
              Security
            </button>
          </div>

          {/* Settings Panels */}
          <div className="md:col-span-3">
            {activeTab === "profile" && (
              <div className="bg-white dark:bg-[#1c1c24] border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-card space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Profile Details
                  </h2>
                  <p className="text-sm text-gray-500">
                    Your basic account information
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      disabled
                      className="w-full input-modern bg-gray-50 dark:bg-gray-900 cursor-not-allowed opacity-70"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full input-modern bg-gray-50 dark:bg-gray-900 cursor-not-allowed opacity-70"
                    />
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 flex gap-3 text-sm text-blue-700 dark:text-blue-300">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Profile updates are managed by IT
                    </p>
                    <p className="mt-0.5 text-xs opacity-90">
                      To change your profile details, contact your supervisor or
                      administrative team.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "github" && (
              <div className="bg-white dark:bg-[#1c1c24] border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-card space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Github className="w-6 h-6" />
                      GitHub Developer Flow
                    </h2>
                    <p className="text-sm text-gray-500">
                      Use GitHub access to sync branches, tickets, and PR status
                    </p>
                    {githubSource === "system" ? (
                      <p className="mt-1 text-xs text-gray-500">
                        Department-managed GitHub access is active for every
                        signed-in user.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0">
                    {checkingStatus ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking status...
                      </div>
                    ) : githubUser ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/25 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/25">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Not Connected
                      </span>
                    )}
                  </div>
                </div>

                {successMsg && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 flex gap-3 text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{successMsg}</p>
                    </div>
                  </div>
                )}

                {statusError && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-4 flex gap-3 text-sm text-red-700 dark:text-red-300">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        Failed to load connection details
                      </p>
                      <p className="mt-0.5 text-xs opacity-90">{statusError}</p>
                    </div>
                  </div>
                )}

                {githubUser ? (
                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      {githubUser.avatarUrl ? (
                        <img
                          src={githubUser.avatarUrl}
                          alt={githubUser.login}
                          className="w-14 h-14 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-lg">
                          {githubUser.login.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Connected Account
                        </p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          @{githubUser.login}
                          <a
                            href={`https://github.com/${githubUser.login}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-brand-500 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </p>
                      </div>
                    </div>

                    {githubSource === "system" ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                        Managed by department settings
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDisconnectConfirm(true)}
                        disabled={connecting}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-red-200 dark:border-red-900/50 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Disconnect Account
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-[#13131a] p-4">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                        One-click connect (recommended)
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        Connect with GitHub OAuth so you do not need to manually
                        paste personal access tokens.
                      </p>
                      <button
                        onClick={handleOAuthConnect}
                        disabled={connecting}
                        className="btn-primary inline-flex items-center gap-2"
                      >
                        <Github className="w-4 h-4" />
                        Connect with GitHub
                      </button>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                      </div>
                      <div className="relative flex justify-center text-[11px] uppercase tracking-wide text-gray-400">
                        <span className="bg-white px-2 dark:bg-[#1c1c24]">
                          or use personal access token
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#13131a] rounded-xl p-4 border border-gray-200 dark:border-gray-800/80 text-sm space-y-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Key className="w-4 h-4 text-brand-500" />
                        How to connect your GitHub account:
                      </p>
                      <ol className="list-decimal pl-5 space-y-1.5 text-gray-600 dark:text-gray-400 text-xs">
                        <li>
                          Go to your GitHub{" "}
                          <a
                            href="https://github.com/settings/tokens/new?scopes=repo&description=PMT%20Hub%20Integration"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-600 hover:underline inline-flex items-center gap-0.5"
                          >
                            Personal Access Tokens (Classic){" "}
                            <ExternalLink className="w-3 h-3 inline" />
                          </a>{" "}
                          settings.
                        </li>
                        <li>
                          Generate a token with the{" "}
                          <code className="font-semibold text-brand-600 bg-brand-50 dark:bg-brand-500/10 px-1 py-0.5 rounded">
                            repo
                          </code>{" "}
                          scope selected.
                        </li>
                        <li>
                          Copy the generated token and paste it in the field
                          below.
                        </li>
                      </ol>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                        GitHub Personal Access Token (Classic)
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="password"
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          className="flex-1 input-modern font-mono"
                          disabled={connecting}
                        />
                        <button
                          onClick={handleConnect}
                          disabled={connecting || !githubToken}
                          className="btn-primary px-6 shrink-0 inline-flex items-center gap-2"
                        >
                          {connecting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <Github className="w-4 h-4" />
                              Connect GitHub
                            </>
                          )}
                        </button>
                      </div>
                      {connectError && (
                        <p className="text-xs text-red-500 flex items-center gap-1.5 mt-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {connectError}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "security" && (
              <div className="bg-white dark:bg-[#1c1c24] border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-card space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Security Settings
                  </h2>
                  <p className="text-sm text-gray-500">
                    Manage password security and safety policies
                  </p>
                </div>
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/20 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <Lock className="w-8 h-8 text-gray-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      SSO & Identity Provider Active
                    </p>
                    <p className="text-xs">
                      Your credential credentials are secured via Google
                      Workspace Single Sign-On. Direct password modification is
                      deactivated.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#13131a] p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      SMTP test email
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Send a direct test message to your current account to
                      verify server-side email delivery.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void sendTestEmail();
                    }}
                    disabled={testEmailLoading}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testEmailLoading ? "Sending..." : "Send test email"}
                  </button>

                  {testEmailMessage ? (
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      {testEmailMessage}
                    </p>
                  ) : null}

                  {testEmailError ? (
                    <p className="text-sm text-red-600 dark:text-red-300">
                      {testEmailError}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showDisconnectConfirm}
        title="Disconnect GitHub"
        message="Are you sure you want to disconnect GitHub? You will not be able to link branches or pull requests."
        confirmLabel="Disconnect"
        onCancel={() => setShowDisconnectConfirm(false)}
        onConfirm={() => {
          setShowDisconnectConfirm(false);
          void handleDisconnect();
        }}
      />
    </DashboardLayout>
  );

  async function handleConnect() {
    setConnecting(true);
    setConnectError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/github/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: githubToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setGithubUser(data.githubUser);
        setSuccessMsg(
          "Successfully authenticated with GitHub! Your repositories and branches are now active.",
        );
        setGithubToken("");
      } else {
        setConnectError(
          data.error ||
            "Failed to authenticate. Make sure the token is correct.",
        );
      }
    } catch (e: any) {
      setConnectError(e.message || "An unexpected error occurred.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setConnecting(true);
    setConnectError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/github/auth", {
        method: "DELETE",
      });
      if (res.ok) {
        setGithubUser(null);
        setSuccessMsg("GitHub connection removed successfully.");
      } else {
        setConnectError("Failed to disconnect from GitHub.");
      }
    } catch (e: any) {
      setConnectError("An error occurred during disconnection.");
    } finally {
      setConnecting(false);
    }
  }

  async function checkGithubStatus() {
    setCheckingStatus(true);
    try {
      // Fetch user's own repos. If this returns 400 "GitHub not connected", then they're not connected!
      // But let's check if we can get user info or if they are authenticated.
      // Wait, let's fetch `/api/github/repos` with a parameter to not trigger full list, or just let it list.
      // Better: we can fetch repos. If it works, we can also fetch the authenticated GitHub user to show login/avatar!
      // But wait, the listForAuthenticatedUser call requires a valid token. If it's valid, we can fetch their github profile info using octokit or using a custom backend endpoint!
      // Let's first make a custom backend GET endpoint for `/api/github/auth` so that we get the authenticated GitHub user info directly and cleanly!
      // Let's implement that!
      const res = await fetch("/api/github/auth");
      const data = await res.json();
      if (res.ok && data.connected) {
        setGithubUser(data.githubUser);
        setGithubSource(data.source ?? "user");
      } else {
        setGithubUser(null);
        setGithubSource(null);
      }
    } catch (e) {
      console.error("Check status error:", e);
    } finally {
      setCheckingStatus(false);
    }
  }

  function handleOAuthConnect() {
    setConnectError("");
    setSuccessMsg("");
    window.location.href = "/api/github/oauth/start";
  }
}
