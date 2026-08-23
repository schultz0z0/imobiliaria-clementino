"use client";

import {
  motion,
  usePageInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useEffect, useRef } from "react";

type VideoMaskOnScrollProps = {
  src: string;
  poster: string;
  title: string;
};

export function VideoMaskOnScroll({ src, poster, title }: VideoMaskOnScrollProps) {
  const section = useRef<HTMLElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const reduceMotion = useReducedMotion();
  const pageVisible = usePageInView();
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start end", "center center"],
  });
  const radius = useTransform(scrollYProgress, [0, 1], ["48px", "0px"]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.72, 1]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;

    if (pageVisible && !reduceMotion) {
      void element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, [pageVisible, reduceMotion]);

  return (
    <section ref={section} style={{ minHeight: "130vh", padding: "10vh 0" }}>
      <motion.div
        style={{
          borderRadius: reduceMotion ? 0 : radius,
          height: "80vh",
          overflow: "hidden",
          scale: reduceMotion ? 1 : scale,
          position: "sticky",
          top: "10vh",
          willChange: "transform, border-radius",
        }}
      >
        <video
          ref={video}
          aria-label={title}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="metadata"
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
        <div style={{ inset: 0, padding: "6vw", position: "absolute" }}>
          <h2 style={{ color: "white", fontSize: "clamp(3rem, 9vw, 9rem)" }}>{title}</h2>
        </div>
      </motion.div>
    </section>
  );
}

