import { AnimatePresence, motion } from 'motion/react';
import { Building2, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { buildWhatsAppUrl } from '../contact/whatsapp';
import { WhatsAppCta } from './contact/WhatsAppCta';

const navLinks = [
  { path: '/', label: 'Início', end: true },
  { path: '/imoveis', label: 'Imóveis' },
  { path: '/servicos', label: 'Serviços' },
  { path: '/sobre', label: 'Sobre' },
  { path: '/contato', label: 'Contato' },
];

const preloadProperties = () => {
  import('../pages/Properties');
};

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const whatsappUrl = buildWhatsAppUrl('Olá! Quero falar com a equipe da Imobiliária Clementino.');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname, location.search]);

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'glass-nav py-3' : 'bg-gradient-to-b from-black/55 to-transparent py-5'}`}
      aria-label="Navegação principal"
    >
      <div className="container mx-auto flex items-center justify-between px-5 md:px-6">
        <Link to="/" className="flex items-center gap-3" aria-label="Imobiliária Clementino — página inicial">
          <Building2 className="h-8 w-8 text-[#d7b661]" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-xl font-semibold leading-none tracking-tight text-white">Clementino</span>
            <span className="mt-1 text-[9px] uppercase tracking-[0.28em] text-[#d7b661]">Imobiliária</span>
          </div>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.end}
              onMouseEnter={link.path === '/imoveis' ? preloadProperties : undefined}
              onTouchStart={link.path === '/imoveis' ? preloadProperties : undefined}
              className={({ isActive }) => `relative py-2 text-sm font-medium transition-colors ${isActive ? 'text-[#d7b661]' : 'text-white/70 hover:text-white'}`}
            >
              {({ isActive }) => <>{link.label}{isActive && <span className="absolute inset-x-1 -bottom-0.5 h-px bg-[#d7b661]" />}</>}
            </NavLink>
          ))}
        </div>

        <div className="hidden md:block">
          <WhatsAppCta href={whatsappUrl} label="Fale no WhatsApp" className="min-h-11 px-5 py-2.5" />
        </div>

        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-white/15 text-white md:hidden" onClick={() => setIsOpen((current) => !current)} aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={isOpen} aria-controls="mobile-navigation">
          {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div id="mobile-navigation" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute inset-x-4 top-full mt-2 overflow-hidden rounded-[var(--radius-surface)] border border-white/10 bg-[#18181b]/98 p-3 shadow-2xl backdrop-blur-xl md:hidden">
            <div className="flex flex-col">
              {navLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.end}
                  onTouchStart={link.path === '/imoveis' ? preloadProperties : undefined}
                  className={({ isActive }) => `rounded-[var(--radius-control)] px-4 py-3 text-base ${isActive ? 'bg-[#d7b661]/10 font-semibold text-[#d7b661]' : 'text-white/70'}`}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
            <WhatsAppCta href={whatsappUrl} label="Fale no WhatsApp" className="mt-3 w-full" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};
