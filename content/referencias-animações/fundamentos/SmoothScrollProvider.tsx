"use client";

import type { PropsWithChildren } from "react";
import { ReactLenis } from "lenis/react";

export function SmoothScrollProvider({ children }: PropsWithChildren) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.09,
        duration: 1.05,
        smoothWheel: true,
        syncTouch: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}

