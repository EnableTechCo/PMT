"use client";

import { cn } from "@/lib/utils";

export interface OverviewMetric {
  label: string;
  value: number;
}

export function OverviewMetricStrip({
  metrics,
}: {
  metrics: OverviewMetric[];
}) {
  return (
    <div
      className="inline-flex w-full max-w-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] shadow-card sm:flex-row dark:border-gray-800 dark:bg-[#1c1c24]"
      aria-label="Overview counts"
      role="list"
    >
      {metrics.map((m, i) => (
        <div
          key={m.label}
          role="listitem"
          className={cn(
            "flex flex-1 items-baseline justify-center gap-2 px-4 py-3.5 text-sm sm:min-w-0 sm:justify-start sm:px-5",
            "border-[var(--border)] bg-[var(--surface-elevated)] sm:border-l sm:border-t-0 sm:first:border-l-0 dark:border-gray-800 dark:bg-[#1c1c24]",
            i > 0 && "border-t sm:border-t-0",
          )}
        >
          <span className="text-lg font-semibold tabular-nums text-brand-700 dark:text-brand-400 sm:text-xl">
            {m.value}
          </span>
          <span className="font-medium capitalize leading-snug text-gray-600 dark:text-gray-400">
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}
