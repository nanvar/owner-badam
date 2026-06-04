"use client";

// Subtle fade+lift wrap applied to every owner page via the layout.
// Re-mounts on pathname change so navigations get a clean entry
// animation without each page needing its own FadeIn boilerplate.

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

const easeOut = [0.16, 1, 0.3, 1] as const;

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.3, ease: easeOut }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
