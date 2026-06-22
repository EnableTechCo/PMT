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

export interface AtomIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface AtomIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  externalAnimate?: boolean;
}

const PATH_VARIANTS: Variants = {
  normal: (custom: number) => ({
    opacity: 1,
    pathLength: 1,
    pathOffset: 0,
    transition: {
      duration: 0.4,
      ease: "easeInOut",
      delay: custom,
    },
  }),
  animate: (custom: number) => ({
    opacity: [0, 1],
    pathLength: [0, 1],
    pathOffset: [1, 0],
    transition: {
      duration: 0.4,
      ease: "easeInOut",
      delay: custom,
    },
  }),
};

const AtomIcon = forwardRef<AtomIconHandle, AtomIconProps>(
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
          <motion.circle
            animate={controls}
            custom={0}
            cx="12"
            cy="12"
            r="1"
            variants={PATH_VARIANTS}
          />
          <motion.path
            animate={controls}
            custom={0.3}
            d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"
            variants={PATH_VARIANTS}
          />
          <motion.path
            animate={controls}
            custom={0.6}
            d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"
            variants={PATH_VARIANTS}
          />
        </svg>
      </div>
    );
  },
);

AtomIcon.displayName = "AtomIcon";

export { AtomIcon };
