"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

function ProgressWord({
  children,
  index,
  total,
  progress,
}: {
  children: string;
  index: number;
  total: number;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const start = index / total;
  const end = Math.min(1, start + 1.8 / total);
  const opacity = useTransform(progress, [start, end], [0.18, 1]);

  return (
    <motion.span aria-hidden="true" style={{ opacity }}>
      {children}{" "}
    </motion.span>
  );
}

export function ReadingProgressStatement({ text }: { text: string }) {
  const section = useRef<HTMLElement | null>(null);
  const words = text.split(" ");
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start 75%", "end 35%"],
  });

  return (
    <section ref={section} aria-label={text} style={{ padding: "18vh 5vw" }}>
      <p style={{ fontSize: "clamp(2.5rem, 7vw, 7.5rem)", lineHeight: 0.98, margin: 0 }}>
        {words.map((word, index) => (
          <ProgressWord
            key={`${word}-${index}`}
            index={index}
            total={words.length}
            progress={scrollYProgress}
          >
            {word}
          </ProgressWord>
        ))}
      </p>
    </section>
  );
}

