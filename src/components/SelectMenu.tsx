"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
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
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 1000,
      });
    };

    updatePosition();

    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      const menuEl = menuRef.current;
      const target = e.target as Node;
      if (el?.contains(target) || menuEl?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const mdTrigger = "min-h-9 px-3 py-2 text-sm rounded-md gap-2";
  const smTrigger = "min-h-8 px-2 py-1.5 text-xs rounded-md gap-1.5";
  const mdItem = "px-3 py-2 text-sm";
  const smItem = "px-2 py-1.5 text-xs";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
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

      {open &&
        typeof document !== "undefined" &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={menuStyle}
            className={cn(
              "overflow-hidden rounded-md border border-[var(--border)] bg-white py-0.5 shadow-card",
              "dark:border-gray-700 dark:bg-[#1c1c24]",
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
          </div>,
          document.body,
        )}
    </div>
  );
}
