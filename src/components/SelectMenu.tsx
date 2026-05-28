"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectMenuOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectMenuProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectMenuOption[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  size?: "md" | "sm";
};

export function SelectMenu({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "Select…",
  className,
  triggerClassName,
  menuClassName,
  size = "md",
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const mdTrigger = "min-h-9 px-3 py-2 text-sm rounded-md gap-2";
  const smTrigger = "min-h-8 px-2 py-1.5 text-xs rounded-md gap-1.5";
  const mdItem = "px-3 py-2 text-sm";
  const smItem = "px-2 py-1.5 text-xs";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between border border-gray-200 bg-white text-left text-gray-900 outline-none",
          "hover:bg-gray-50",
          "focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:border-gray-700 dark:bg-[#1c1c24] dark:text-gray-100 dark:hover:bg-white/5",
          size === "md" ? mdTrigger : smTrigger,
          triggerClassName,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "shrink-0 text-slate-500 opacity-70",
            size === "md" ? "h-4 w-4" : "h-3.5 w-3.5",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-full z-50 mt-0.5 overflow-hidden rounded-md border border-[var(--border)] bg-white py-0.5 shadow-card",
            "dark:border-gray-700 dark:bg-[#1c1c24]",
            size === "sm" && "mt-0",
            menuClassName,
          )}
        >
          <div className="max-h-60 overflow-y-auto">
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={opt.disabled}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left transition-colors",
                    size === "md" ? mdItem : smItem,
                    isActive
                      ? "bg-brand-50 font-medium text-brand-900 dark:bg-brand-950/50 dark:text-brand-100"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5",
                    opt.disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="block truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
