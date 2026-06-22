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

export interface FolderCodeIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface FolderCodeIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  externalAnimate?: boolean;
}

const CODE_VARIANTS: Variants = {
  normal: { x: 0, rotate: 0, opacity: 1 },
  animate: (direction: number) => ({
    x: [0, direction * 2, 0],
    rotate: [0, direction * -8, 0],
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeInOut",
    },
  }),
};

const FolderCodeIcon = forwardRef<FolderCodeIconHandle, FolderCodeIconProps>(
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
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
          <motion.path
            animate={controls}
            custom={-1}
            d="M10 10.5 8 13l2 2.5"
            initial="normal"
            variants={CODE_VARIANTS}
          />
          <motion.path
            animate={controls}
            custom={1}
            d="m14 10.5 2 2.5-2 2.5"
            initial="normal"
            variants={CODE_VARIANTS}
          />
        </svg>
      </div>
    );
  },
);

FolderCodeIcon.displayName = "FolderCodeIcon";

export { FolderCodeIcon };
