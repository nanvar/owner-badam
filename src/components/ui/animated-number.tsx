"use client";

import { animate, useMotionValue, useTransform, motion } from "motion/react";
import { useEffect } from "react";

export function AnimatedNumber({
  value,
  format,
  duration = 1.1,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) =>
    format ? format(v) : Math.round(v).toLocaleString(),
  );

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [value, duration, mv]);

  return <motion.span className={className}>{display}</motion.span>;
}
