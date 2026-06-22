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

export interface UsersIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface UsersIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  externalAnimate?: boolean;
}

const PATH_VARIANTS: Variants = {
  normal: {
    translateX: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 13,
    },
  },
  animate: {
    translateX: [-6, 0],
    transition: {
      delay: 0.1,
      type: "spring",
      stiffness: 200,
      damping: 13,
    },
  },
};

const UsersIcon = forwardRef<UsersIconHandle, UsersIconProps>(
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
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <motion.path
            animate={controls}
            d="M22 21v-2a4 4 0 0 0-3-3.87"
            variants={PATH_VARIANTS}
          />
          <motion.path
            animate={controls}
            d="M16 3.13a4 4 0 0 1 0 7.75"
            variants={PATH_VARIANTS}
          />
        </svg>
      </div>
    );
  },
);

UsersIcon.displayName = "UsersIcon";

export { UsersIcon };
