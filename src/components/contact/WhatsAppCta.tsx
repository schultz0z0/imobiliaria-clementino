import { MessageCircle } from 'lucide-react';

interface WhatsAppCtaProps {
  href: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'text';
  className?: string;
}

const variants = {
  primary: 'bg-[#d7b661] text-[#18181b] hover:bg-[#c4a350] shadow-[0_14px_40px_rgba(215,182,97,0.18)]',
  secondary: 'border border-white/15 bg-white/[0.04] text-white hover:border-[#d7b661]/60 hover:bg-white/[0.08]',
  text: 'text-[#d7b661] hover:text-white',
};

export const WhatsAppCta = ({ href, label, variant = 'primary', className = '' }: WhatsAppCtaProps) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] px-6 py-3 text-sm font-semibold transition-colors ${variants[variant]} ${className}`}
  >
    <MessageCircle className="h-4 w-4" aria-hidden="true" />
    {label}
  </a>
);
