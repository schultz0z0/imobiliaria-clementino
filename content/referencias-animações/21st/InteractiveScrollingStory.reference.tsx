/**
 * Fonte: 21st.dev — Interactive Scrolling Story Component, ID 6265
 * Autor: minhxthanh
 * URL: https://21st.dev/@minhxthanh/components/interactive-scrolling-story-component
 * Recuperado via MCP em 2026-08-13.
 *
 * O código foi normalizado para TypeScript estrito. A ideia original usa um
 * container com scroll interno; para a Jotapê, preferir a variação sem scroll
 * trap em `../secoes/StickyStorySection.tsx`.
 */
import { useEffect, useRef, useState } from "react";

const slidesData = [
  {
    title: "Diagnóstico",
    description: "Entender o negócio, o público e as oportunidades antes de criar.",
    image: "/media/diagnostico.webp",
    bgColor: "#c6dc20",
    textColor: "#102f20",
  },
  {
    title: "Estratégia",
    description: "Transformar objetivos em posicionamento, mensagem, canais e metas.",
    image: "/media/estrategia.webp",
    bgColor: "#c6dc20",
    textColor: "#102f20",
  },
  {
    title: "Execução",
    description: "Conectar criação, conteúdo, mídia e produção em uma operação única.",
    image: "/media/execucao.webp",
    bgColor: "#c6dc20",
    textColor: "#102f20",
  },
];

export function InteractiveScrollingStoryReference() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollableHeight = container.scrollHeight - window.innerHeight;
      const stepHeight = scrollableHeight / slidesData.length;
      const nextIndex = Math.min(
        slidesData.length - 1,
        Math.floor(container.scrollTop / stepHeight),
      );
      setActiveIndex(nextIndex);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const activeSlide = slidesData[activeIndex];

  return (
    <div
      ref={scrollContainerRef}
      className="h-screen w-full overflow-y-auto"
      style={{ scrollbarWidth: "none" }}
    >
      <div style={{ height: `${slidesData.length * 100}vh` }}>
        <div
          className="sticky top-0 flex h-screen w-full items-center justify-center"
          style={{
            backgroundColor: activeSlide.bgColor,
            color: activeSlide.textColor,
            transition: "background-color 0.7s ease, color 0.7s ease",
          }}
        >
          <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-1 md:grid-cols-2">
            <div className="relative flex flex-col justify-center border-r border-black/10 p-8 md:p-16">
              <div className="absolute left-8 top-12 flex gap-2 md:left-16">
                {slidesData.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    aria-label={`Ir para ${slide.title}`}
                    onClick={() => {
                      const container = scrollContainerRef.current;
                      if (!container) return;
                      const scrollableHeight = container.scrollHeight - window.innerHeight;
                      container.scrollTo({
                        top: (scrollableHeight / slidesData.length) * index,
                        behavior: "smooth",
                      });
                    }}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      index === activeIndex ? "w-12 bg-black/80" : "w-6 bg-black/20"
                    }`}
                  />
                ))}
              </div>

              <div className="relative h-72 w-full">
                {slidesData.map((slide, index) => (
                  <article
                    key={slide.title}
                    className={`absolute inset-0 transition-all duration-700 ${
                      index === activeIndex
                        ? "translate-y-0 opacity-100"
                        : "translate-y-10 opacity-0"
                    }`}
                  >
                    <h2 className="text-5xl font-bold tracking-tighter md:text-6xl">
                      {slide.title}
                    </h2>
                    <p className="mt-6 max-w-md text-lg md:text-xl">{slide.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="hidden items-center justify-center p-8 md:flex">
              <div className="relative h-[80vh] w-1/2 overflow-hidden rounded-2xl shadow-2xl">
                <div
                  className="absolute inset-0 h-full w-full transition-transform duration-700"
                  style={{ transform: `translateY(-${activeIndex * 100}%)` }}
                >
                  {slidesData.map((slide) => (
                    <img
                      key={slide.title}
                      src={slide.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

