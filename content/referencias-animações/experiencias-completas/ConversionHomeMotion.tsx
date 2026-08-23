"use client";

import { CinematicConversionHero } from "./CinematicConversionHero";
import { ProjectHoverPreview } from "../microinteracoes/ProjectHoverPreview";
import { MagneticCta } from "../microinteracoes/MagneticCta";
import { ReadingProgressStatement } from "../secoes/ReadingProgressStatement";
import { StickyStorySection } from "../secoes/StickyStorySection";

const cases = [
  {
    title: "Case 01",
    category: "Estratégia + campanha",
    image: "/media/case-01.webp",
    href: "/cases/case-01",
  },
  {
    title: "Case 02",
    category: "Branding + performance",
    image: "/media/case-02.webp",
    href: "/cases/case-02",
  },
  {
    title: "Case 03",
    category: "Conteúdo + mídia",
    image: "/media/case-03.webp",
    href: "/cases/case-03",
  },
];

const method = [
  {
    eyebrow: "01 — Diagnóstico",
    title: "Entender antes de criar.",
    body: "Negócio, público, concorrência e oportunidades formam o ponto de partida.",
    image: "/media/metodo-diagnostico.webp",
  },
  {
    eyebrow: "02 — Estratégia",
    title: "Direção antes de mídia.",
    body: "Posicionamento, mensagem, canais e metas conectados em um plano claro.",
    image: "/media/metodo-estrategia.webp",
  },
  {
    eyebrow: "03 — Execução",
    title: "Criar, ativar, medir.",
    body: "Criação e performance operando juntas, com aprendizado contínuo.",
    image: "/media/metodo-execucao.webp",
  },
];

export function ConversionHomeMotion() {
  return (
    <main style={{ background: "#0d2e1f", color: "#f4f0e6" }}>
      {/* A — Atenção: promessa + CTA acima da dobra. */}
      <CinematicConversionHero
        videoSrc="/media/jotape-reel.mp4"
        posterSrc="/media/jotape-reel-poster.webp"
      />

      {/* Prova imediata: conteúdo essencial deve permanecer estático e escaneável. */}
      <section
        aria-label="Indicadores de confiança"
        style={{
          display: "grid",
          gap: "2rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
          padding: "4rem 5vw",
        }}
      >
        <p><strong>15+</strong><br />anos de experiência</p>
        <p><strong>Nacional</strong><br />e internacional</p>
        <p><strong>360°</strong><br />estratégia à execução</p>
      </section>

      {/* I — Interesse: afirmação que muda a percepção de designer para agência. */}
      <ReadingProgressStatement text="Não fazemos ações isoladas. Construímos estratégias que conectam marca, conteúdo, mídia e resultado." />

      {/* D — Desejo: trabalho real aparece antes da lista de serviços. */}
      <section style={{ padding: "10vh 5vw" }}>
        <p>Cases selecionados</p>
        <ProjectHoverPreview projects={cases} />
      </section>

      {/* Explicação: movimento mostra que as capacidades fazem parte de um sistema. */}
      <StickyStorySection steps={method} />

      {/* A — Ação: fechamento curto, específico e sem distrações. */}
      <section
        id="contato"
        style={{
          alignContent: "center",
          background: "#c6dc20",
          color: "#102f20",
          display: "grid",
          minHeight: "80svh",
          padding: "8vw 5vw",
        }}
      >
        <p>Pronto para transformar marketing em direção?</p>
        <h2 style={{ fontSize: "clamp(3.2rem, 9vw, 10rem)", lineHeight: 0.88 }}>
          Vamos conversar sobre o próximo movimento da sua marca.
        </h2>
        <MagneticCta href="https://wa.me/" className="footer-cta">
          Falar com a Jotapê <span aria-hidden="true">↗</span>
        </MagneticCta>
      </section>
    </main>
  );
}

