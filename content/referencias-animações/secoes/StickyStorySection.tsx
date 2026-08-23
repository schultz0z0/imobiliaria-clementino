"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

type StoryStep = {
  eyebrow: string;
  title: string;
  body: string;
  image: string;
};

type StickyStorySectionProps = {
  steps: StoryStep[];
};

function StoryImage({
  step,
  index,
  total,
  progress,
}: {
  step: StoryStep;
  index: number;
  total: number;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const start = index / total;
  const middle = Math.min(1, (index + 0.5) / total);
  const end = Math.min(1, (index + 1) / total);
  const opacity = useTransform(progress, [start, middle, end], [0, 1, index === total - 1 ? 1 : 0]);
  const scale = useTransform(progress, [start, middle], [1.06, 1]);

  return (
    <motion.img
      src={step.image}
      alt=""
      style={{
        inset: 0,
        height: "100%",
        objectFit: "cover",
        opacity,
        position: "absolute",
        scale,
        width: "100%",
        willChange: "transform, opacity",
      }}
    />
  );
}

function StoryCopy({
  step,
  index,
  total,
  progress,
}: {
  step: StoryStep;
  index: number;
  total: number;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const start = index / total;
  const middle = Math.min(1, (index + 0.5) / total);
  const end = Math.min(1, (index + 1) / total);
  const opacity = useTransform(
    progress,
    [start, middle, end],
    [0, 1, index === total - 1 ? 1 : 0],
  );
  const y = useTransform(progress, [start, middle, end], [48, 0, index === total - 1 ? 0 : -48]);

  return (
    <motion.article
      style={{
        alignSelf: "center",
        gridArea: "1 / 1",
        opacity,
        pointerEvents: index === 0 ? "auto" : "none",
        y,
      }}
    >
      <p>{step.eyebrow}</p>
      <h2 style={{ fontSize: "clamp(2.8rem, 7vw, 7rem)", lineHeight: 0.92 }}>
        {step.title}
      </h2>
      <p style={{ fontSize: "clamp(1rem, 1.5vw, 1.35rem)", maxWidth: "38rem" }}>
        {step.body}
      </p>
      <span aria-hidden="true">
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
    </motion.article>
  );
}

export function StickyStorySection({ steps }: StickyStorySectionProps) {
  const section = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start start", "end end"],
  });

  return (
    <section
      ref={section}
      style={{ minHeight: `${Math.max(steps.length, 1) * 100}vh`, position: "relative" }}
    >
      <div
        style={{
          display: "grid",
          gap: "clamp(2rem, 6vw, 8rem)",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 28rem), 1fr))",
          minHeight: "100vh",
          padding: "clamp(2rem, 6vw, 7rem)",
          position: "sticky",
          top: 0,
        }}
      >
        <div style={{ alignSelf: "center", display: "grid" }}>
          {steps.map((step, index) => (
            <StoryCopy
              key={step.title}
              step={step}
              index={index}
              total={steps.length}
              progress={scrollYProgress}
            />
          ))}
        </div>

        <div style={{ alignSelf: "center", aspectRatio: "4 / 5", overflow: "hidden", position: "relative" }}>
          {steps.map((step, index) => (
            <StoryImage
              key={step.image}
              step={step}
              index={index}
              total={steps.length}
              progress={scrollYProgress}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
