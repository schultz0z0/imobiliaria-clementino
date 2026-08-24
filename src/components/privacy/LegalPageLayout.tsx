import type { ReactNode } from 'react';
import type { LegalSection } from '../../privacy/legalContent';
import { Breadcrumbs } from '../navigation/Breadcrumbs';

interface LegalPageLayoutProps {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
  children?: ReactNode;
  sectionExtras?: Partial<Record<string, ReactNode>>;
}

export const LegalPageLayout = ({
  eyebrow,
  title,
  intro,
  lastUpdated,
  sections,
  children,
  sectionExtras = {},
}: LegalPageLayoutProps) => (
  <div className="relative z-10 pb-24 pt-36 md:pt-44">
    <div className="container mx-auto px-6">
      <Breadcrumbs items={[{ label: 'Início', path: '/' }, { label: title }]} />
      <header className="max-w-4xl border-b border-white/10 pb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d7b661]">{eyebrow}</p>
        <h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">{title}</h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-white/58">{intro}</p>
        <p className="mt-6 text-xs uppercase tracking-[0.16em] text-white/35">Última atualização: {lastUpdated}</p>
      </header>

      {children ? <div className="mt-10">{children}</div> : null}

      <div className="mt-14 grid gap-12 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-20">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">Nesta página</p>
          <nav aria-label={`Índice de ${title}`} className="mt-5 border-l border-white/10">
            {sections.map(({ id, title: sectionTitle }) => (
              <a key={id} href={`#${id}`} className="block border-l border-transparent py-2.5 pl-4 text-sm leading-5 text-white/48 transition hover:border-[#d7b661] hover:text-[#e3c876]">{sectionTitle.replace(/^\d+\.\s*/, '')}</a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-4xl">
          {sections.map(({ id, title: sectionTitle, paragraphs, bullets }) => (
            <section key={id} id={id} className="scroll-mt-32 border-b border-white/10 py-10 first:pt-0 last:border-b-0">
              <h2 className="text-2xl font-semibold text-white md:text-3xl">{sectionTitle}</h2>
              <div className="mt-5 space-y-4 text-base leading-8 text-white/58">
                {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {bullets ? <ul className="space-y-3 pl-1">{bullets.map((bullet) => <li key={bullet} className="flex gap-3"><span className="mt-[0.72rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#d7b661]" aria-hidden="true" /><span>{bullet}</span></li>)}</ul> : null}
              </div>
              {sectionExtras[id] ?? null}
            </section>
          ))}
        </article>
      </div>
    </div>
  </div>
);
