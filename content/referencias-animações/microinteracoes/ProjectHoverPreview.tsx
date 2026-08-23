"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

export type ProjectPreview = {
  title: string;
  category: string;
  image: string;
  href: string;
};

type ProjectHoverPreviewProps = {
  projects: ProjectPreview[];
};

export function ProjectHoverPreview({ projects }: ProjectHoverPreviewProps) {
  const [active, setActive] = useState<number | null>(null);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const reduceMotion = useReducedMotion();

  return (
    <div
      style={{ position: "relative" }}
      onPointerMove={(event) => setPoint({ x: event.clientX, y: event.clientY })}
      onPointerLeave={() => setActive(null)}
    >
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {projects.map((project, index) => (
          <li key={project.href}>
            <motion.a
              href={project.href}
              onHoverStart={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              whileHover={reduceMotion ? undefined : { x: 12 }}
              style={{
                alignItems: "baseline",
                borderTop: "1px solid currentColor",
                color: "inherit",
                display: "flex",
                justifyContent: "space-between",
                padding: "1.5rem 0",
                textDecoration: "none",
              }}
            >
              <span style={{ fontSize: "clamp(2rem, 6vw, 6rem)" }}>
                {project.title}
              </span>
              <span>{project.category}</span>
            </motion.a>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {active !== null && !reduceMotion ? (
          <motion.figure
            key={projects[active].image}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            style={{
              left: point.x + 24,
              margin: 0,
              pointerEvents: "none",
              position: "fixed",
              top: point.y - 140,
              width: "min(28vw, 360px)",
              zIndex: 20,
            }}
          >
            <img
              src={projects[active].image}
              alt=""
              style={{ aspectRatio: "4 / 3", objectFit: "cover", width: "100%" }}
            />
          </motion.figure>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

