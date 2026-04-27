"use client";

import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { useEffect } from "react";

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  trackColor = "rgba(99,102,241,0.15)",
  color = "#6366f1",
  children,
  className,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  trackColor?: string;
  color?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(1, value));

  const mv = useMotionValue(0);
  const offset = useTransform(mv, (v) => c - c * v);

  useEffect(() => {
    const controls = animate(mv, target, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [target, mv]);

  return (
    <div className={`relative inline-flex items-center justify-center ${className ?? ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          style={{ strokeDasharray: c, strokeDashoffset: offset }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
