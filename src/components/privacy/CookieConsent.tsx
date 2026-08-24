import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Cookie, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { useCookieConsent } from '../../privacy/CookieConsentContext';
import type { OptionalConsentCategory } from '../../privacy/consent';

type OptionalPreferences = Record<OptionalConsentCategory, boolean>;

interface CookieBannerProps {
  hidden?: boolean;
  onAcceptAll: () => void;
  onRejectNonEssential: () => void;
  onOpenPreferences: () => void;
}

const secondaryButton = 'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-white/15 px-5 text-sm font-semibold text-white transition hover:border-[#d7b661]/55 hover:text-[#e3c876]';
const primaryButton = 'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-[#d7b661] px-5 text-sm font-semibold text-[#18181b] transition hover:bg-[#c4a350]';

export const CookieBanner = ({ hidden = false, onAcceptAll, onRejectNonEssential, onOpenPreferences }: CookieBannerProps) => (
  <section
    hidden={hidden}
    aria-label="Aviso de cookies"
    className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-6xl rounded-[var(--radius-surface)] border border-[#d7b661]/25 bg-[#18181b]/[0.98] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl md:inset-x-6 md:bottom-6 md:p-6"
  >
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex max-w-2xl items-start gap-4">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d7b661]/10">
          <Cookie className="h-5 w-5 text-[#d7b661]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold text-white">Sua privacidade importa</h2>
          <p className="mt-1.5 text-sm leading-6 text-white/60">
            Usamos cookies para garantir o funcionamento do site e melhorar sua experiência. Saiba mais na{' '}
            <a href="/politica-de-cookies" className="font-medium text-[#e3c876] underline decoration-[#d7b661]/40 underline-offset-4">Política de Cookies</a>{' '}
            e no <a href="/aviso-de-privacidade" className="font-medium text-[#e3c876] underline decoration-[#d7b661]/40 underline-offset-4">Aviso de Privacidade</a>.
          </p>
        </div>
      </div>
      <div className="grid shrink-0 gap-2 sm:grid-cols-3 lg:flex">
        <button type="button" onClick={onOpenPreferences} className={secondaryButton}>Preferências</button>
        <button type="button" onClick={onRejectNonEssential} className={secondaryButton}>Rejeitar não essenciais</button>
        <button type="button" onClick={onAcceptAll} className={primaryButton}>Aceitar todos</button>
      </div>
    </div>
  </section>
);

interface CookiePreferencesDialogProps {
  preferences: OptionalPreferences;
  onChange: (category: OptionalConsentCategory, enabled: boolean) => void;
  onAcceptAll: () => void;
  onRejectNonEssential: () => void;
  onSave: () => void;
  onClose: () => void;
  showDiscardWarning?: boolean;
  onDiscardChanges?: () => void;
}

const categories = [
  {
    key: 'functionality',
    title: 'Cookies de funcionalidade',
    description: 'Permitem recursos externos opcionais, como a visualização incorporada do Google Maps nas páginas dos imóveis.',
  },
  {
    key: 'analytics',
    title: 'Cookies de análise e desempenho',
    description: 'Poderão medir visitas e uso do site quando o Google Analytics for instalado. Atualmente essa medição não está ativa.',
  },
  {
    key: 'advertising',
    title: 'Cookies de publicidade',
    description: 'Poderão apoiar campanhas e conversões no Google Ads e Meta. Atualmente nenhum rastreador publicitário está ativo.',
  },
] as const;

const Toggle = ({ name, label, checked, disabled = false, onChange }: {
  name: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) => (
  <label className="relative inline-flex h-7 w-12 shrink-0 items-center">
    <span className="sr-only">{checked ? 'Ativado' : 'Desativado'}</span>
    <input name={name} type="checkbox" aria-label={label} disabled={disabled} checked={checked} onChange={onChange} className="peer sr-only" />
    <span className="absolute inset-0 rounded-full border border-white/15 bg-white/10 transition peer-checked:border-[#d7b661] peer-checked:bg-[#d7b661] peer-focus-visible:ring-2 peer-focus-visible:ring-[#d7b661] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#202023] peer-disabled:cursor-not-allowed peer-disabled:opacity-70" />
    <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 peer-checked:bg-[#18181b]" />
  </label>
);

export const CookiePreferencesDialog = ({
  preferences,
  onChange,
  onAcceptAll,
  onRejectNonEssential,
  onSave,
  onClose,
  showDiscardWarning = false,
  onDiscardChanges,
}: CookiePreferencesDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]') ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cookie-preferences-title" onKeyDown={trapFocus} className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#202023] shadow-2xl sm:rounded-[var(--radius-surface)]">
        <header className="flex items-start justify-between gap-5 border-b border-white/10 px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="h-5 w-5 text-[#d7b661]" aria-hidden="true" />
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7b661]">Privacidade</p><h2 id="cookie-preferences-title" className="mt-1 text-xl font-semibold text-white">Preferências de cookies</h2></div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Fechar preferências" className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          <p className="text-sm leading-6 text-white/60">Escolha quais recursos opcionais podem ser utilizados. Você poderá alterar esta decisão a qualquer momento no rodapé do site.</p>
          <div className="mt-5 space-y-3">
            <div className="rounded-[var(--radius-control)] border border-[#d7b661]/20 bg-[#d7b661]/[0.055] p-4">
              <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-[#d7b661]" /><h3 className="font-semibold text-white">Cookies estritamente necessários</h3></div><Toggle name="necessary" label="Cookies estritamente necessários" disabled checked /></div>
              <p className="mt-3 pr-12 text-sm leading-6 text-white/50">Mantêm as preferências de privacidade e funções indispensáveis à navegação. Estão sempre ativos.</p>
            </div>
            {categories.map(({ key, title, description }) => (
              <div key={key} className="rounded-[var(--radius-control)] border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-4"><h3 className="font-semibold text-white">{title}</h3><Toggle name={key} label={title} checked={preferences[key]} onChange={(event) => onChange(key, event.target.checked)} /></div>
                <p className="mt-3 pr-12 text-sm leading-6 text-white/50">{description}</p>
              </div>
            ))}
          </div>
          {showDiscardWarning ? (
            <div role="alert" className="mt-5 rounded-[var(--radius-control)] border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
              <p>Você alterou suas preferências. Salve a escolha ou descarte as alterações antes de fechar.</p>
              <button type="button" onClick={onDiscardChanges} className="mt-3 font-semibold text-[#e3c876] underline underline-offset-4">Descartar alterações</button>
            </div>
          ) : null}
          <p className="mt-5 text-xs leading-5 text-white/40">Veja os detalhes na <a href="/politica-de-cookies" className="text-[#e3c876] underline underline-offset-4">Política de Cookies</a>.</p>
        </div>

        <footer className="grid gap-2 border-t border-white/10 bg-[#18181b] p-5 sm:grid-cols-3 sm:px-7">
          <button type="button" onClick={onRejectNonEssential} className={secondaryButton}>Rejeitar não essenciais</button>
          <button type="button" onClick={onAcceptAll} className={secondaryButton}>Aceitar todos</button>
          <button type="button" onClick={onSave} className={primaryButton}>Salvar preferências</button>
        </footer>
      </div>
    </div>
  );
};

export const CookieConsent = () => {
  const {
    hasDecision,
    preferencesOpen,
    optionalPreferences,
    acceptAll,
    rejectNonEssential,
    savePreferences,
    openPreferences,
    closePreferences,
  } = useCookieConsent();
  const [draft, setDraft] = useState<OptionalPreferences>(optionalPreferences);
  const [showDiscardWarning, setShowDiscardWarning] = useState(false);

  useEffect(() => {
    if (preferencesOpen) {
      setDraft(optionalPreferences);
      setShowDiscardWarning(false);
    }
  }, [optionalPreferences, preferencesOpen]);

  const hasUnsavedChanges = draft.functionality !== optionalPreferences.functionality
    || draft.analytics !== optionalPreferences.analytics
    || draft.advertising !== optionalPreferences.advertising;

  const requestClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardWarning(true);
      return;
    }
    closePreferences();
  };

  return (
    <>
      {!hasDecision ? <CookieBanner hidden={preferencesOpen} onAcceptAll={acceptAll} onRejectNonEssential={rejectNonEssential} onOpenPreferences={openPreferences} /> : null}
      {preferencesOpen ? (
        <CookiePreferencesDialog
          preferences={draft}
          onChange={(category, enabled) => {
            setShowDiscardWarning(false);
            setDraft((current) => ({ ...current, [category]: enabled }));
          }}
          onAcceptAll={acceptAll}
          onRejectNonEssential={rejectNonEssential}
          onSave={() => savePreferences(draft)}
          onClose={requestClose}
          showDiscardWarning={showDiscardWarning}
          onDiscardChanges={() => {
            setDraft(optionalPreferences);
            setShowDiscardWarning(false);
            closePreferences();
          }}
        />
      ) : null}
    </>
  );
};
