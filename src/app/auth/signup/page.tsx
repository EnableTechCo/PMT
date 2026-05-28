import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
      <div className="max-w-xl rounded-3xl border border-slate-800 bg-slate-900/95 p-10 shadow-2xl shadow-slate-950/40">
        <h1 className="text-4xl font-semibold tracking-tight">
          Signup Disabled
        </h1>
        <p className="mt-4 text-slate-300 leading-7">
          Account creation is invite-only. Please contact your administrator to
          get access.
        </p>
        <div className="mt-8">
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/10 hover:bg-blue-500 transition"
          >
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}
