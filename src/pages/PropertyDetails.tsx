import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPropertyBySlug, getRelatedProperties } from '../catalog/propertyCatalog';
import { WhatsAppCta } from '../components/contact/WhatsAppCta';
import { PropertyCard } from '../components/properties/PropertyCard';
import { PropertyFacts } from '../components/properties/PropertyFacts';
import { PropertyGallery } from '../components/properties/PropertyGallery';
import { PropertyMap } from '../components/properties/PropertyMap';
import { buildPropertyInquiry, buildVisitInquiry } from '../contact/whatsapp';
import { getPageMetadata } from '../config/pageMetadata';
import { usePageMeta } from '../hooks/usePageMeta';

export const PropertyDetails = () => {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const property = getPropertyBySlug(slug);
  usePageMeta(getPageMetadata('property', property));
  const [modalOpen, setModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!property) {
    return <div className="relative z-10 flex min-h-screen items-center justify-center px-6 pt-24 text-center"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d7b661]">Catálogo Clementino</p><h1 className="mt-4 text-4xl font-semibold text-white">Imóvel não encontrado.</h1><p className="mt-4 text-white/50">O endereço pode ter mudado ou o imóvel não está mais no catálogo.</p><Link to="/imoveis" className="mt-8 inline-flex min-h-12 items-center rounded-[var(--radius-control)] bg-[#d7b661] px-6 font-semibold text-[#18181b]">Voltar aos imóveis</Link></div></div>;
  }

  const whatsappUrl = buildPropertyInquiry(property, window.location.origin);
  const related = getRelatedProperties(property, 3);

  const submitVisit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const url = buildVisitInquiry({ reference: property.reference, slug: property.slug, title: property.title, name: String(data.get('name') ?? ''), phone: String(data.get('phone') ?? ''), email: String(data.get('email') ?? ''), date: String(data.get('date') ?? ''), period: String(data.get('period') ?? '') }, window.location.origin);
    window.open(url, '_blank', 'noopener,noreferrer');
    setSubmitted(true);
  };

  return (
    <div className="relative z-10 pb-32 pt-28 lg:pb-24 lg:pt-32">
      <div className="container mx-auto px-6">
        <nav aria-label="Breadcrumb" className="mb-7 flex min-w-0 items-center gap-3 text-sm text-white/40"><button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 hover:text-[#d7b661]"><ArrowLeft className="h-4 w-4" />Voltar</button><span>/</span><Link to="/imoveis" className="hover:text-[#d7b661]">Imóveis</Link><span>/</span><span className="truncate text-white/60">Ref. {property.reference}</span></nav>

        <PropertyGallery images={property.images} title={property.title} />

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main>
            <div className="flex flex-wrap items-center gap-3"><span className="rounded-[var(--radius-compact)] border border-[#d7b661]/30 bg-[#d7b661]/10 px-3 py-1 text-xs font-semibold text-[#d7b661]">{property.type}</span><span className="text-xs uppercase tracking-[0.18em] text-white/35">Ref. {property.reference}</span></div>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">{property.title}</h1>
            <p className="mt-5 flex items-start gap-2 text-base text-white/55"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#d7b661]" />{property.location}</p>
            <div className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-2"><strong className="text-4xl font-semibold text-[#d7b661]">{property.price}</strong>{property.condoPrice > 0 && <span className="pb-1 text-sm text-white/45">Condomínio: {property.condoPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}</div>
            <div className="mt-9"><PropertyFacts property={property} /></div>

            <section className="mt-14"><h2 className="text-2xl font-semibold text-white">Sobre o imóvel</h2><p className="mt-5 whitespace-pre-line text-base leading-8 text-white/60">{property.desc}</p></section>
            {property.features.length > 0 && <section className="mt-14"><h2 className="text-2xl font-semibold text-white">Características</h2><ul className="mt-6 grid gap-3 sm:grid-cols-2">{property.features.map((feature) => <li key={feature} className="flex items-center gap-3 rounded-[var(--radius-control)] border border-white/8 bg-white/[0.025] px-4 py-3 text-sm text-white/60"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#d7b661]" />{feature}</li>)}</ul></section>}
          </main>

          <aside className="hidden lg:block"><div className="sticky top-28 rounded-[var(--radius-surface)] border border-[#d7b661]/25 bg-white/[0.04] p-7"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d7b661]">Atendimento direto</p><h2 className="mt-4 text-2xl font-semibold text-white">Quer saber mais sobre este imóvel?</h2><p className="mt-3 text-sm leading-relaxed text-white/50">Fale com a equipe Clementino ou prepare uma solicitação de visita.</p><div className="mt-7 grid gap-3"><WhatsAppCta href={whatsappUrl} label="Falar sobre este imóvel" className="w-full" /><button type="button" onClick={() => setModalOpen(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-white/15 text-sm font-semibold text-white hover:border-[#d7b661]/60"><CalendarDays className="h-4 w-4 text-[#d7b661]" />Agendar visita</button></div></div></aside>
        </div>

        <PropertyMap location={property.location} />

        <section className="mt-24 border-t border-white/10 pt-16"><div className="flex items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d7b661]">Outras opções</p><h2 className="mt-3 text-3xl font-semibold text-white">Imóveis relacionados</h2></div><Link to="/imoveis" className="text-sm font-semibold text-[#d7b661]">Ver catálogo</Link></div><div className="mt-9 grid gap-7 md:grid-cols-2 xl:grid-cols-3">{related.map((item) => <PropertyCard key={item.id} property={item} />)}</div></section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-white/10 bg-[#18181b]/96 p-4 backdrop-blur-xl lg:hidden"><WhatsAppCta href={whatsappUrl} label="WhatsApp" className="flex-1 px-3" /><button type="button" onClick={() => setModalOpen(true)} className="flex-1 rounded-[var(--radius-control)] border border-white/15 text-sm font-semibold text-white"><CalendarDays className="mr-2 inline h-4 w-4 text-[#d7b661]" />Agendar</button></div>

      <AnimatePresence>{modalOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-surface)] border border-white/10 bg-[#18181b] p-7"><button type="button" onClick={() => { setModalOpen(false); setSubmitted(false); }} aria-label="Fechar" className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-white/10"><X /></button>{submitted ? <div className="py-12 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-[#d7b661]" /><h2 className="mt-5 text-2xl font-semibold text-white">WhatsApp aberto</h2><p className="mt-3 text-white/50">Envie a mensagem para confirmar sua solicitação.</p></div> : <><h2 className="pr-12 text-2xl font-semibold text-white">Solicitar uma visita</h2><p className="mt-3 text-sm text-white/50">Os dados abaixo serão usados somente para preparar sua mensagem no WhatsApp.</p><form onSubmit={submitVisit} className="mt-7 grid gap-4">{[['name','Nome completo','text'],['phone','Telefone / WhatsApp','tel'],['email','E-mail','email'],['date','Data desejada','date']].map(([name,label,type]) => <label key={name} className="block"><span className="mb-2 block text-xs text-white/50">{label}</span><input required name={name} type={type} className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-[#d7b661]" /></label>)}<label><span className="mb-2 block text-xs text-white/50">Período</span><select required name="period" className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/10 bg-[#222225] px-4 text-white outline-none focus:border-[#d7b661]"><option value="">Selecione</option><option value="manhã">Manhã</option><option value="tarde">Tarde</option></select></label><button type="submit" className="mt-2 min-h-12 rounded-[var(--radius-control)] bg-[#d7b661] font-semibold text-[#18181b]">Preparar mensagem no WhatsApp</button></form></>}</motion.div></div>}</AnimatePresence>
    </div>
  );
};
