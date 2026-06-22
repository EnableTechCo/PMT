"use client";

import type { HTMLAttributes, MouseEvent } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { motion, useAnimation, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";

export interface CalendarCogIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface CalendarCogIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  externalAnimate?: boolean;
}

const G_VARIANTS: Variants = {
  normal: { rotate: 0 },
  animate: { rotate: 180 },
};

const CalendarCogIcon = forwardRef<CalendarCogIconHandle, CalendarCogIconProps>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      size = 18,
      externalAnimate,
      ...props
    },
    ref,
  ) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useEffect(() => {
      if (typeof externalAnimate !== "boolean") return;
      isControlledRef.current = true;
      if (externalAnimate) {
        void controls.start("animate");
      } else {
        void controls.start("normal");
      }
    }, [controls, externalAnimate]);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => {
          void controls.start("animate");
        },
        stopAnimation: () => {
          void controls.start("normal");
        },
      };
    });

    const handleMouseEnter = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (typeof externalAnimate === "boolean") {
          onMouseEnter?.(e);
          return;
        }
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          void controls.start("animate");
        }
      },
      [controls, externalAnimate, onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (typeof externalAnimate === "boolean") {
          onMouseLeave?.(e);
          return;
        }
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          void controls.start("normal");
        }
      },
      [controls, externalAnimate, onMouseLeave],
    );

    return (
      <div
        className={cn(className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M21 10.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
          <path d="M16 2v4" />
          <path d="M3 10h18" />
          <path d="M8 2v4" />
          <motion.g
            animate={controls}
            transition={{ type: "spring", stiffness: 50, damping: 10 }}
            variants={G_VARIANTS}
          >
            <path d="m15.2 16.9-.9-.4" />
            <path d="m15.2 19.1-.9.4" />
            <path d="m16.9 15.2-.4-.9" />
            <path d="m16.9 20.8-.4.9" />
            <path d="m19.5 14.3-.4.9" />
            <path d="m19.5 21.7-.4-.9" />
            <path d="m21.7 16.5-.9.4" />
            <path d="m21.7 19.5-.9-.4" />
            <circle cx="18" cy="18" r="3" />
          </motion.g>
        </svg>
      </div>
    );
  },
);

CalendarCogIcon.displayName = "CalendarCogIcon";

export { CalendarCogIcon };
