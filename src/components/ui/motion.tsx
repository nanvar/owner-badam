"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import * as React from "react";

const easeOut = [0.16, 1, 0.3, 1] as const;

export function FadeIn({
  delay = 0,
  y = 12,
  duration = 0.45,
  className,
  children,
  ...rest
}: {
  delay?: number;
  y?: number;
  duration?: number;
  className?: string;
  children: React.ReactNode;
} & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, ease: easeOut, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerList({
  className,
  stagger = 0.06,
  children,
}: {
  className?: string;
  stagger?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: 0.05 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  className,
  children,
  ...rest
}: { className?: string; children: React.ReactNode } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: easeOut },
        },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function HoverLift({
  className,
  children,
  asChild,
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
  asChild?: boolean;
} & HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.985 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function PressableTr({
  className,
  children,
  onClick,
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
} & HTMLMotionProps<"tr">) {
  return (
    <motion.tr
      className={className}
      onClick={onClick}
      whileTap={{ scale: 0.995 }}
      {...rest}
    >
      {children}
    </motion.tr>
  );
}
