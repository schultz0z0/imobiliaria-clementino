"use client";

import type { PropsWithChildren } from "react";
import { MotionConfig } from "motion/react";

export function MotionProvider({ children }: PropsWithChildren) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionConfig>
  );
}

