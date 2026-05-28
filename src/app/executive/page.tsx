"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { onRealtimeChange } from "@/lib/realtime-events";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#0ea5e9", "#22c55e", "#f59e0b"];

type ExecutivePayload = {
  ticketsByStatus: { status: string; count: number }[];
  projectsByHealth: { health: string; count: number }[];
  projectsByStatus: { status: string; count: number }[];
  openTickets: number;
  completedPerWeek: { week: string; count: number }[];
  teams: { id: string; name: string; _count: { tickets: number } }[];
};

export default function ExecutivePage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ExecutivePayload | null>(null);
  const [error, setError] = useState("");

  const loadExecutiveData = async () => {
    try {
      const res = await fetch("/api/analytics/executive");
      if (!res.ok) throw new Error("Failed to load analytics");
      setData(await res.json());
      setError("");
    } catch {
      setError("Could not load executive analytics.");
    }
  };

  useEffect(() => {
    if (authLoading || !user || user.role !== "SUPER_ADMIN") return;
    void loadExecutiveData();
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user || user.role !== "SUPER_ADMIN") return;

    const unsubscribe = onRealtimeChange((detail) => {
      if (
        detail.table !== "Ticket" &&
        detail.table !== "Project" &&
        detail.table !== "Team" &&
        detail.table !== "Client"
      ) {
        return;
      }
      void loadExecutiveData();
    });

    return unsubscribe;
  }, [authLoading, user]);

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
        <p className="text-gray-600">
          Executive analytics are only available to department heads.
        </p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Executive overview
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Portfolio-style signals: ticket mix, project health, and throughput.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
                <p className="text-sm font-medium text-gray-500">
                  Open tickets
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {data.openTickets}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
                <p className="text-sm font-medium text-gray-500">Teams</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {data.teams.length}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
                <p className="text-sm font-medium text-gray-500">
                  Completed (window in chart)
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {data.completedPerWeek.reduce((a, b) => a + b.count, 0)}
                </p>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Tickets by status
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.ticketsByStatus}>
                      <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="#6366f1"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Project health
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.projectsByHealth}
                        dataKey="count"
                        nameKey="health"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {data.projectsByHealth.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Completed tickets by week
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.completedPerWeek}>
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Tickets per team
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.teams.map((t) => ({
                      name: t.name,
                      tickets: t._count.tickets,
                    }))}
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="tickets"
                      fill="#22c55e"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
