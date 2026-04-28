"use client";

import { animate, useMotionValue, useTransform, motion } from "motion/react";
import { useEffect, useRef } from "react";

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
  // Initialise the motion value to the final value so the SSR HTML matches
  // the client's first render and React doesn't fire a hydration mismatch.
  // After mount we restart from 0 → value to play the count-up animation.
  const mv = useMotionValue(value);
  const hasAnimated = useRef(false);
  const display = useTransform(mv, (v) =>
    format ? format(v) : Math.round(v).toLocaleString(),
  );

  useEffect(() => {
    if (!hasAnimated.current) {
      hasAnimated.current = true;
      mv.set(0);
    }
    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [value, duration, mv]);

  return (
    <motion.span suppressHydrationWarning className={className}>
      {display}
    </motion.span>
  );
}
