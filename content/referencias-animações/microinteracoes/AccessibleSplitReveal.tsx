"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

type AccessibleSplitRevealProps = {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  once?: boolean;
};

export function AccessibleSplitReveal({
  text,
  as: Tag = "h2",
  className,
  once = true,
}: AccessibleSplitRevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once, amount: 0.55 });
  const reduceMotion = useReducedMotion();
  const words = text.split(" ");

  return (
    <Tag ref={ref as never} className={className} aria-label={text}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden="true"
          style={{ display: "inline-block", overflow: "hidden" }}
        >
          <motion.span
            style={{ display: "inline-block", willChange: "transform, opacity" }}
            initial={reduceMotion ? false : { y: "115%", rotate: 2, opacity: 0 }}
            animate={
              inView
                ? { y: "0%", rotate: 0, opacity: 1 }
                : { y: "115%", rotate: 2, opacity: 0 }
            }
            transition={{
              duration: reduceMotion ? 0 : 0.72,
              delay: reduceMotion ? 0 : index * 0.055,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {word}&nbsp;
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

