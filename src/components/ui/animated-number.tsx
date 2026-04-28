"use client";

import { animate } from "motion/react";
import { useEffect, useRef, useState } from "react";

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
  const render = (v: number) =>
    format ? format(v) : Math.round(v).toLocaleString();

  // Server and first client paint render the same final value to keep
  // the hydration HTML in sync. After the first commit we'll restart from
  // 0 → value to play the count-up animation.
  const [display, setDisplay] = useState(() => render(value));
  const ranOnceRef = useRef(false);

  useEffect(() => {
    const startFrom = ranOnceRef.current ? value : 0;
    ranOnceRef.current = true;
    const controls = animate(startFrom, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(render(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <span suppressHydrationWarning className={className}>
      {display}
    </span>
  );
}
