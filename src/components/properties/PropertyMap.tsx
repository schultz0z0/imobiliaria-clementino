import { ArrowUpRight, MapPinned, ShieldCheck } from 'lucide-react';
import { useCookieConsent } from '../../privacy/CookieConsentContext';

interface PropertyMapProps {
  location: string;
  eyebrow?: string;
  title?: string;
}

export const PropertyMap = ({ location, eyebrow = 'Localização', title = 'Conheça a região' }: PropertyMapProps) => {
  const { accepts, enableCategory } = useCookieConsent();
  const canEmbedMap = accepts('functionality');
  const encodedLocation = encodeURIComponent(location);
  const embedUrl = `https://maps.google.com/maps?q=${encodedLocation}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;

  return (
    <section className="mt-20 border-t border-white/10 pt-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d7b661]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold text-white">{title}</h2>

      <div className="mt-7 overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-[#202023]">
        <div className="h-[320px] bg-[#202023] md:h-[400px]">
          {canEmbedMap ? (
            <iframe
              title={`Mapa de ${location}`}
              src={embedUrl}
              width="100%"
              height="100%"
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(215,182,97,0.08),transparent_62%)] px-6 text-center">
              <div className="max-w-md">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d7b661]/25 bg-[#d7b661]/10"><ShieldCheck className="h-6 w-6 text-[#d7b661]" aria-hidden="true" /></span>
                <h3 className="mt-5 text-xl font-semibold text-white">Mapa protegido por suas preferências</h3>
                <p className="mt-3 text-sm leading-6 text-white/50">O Google Maps só é carregado quando você permite recursos nas preferências de funcionalidade.</p>
                <button type="button" onClick={() => enableCategory('functionality')} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-[#d7b661] px-5 text-sm font-semibold text-[#18181b] transition hover:bg-[#c4a350]">Ativar mapa</button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 border-t border-white/10 bg-[#18181b] p-5 md:flex-row md:items-center md:justify-between md:px-7">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[#d7b661]/25 bg-[#d7b661]/10">
              <MapPinned className="h-5 w-5 text-[#d7b661]" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">Endereço informado</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-white md:text-base">{location}</p>
            </div>
          </div>

          <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[#d7b661] px-6 text-sm font-semibold text-[#18181b] transition hover:bg-[#c4a350]">
            Abrir no Google Maps <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
};
