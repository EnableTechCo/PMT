"use client";

import { MetricCard, type MetricCardColor } from "@/components/MetricCard";

export interface OverviewMetric {
  label: string;
  value: number;
  sublabel?: string;
}

const COLOR_CYCLE: MetricCardColor[] = [
  "blue",
  "orange",
  "indigo",
  "purple",
  "emerald",
  "rose",
];

export function OverviewMetricStrip({
  metrics,
}: {
  metrics: OverviewMetric[];
}) {
  return (
    <div
      className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      aria-label="Overview counts"
      role="list"
    >
      {metrics.map((m, i) => (
        <MetricCard
          key={m.label}
          value={m.value}
          label={m.label}
          sublabel={m.sublabel}
          color={COLOR_CYCLE[i % COLOR_CYCLE.length]}
        />
      ))}
    </div>
  );
}
