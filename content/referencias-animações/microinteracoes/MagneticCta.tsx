"use client";

import type { PointerEvent, PropsWithChildren } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";

type MagneticCtaProps = PropsWithChildren<{
  href: string;
  className?: string;
  strength?: number;
}>;

export function MagneticCta({
  href,
  children,
  className,
  strength = 0.22,
}: MagneticCtaProps) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 260, damping: 18, mass: 0.35 });
  const y = useSpring(rawY, { stiffness: 260, damping: 18, mass: 0.35 });
  const reduceMotion = useReducedMotion();

  function handleMove(event: PointerEvent<HTMLAnchorElement>) {
    if (reduceMotion || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    rawX.set((event.clientX - rect.left - rect.width / 2) * strength);
    rawY.set((event.clientY - rect.top - rect.height / 2) * strength);
  }

  function reset() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <motion.a
      href={href}
      className={className}
      style={{ x, y, display: "inline-flex", willChange: "transform" }}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      onBlur={reset}
      whileHover={reduceMotion ? undefined : { scale: 1.035 }}
      whileTap={{ scale: 0.98 }}
      whileFocus={{ outlineOffset: 6 }}
    >
      {children}
    </motion.a>
  );
}

