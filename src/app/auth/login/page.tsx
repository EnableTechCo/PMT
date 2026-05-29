"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle,
  Users,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [completingMagicLink, setCompletingMagicLink] = useState(false);
  const { login, completePasswordlessLogin, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const emailFromInvite = searchParams.get("email");
    if (emailFromInvite) {
      setEmail(emailFromInvite.trim().toLowerCase());
    }
  }, [searchParams]);

  useEffect(() => {
    const hasMagicQuery =
      searchParams.get("magic") === "1" ||
      Boolean(searchParams.get("code")) ||
      Boolean(searchParams.get("token_hash"));

    const hasHashToken =
      typeof window !== "undefined" &&
      window.location.hash.includes("access_token");

    if (!hasMagicQuery && !hasHashToken) {
      return;
    }

    setError("");
    setNotice("");
    setCompletingMagicLink(true);

    void (async () => {
      try {
        await completePasswordlessLogin();
      } catch (magicError) {
        setError(
          magicError instanceof Error
            ? magicError.message
            : "Failed to complete magic link sign-in.",
        );
      } finally {
        setCompletingMagicLink(false);
      }
    })();
  }, [searchParams, completePasswordlessLogin]);

  useEffect(() => {
    if (user) {
      router.replace(
        user.role === "CLIENT" ? "/client/dashboard" : "/dashboard",
      );
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await login(email);
      setNotice("Magic link sent. Check your inbox to continue.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unexpected error. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage: "url('/login-bg.svg')",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      {/* Background blur orbs */}
      <div className="absolute w-[400px] h-[400px] bg-sky-500/30 rounded-full blur-[120px] top-[-100px] left-[-100px]"></div>
      <div className="absolute w-[400px] h-[400px] bg-blue-500/30 rounded-full blur-[120px] bottom-[-100px] right-[-100px]"></div>

      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md px-6 sm:px-8 lg:px-12 h-full flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, x: 0, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative z-10 w-full bg-black/60 backdrop-blur-sm border border-white/12 shadow-xl rounded-2xl p-8"
          >
            <div className="flex items-center gap-3 mb-6 text-center justify-center">
              <div className="text-white text-2xl font-medium">
                Enable Tech PMT
              </div>
            </div>
            {email ? (
              <div className="mb-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                Invitation link loaded your email address. Click sign in to
                continue.
              </div>
            ) : null}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-700 text-sm">{error}</span>
              </motion.div>
            )}

            {notice && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3"
              >
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span className="text-emerald-700 text-sm">{notice}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm text-gray-200 mb-2 font-thin"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 rounded-lg bg-black/30 text-white placeholder-gray-400 border border-white/12 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500 outline-none transition text-base font-thin"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-3 bg-[var(--color-brand-600)] text-white text-base font-semibold rounded-lg shadow-md hover:from-sky-700 hover:to-indigo-900 transition",
                  (loading || completingMagicLink) &&
                    "opacity-70 cursor-not-allowed",
                )}
              >
                {completingMagicLink ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Completing sign in...
                  </span>
                ) : loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending link...
                  </span>
                ) : (
                  "Send magic link"
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
