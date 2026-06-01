"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/monitoring", label: "Alerts" },
  { href: "/workflows", label: "Workflows" },
];

export function MonitoringTabs({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const showBadge = tab.href === "/monitoring" && alertCount > 0;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-2 border px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-red-600 bg-red-600 text-white visited:text-white dark:border-red-500 dark:bg-red-500 dark:text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800",
            )}
          >
            <span>{tab.label}</span>
            {showBadge ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {alertCount > 99 ? "99+" : alertCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
