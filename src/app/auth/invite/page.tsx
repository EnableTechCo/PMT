"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { motion } from "framer-motion";

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const inviteToken = searchParams.get("token");

    if (!inviteToken) {
      setError("Invalid invite link. Please request a new invitation.");
      setValidating(false);
      return;
    }

    setToken(inviteToken);

    void (async () => {
      try {
        const res = await fetch(
          `/api/auth/invite?token=${encodeURIComponent(inviteToken)}`,
        );
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : "Failed to validate invitation",
          );
        }

        setEmail(typeof body.email === "string" ? body.email : "");
        setRole(typeof body.role === "string" ? body.role : "");
        setName(typeof body.email === "string" ? body.email.split("@")[0] : "");
        setTokenValid(true);
      } catch (validationError) {
        setError(
          validationError instanceof Error
            ? validationError.message
            : "Failed to validate invitation",
        );
      } finally {
        setValidating(false);
      }
    })();
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, name: name.trim() }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Failed to accept invitation",
        );
      }

      setSuccess(true);
      setTimeout(() => {
        router.replace(role === "CLIENT" ? "/client/dashboard" : "/dashboard");
      }, 1200);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to accept invitation",
      );
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-sm text-slate-300">Validating invitation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-rose-400" />
            <h1 className="mb-2 text-2xl font-semibold text-white">
              Invalid Invitation
            </h1>
            <p className="mb-6 text-sm text-slate-300">{error}</p>
            <Link
              href="/auth/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,144,0.35),transparent_35%),linear-gradient(135deg,#020617_0%,#0f172a_50%,#111827_100%)] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
          >
            <Link
              href="/auth/login"
              className="mb-6 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>

            <div className="mb-8 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Invitation accepted by admin
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Set up your account
              </h1>
              <p className="max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                You have been invited to join Enable. Confirm your details and
                create a password to activate your account.
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-cyan-300" />
                <span>{email || "Invitation email loading..."}</span>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-cyan-300" />
                <span>{role === "CLIENT" ? "Client" : "Internal staff"}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur-xl"
          >
            {success ? (
              <div className="flex h-full min-h-[460px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/20">
                  <CheckCircle className="h-8 w-8 text-emerald-300" />
                </div>
                <h2 className="text-2xl font-semibold text-white">
                  Invitation accepted
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-7 text-slate-300">
                  Your account has been created. Redirecting you into the app...
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-white">
                    Create your password
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    This invitation expires after it is used or after the token
                    window ends.
                  </p>
                </div>

                {error ? (
                  <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">
                      Full name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                        placeholder="Your name"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-slate-300 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-12 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                        placeholder="Create a password"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-12 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                        placeholder="Confirm password"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword((value) => !value)
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Activating account...
                      </>
                    ) : (
                      "Accept invitation"
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}
