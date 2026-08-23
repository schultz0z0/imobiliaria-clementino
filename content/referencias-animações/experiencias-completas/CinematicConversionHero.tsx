"use client";

import {
  motion,
  usePageInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useEffect, useRef } from "react";
import { MagneticCta } from "../microinteracoes/MagneticCta";

type CinematicConversionHeroProps = {
  videoSrc: string;
  posterSrc: string;
};

const headline = ["Estratégia", "que move.", "Marketing", "que converte."];

export function CinematicConversionHero({
  videoSrc,
  posterSrc,
}: CinematicConversionHeroProps) {
  const section = useRef<HTMLElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const reduceMotion = useReducedMotion();
  const pageVisible = usePageInView();
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start start", "end start"],
  });
  const mediaY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.78], [1, 0]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;

    if (!reduceMotion && pageVisible) {
      void element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, [pageVisible, reduceMotion]);

  return (
    <section
      ref={section}
      aria-labelledby="hero-title"
      style={{
        background: "#0d2e1f",
        color: "#f4f0e6",
        minHeight: "100svh",
        overflow: "clip",
        position: "relative",
      }}
    >
      <motion.div
        aria-hidden="true"
        style={{
          inset: "-8%",
          position: "absolute",
          scale: reduceMotion ? 1 : mediaScale,
          y: reduceMotion ? 0 : mediaY,
          willChange: "transform",
        }}
      >
        <video
          ref={video}
          src={videoSrc}
          poster={posterSrc}
          muted
          loop
          playsInline
          preload="metadata"
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
        <div
          style={{
            background:
              "linear-gradient(90deg, rgba(6,25,16,.88) 0%, rgba(6,25,16,.58) 48%, rgba(6,25,16,.2) 100%)",
            inset: 0,
            position: "absolute",
          }}
        />
      </motion.div>

      <motion.div
        style={{
          display: "grid",
          minHeight: "100svh",
          opacity: reduceMotion ? 1 : contentOpacity,
          padding: "clamp(1.25rem, 4vw, 4.5rem)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <p style={{ margin: 0 }}>Jotapê Publicidade — Estratégia, criação e performance</p>

        <div style={{ alignSelf: "end", maxWidth: "82rem", paddingBottom: "5vh" }}>
          <h1
            id="hero-title"
            aria-label={headline.join(" ")}
            style={{ fontSize: "clamp(3.5rem, 9vw, 10rem)", lineHeight: 0.82, margin: 0 }}
          >
            {headline.map((line, index) => (
              <span key={line} style={{ display: "block", overflow: "hidden" }}>
                <motion.span
                  aria-hidden="true"
                  initial={reduceMotion ? false : { y: "110%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{
                    delay: reduceMotion ? 0 : 0.08 + index * 0.08,
                    duration: reduceMotion ? 0 : 0.76,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{ display: "block" }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.48, duration: 0.45 }}
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "1.25rem",
              justifyContent: "space-between",
              marginTop: "2.25rem",
            }}
          >
            <p style={{ fontSize: "clamp(1rem, 1.5vw, 1.35rem)", maxWidth: "38rem" }}>
              Estratégia, criatividade e execução conectadas para transformar objetivos de negócio em resultados.
            </p>
            <MagneticCta
              href="#contato"
              className="hero-cta"
            >
              Solicitar diagnóstico <span aria-hidden="true">↗</span>
            </MagneticCta>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

