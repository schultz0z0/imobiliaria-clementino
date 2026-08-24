import { BadgeCheck, MapPin, MessageCircle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WhatsAppCta } from '../components/contact/WhatsAppCta';
import { Breadcrumbs } from '../components/navigation/Breadcrumbs';
import { PropertyMap } from '../components/properties/PropertyMap';
import { siteConfig } from '../config/siteConfig';
import { getPageMetadata } from '../config/pageMetadata';
import { buildGeneralInquiry, buildWhatsAppUrl } from '../contact/whatsapp';
import { usePageMeta } from '../hooks/usePageMeta';

const fieldClass = 'min-h-12 w-full rounded-[var(--radius-control)] border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition placeholder:text-white/30 focus:border-[#d7b661]';

export const Contact = () => {
  usePageMeta(getPageMetadata('contact'));
  const navigate = useNavigate();
  const directUrl = buildWhatsAppUrl('Olá! Quero falar com a equipe da Imobiliária Clementino.');

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const url = buildGeneralInquiry({ name: String(data.get('name') ?? ''), phone: String(data.get('phone') ?? ''), email: String(data.get('email') ?? ''), subject: String(data.get('subject') ?? ''), message: String(data.get('message') ?? '') });
    window.open(url, '_blank', 'noopener,noreferrer');
    navigate('/contato/mensagem-preparada');
  };

  return (
    <div className="relative z-10 pb-24 pt-36 md:pt-44"><div className="container mx-auto px-6"><Breadcrumbs items={[{ label: 'Início', path: '/' }, { label: 'Contato' }]} /><div className="max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d7b661]">Contato</p><h1 className="mt-5 text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-7xl">O jeito mais rápido de falar com a Clementino é pelo WhatsApp.</h1><p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/55">Tire dúvidas sobre um imóvel, conte o que procura ou converse sobre um serviço imobiliário.</p><WhatsAppCta href={directUrl} label={`Falar agora — ${siteConfig.whatsapp.display}`} className="mt-8" /></div>
      <section aria-label="Como funciona o contato" className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-white/10 md:grid-cols-3">{[['01', 'Preencha os campos', 'Conte sua necessidade com as informações essenciais.'], ['02', 'Revise a mensagem', 'O site organiza o texto sem enviar nada para um servidor.'], ['03', 'Envie no WhatsApp', 'Você confere o conteúdo e decide quando enviar.']].map(([number, title, text]) => <div key={number} className="bg-[#1c1c1f] p-6"><span className="text-xs font-semibold text-[#d7b661]">{number}</span><h2 className="mt-4 text-lg font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-relaxed text-white/45">{text}</p></div>)}</section>
      <div className="mt-20 grid gap-12 lg:grid-cols-[.75fr_1.25fr] lg:gap-20"><aside><h2 className="text-xl font-semibold text-white">Informações verificadas</h2><ul className="mt-7 space-y-6 text-sm text-white/55"><li className="flex gap-3"><MessageCircle className="h-5 w-5 shrink-0 text-[#d7b661]" /><span><strong className="block text-white">WhatsApp</strong>{siteConfig.whatsapp.display}</span></li><li className="flex gap-3"><BadgeCheck className="h-5 w-5 shrink-0 text-[#d7b661]" /><span><strong className="block text-white">Registro profissional</strong>{siteConfig.creci}</span></li><li className="flex gap-3"><MapPin className="h-5 w-5 shrink-0 text-[#d7b661]" /><span><strong className="block text-white">Área de atuação</strong>Rio de Janeiro — RJ</span></li></ul><p className="mt-10 max-w-sm border-l border-white/10 pl-5 text-sm leading-relaxed text-white/40">O formulário não envia dados para um servidor. Ele apenas prepara uma mensagem para você revisar e enviar no WhatsApp.</p></aside>
        <section className="rounded-[var(--radius-surface)] border border-white/10 bg-white/[0.035] p-6 md:p-10"><h2 className="text-2xl font-semibold text-white">Prepare sua mensagem</h2><form onSubmit={submit} data-analytics-event="contact_prepared" className="mt-8 grid gap-5"><div className="grid gap-5 md:grid-cols-2"><label><span className="mb-2 block text-xs text-white/50">Nome completo</span><input required name="name" className={fieldClass} placeholder="Seu nome" /></label><label><span className="mb-2 block text-xs text-white/50">Telefone / WhatsApp</span><input required name="phone" type="tel" className={fieldClass} placeholder="(00) 00000-0000" /></label></div><label><span className="mb-2 block text-xs text-white/50">E-mail</span><input required name="email" type="email" className={fieldClass} placeholder="seu@email.com" /></label><label><span className="mb-2 block text-xs text-white/50">Assunto</span><select required name="subject" className={`${fieldClass} bg-[#222225]`}><option value="">Selecione</option><option>Comprar um imóvel</option><option>Alugar um imóvel</option><option>Vender um imóvel</option><option>Avaliação imobiliária</option><option>Legalização ou administração</option><option>Outro assunto</option></select></label><label><span className="mb-2 block text-xs text-white/50">Mensagem</span><textarea required name="message" rows={5} className={`${fieldClass} py-3`} placeholder="Conte como podemos ajudar" /></label><button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[#d7b661] px-6 font-semibold text-[#18181b] hover:bg-[#c4a350]">Preparar mensagem no WhatsApp <Send className="h-4 w-4" /></button></form></section>
      </div>
      <PropertyMap location={siteConfig.legal.address} eyebrow="Endereço comercial" title="Onde estamos" />
    </div></div>
  );
};
