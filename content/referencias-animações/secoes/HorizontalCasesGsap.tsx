"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type HorizontalCase = {
  title: string;
  result: string;
  image: string;
};

export function HorizontalCasesGsap({ cases }: { cases: HorizontalCase[] }) {
  const section = useRef<HTMLElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          desktop: "(min-width: 900px)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { desktop, reduceMotion } = context.conditions as {
            desktop: boolean;
            reduceMotion: boolean;
          };

          if (!desktop || reduceMotion || !track.current) return;

          const distance = () => Math.max(0, track.current!.scrollWidth - window.innerWidth);

          gsap.to(track.current, {
            x: () => -distance(),
            ease: "none",
            scrollTrigger: {
              trigger: section.current,
              start: "top top",
              end: () => `+=${distance()}`,
              scrub: 0.8,
              pin: true,
              invalidateOnRefresh: true,
              anticipatePin: 1,
            },
          });
        },
      );

      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <section ref={section} aria-label="Cases selecionados" style={{ overflow: "hidden" }}>
      <div
        ref={track}
        style={{
          display: "flex",
          gap: "clamp(1rem, 3vw, 3rem)",
          minHeight: "100vh",
          padding: "clamp(2rem, 5vw, 6rem)",
          width: "max-content",
        }}
      >
        {cases.map((item, index) => (
          <article
            key={item.title}
            style={{
              alignSelf: "center",
              display: "grid",
              gridTemplateRows: "1fr auto",
              minHeight: "70vh",
              width: "min(78vw, 64rem)",
            }}
          >
            <img
              src={item.image}
              alt=""
              loading={index === 0 ? "eager" : "lazy"}
              style={{ height: "100%", objectFit: "cover", width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: "2rem" }}>
              <h2>{item.title}</h2>
              <p>{item.result}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

