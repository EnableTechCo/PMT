"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/MetricCard";
import type { MetricCardColor } from "@/components/MetricCard";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  color: MetricCardColor;
  trend?: "up" | "down" | "neutral";
}

const colorClasses = {
  blue: {
    stripe: "bg-blue-500",
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    value: "text-blue-700 dark:text-blue-300",
    change: "text-blue-600 dark:text-blue-400",
    tag: "text-blue-500/70 dark:text-blue-400/60",
  },
  green: {
    stripe: "bg-emerald-500",
    iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-300",
    change: "text-emerald-600 dark:text-emerald-400",
    tag: "text-emerald-500/70 dark:text-emerald-400/60",
  },
  orange: {
    stripe: "bg-orange-400",
    iconBg: "bg-orange-50 dark:bg-orange-950/40",
    iconColor: "text-orange-600 dark:text-orange-400",
    value: "text-orange-700 dark:text-orange-300",
    change: "text-orange-600 dark:text-orange-400",
    tag: "text-orange-500/70 dark:text-orange-400/60",
  },
  red: {
    stripe: "bg-rose-500",
    iconBg: "bg-rose-50 dark:bg-rose-950/40",
    iconColor: "text-rose-600 dark:text-rose-400",
    value: "text-rose-700 dark:text-rose-300",
    change: "text-rose-600 dark:text-rose-400",
    tag: "text-rose-500/70 dark:text-rose-400/60",
  },
  purple: {
    stripe: "bg-purple-500",
    iconBg: "bg-purple-50 dark:bg-purple-950/40",
    iconColor: "text-purple-600 dark:text-purple-400",
    value: "text-purple-700 dark:text-purple-300",
    change: "text-purple-600 dark:text-purple-400",
    tag: "text-purple-500/70 dark:text-purple-400/60",
  },
};

export default function StatCard({
  title,
  value,
  change,
  changeLabel,
  color,
  trend = "neutral",
}: StatCardProps) {
  const colors =
    colorClasses[color as keyof typeof colorClasses] ?? colorClasses.blue;

  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-3 h-3" />;
      case "down":
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Minus className="w-3 h-3" />;
    }
  };

  const sublabel =
    change !== undefined
      ? `${change > 0 ? "+" : ""}${change}% ${changeLabel ?? ""}`.trim()
      : changeLabel;

  return (
    <MetricCard value={value} label={title} sublabel={sublabel} color={color} />
  );

  // trend icon kept for future use
  void getTrendIcon;
  void colors;
  void cn;
}

interface QuickStatsProps {
  stats: StatCardProps[];
}

export function QuickStats({ stats }: QuickStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}
