import type { CSSProperties } from "react";
import "./marquee-cta.css";

type MarqueeCtaProps = {
  href: string;
  label: string;
  className?: string;
  repeats?: number;
};

export function MarqueeCta({
  href,
  label,
  className = "",
  repeats = 5,
}: MarqueeCtaProps) {
  const items = Array.from({ length: repeats }, (_, index) => (
    <span key={index} aria-hidden="true">
      {label} <span className="marquee-cta__arrow">↗</span>
    </span>
  ));

  return (
    <a className={`marquee-cta ${className}`} href={href} aria-label={label}>
      <span className="marquee-cta__label">{label} ↗</span>
      <span
        className="marquee-cta__track"
        style={{ "--copies": repeats } as CSSProperties}
      >
        {items}
        {items}
      </span>
    </a>
  );
}

