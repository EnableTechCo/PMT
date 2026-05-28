"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "orange" | "red" | "purple";
  trend?: "up" | "down" | "neutral";
}

const colorClasses = {
  blue: {
    bg: "from-blue-500/10 to-blue-600/10",
    border: "border-blue-500/20",
    icon: "bg-blue-500/20",
    iconColor: "text-blue-700 dark:text-blue-400",
    value: "text-blue-950 dark:text-blue-200",
    change: "text-blue-700 dark:text-blue-400",
  },
  green: {
    bg: "from-green-500/10 to-green-600/10",
    border: "border-green-500/20",
    icon: "bg-green-500/20",
    iconColor: "text-green-700 dark:text-green-400",
    value: "text-green-950 dark:text-green-200",
    change: "text-green-700 dark:text-green-400",
  },
  orange: {
    bg: "from-orange-500/10 to-orange-600/10",
    border: "border-orange-500/20",
    icon: "bg-orange-500/20",
    iconColor: "text-orange-700 dark:text-orange-400",
    value: "text-orange-950 dark:text-orange-200",
    change: "text-orange-700 dark:text-orange-400",
  },
  red: {
    bg: "from-red-500/10 to-red-600/10",
    border: "border-red-500/20",
    icon: "bg-red-500/20",
    iconColor: "text-red-700 dark:text-red-400",
    value: "text-red-950 dark:text-red-200",
    change: "text-red-700 dark:text-red-400",
  },
  purple: {
    bg: "from-indigo-500/10 to-indigo-600/10",
    border: "border-indigo-500/20",
    icon: "bg-indigo-500/20",
    iconColor: "text-indigo-700 dark:text-indigo-400",
    value: "text-indigo-950 dark:text-indigo-200",
    change: "text-indigo-700 dark:text-indigo-400",
  },
};

export default function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  color,
  trend = "neutral",
}: StatCardProps) {
  const colors = colorClasses[color];

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

  return (
    <div
      className={cn(
        "bg-gradient-to-br backdrop-blur-sm rounded-xl p-6 border transition-all duration-300 hover:scale-105 card-hover",
        colors.bg,
        colors.border,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className={cn("text-sm font-medium", colors.iconColor)}>{title}</p>
          <p className={cn("text-2xl font-bold mt-1", colors.value)}>{value}</p>
          {change !== undefined && (
            <div className="flex items-center space-x-1 mt-2">
              <span className={cn("text-xs", colors.change)}>
                {getTrendIcon()}
              </span>
              <span className={cn("text-xs font-medium", colors.change)}>
                {change > 0 ? "+" : ""}
                {change}%
              </span>
              {changeLabel && (
                <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-lg", colors.icon)}>
          <div className={cn("w-6 h-6", colors.iconColor)}>{icon}</div>
        </div>
      </div>
    </div>
  );
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
