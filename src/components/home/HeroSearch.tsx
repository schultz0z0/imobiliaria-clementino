import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { filterProperties } from '../../catalog/propertyCatalog';
import { buildWhatsAppUrl } from '../../contact/whatsapp';

export const HeroSearch = () => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  const suggestions = query.trim().length > 1 ? filterProperties({ query }).slice(0, 4) : [];
  const whatsappUrl = buildWhatsAppUrl('Olá! Quero ajuda para encontrar um imóvel.');

  const submit = () => navigate(query.trim() ? `/imoveis?q=${encodeURIComponent(query.trim())}` : '/imoveis');

  return (
    <section className="relative z-20 flex min-h-[760px] items-center pt-24 md:min-h-[820px]">
      <div className="absolute inset-0 overflow-hidden">
        <motion.div initial={{ scale: 1.02 }} animate={{ scale: 1.06 }} transition={{ duration: 18, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }} className="h-full w-full">
          <picture className="block h-full w-full">
            <source media="(max-width: 639px)" srcSet="/images/brand/hero-clementino-mobile.webp?v=20260901" />
            <img src="/images/brand/hero-clementino-desktop-v2.webp?v=20260901" alt="" fetchPriority="high" className="h-full w-full object-cover" />
          </picture>
        </motion.div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,17,19,.58)_0%,rgba(17,17,19,.7)_48%,rgba(17,17,19,.28)_100%)] sm:hidden" />
      </div>

      <div className="container relative z-10 mx-auto px-6 py-24">
        <div className="max-w-4xl">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#d7b661]">Imobiliária no Rio de Janeiro desde 2010</p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.04] tracking-[-0.035em] text-white sm:text-6xl md:text-7xl lg:text-[5.25rem]">
            Seu próximo imóvel começa com uma <span className="font-light italic text-[#d7b661]">busca mais simples.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/68 md:text-xl">Encontre imóveis reais para comprar ou alugar e fale diretamente com a equipe Clementino.</p>

          <div className="relative mt-10 max-w-3xl">
            <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-white/15 bg-[#18181b]/80 p-2 shadow-2xl backdrop-blur-xl sm:flex-row">
              <label className="flex min-h-14 flex-1 items-center gap-3 px-4" aria-label="Buscar imóveis">
                <Search className="h-5 w-5 shrink-0 text-[#d7b661]" aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 160)} placeholder="Busque por bairro, cidade ou referência" className="w-full bg-transparent text-white outline-none placeholder:text-white/40" />
              </label>
              <button type="submit" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[#d7b661] px-7 font-semibold text-[#18181b] transition-colors hover:bg-[#c4a350]">Buscar imóveis <ArrowRight className="h-4 w-4" /></button>
            </form>

            <AnimatePresence>
              {focused && suggestions.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute inset-x-0 top-full z-20 mt-3 overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-[#18181b]/98 p-2 shadow-2xl backdrop-blur-xl">
                  {suggestions.map((property) => (
                    <Link key={property.id} to={`/imoveis/${property.slug}`} className="flex items-center gap-4 rounded-[var(--radius-control)] p-3 transition-colors hover:bg-white/5">
                      <img src={property.image} alt="" className="h-14 w-16 rounded-[var(--radius-control)] object-cover" />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{property.title}</p><p className="mt-1 flex items-center gap-1 text-xs text-white/45"><MapPin className="h-3 w-3" />{property.district}, {property.city}</p></div>
                      <span className="hidden text-sm font-semibold text-[#d7b661] sm:block">{property.price}</span>
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <Link to="/imoveis?purpose=Venda" className="inline-flex min-h-11 items-center text-white/65 transition-colors hover:text-[#d7b661]">Comprar</Link>
            <Link to="/imoveis?purpose=Aluguel" className="inline-flex min-h-11 items-center text-white/65 transition-colors hover:text-[#d7b661]">Alugar</Link>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[#d7b661] transition-colors hover:text-white">Falar no WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
  );
};
