import { Building2, FileText, LayoutDashboard, LogOut, Menu, Plus, Users, X } from 'lucide-react';
import React, { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Login } from '../pages/Login.tsx';

export const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { status, mustChangePassword, logout, logoutError } = useAuth();
  const [open, setOpen] = useState(false);
  if (status !== 'authenticated' || mustChangePassword) return <Login />;
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#conteudo-principal">Ir para o conteúdo</a>
      <header className="admin-header">
        <a className="admin-brand" href="/" aria-label="Clementino Imóveis — início do painel"><span className="brand-mark" aria-hidden="true"><Building2 /></span><span><strong>Clementino</strong><small>Administração</small></span></a>
        <button className="icon-button menu-button" type="button" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} aria-controls="admin-navigation" onClick={() => setOpen((current) => !current)}>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
        <nav id="admin-navigation" className={open ? 'admin-nav is-open' : 'admin-nav'} aria-label="Navegação principal">
          <NavLink to="/" end onClick={() => setOpen(false)}><LayoutDashboard aria-hidden="true" />Visão geral</NavLink>
          <NavLink to="/imoveis" onClick={() => setOpen(false)}><Building2 aria-hidden="true" />Imóveis</NavLink>
          <NavLink to="/contratos" onClick={() => setOpen(false)}><FileText aria-hidden="true" />Contratos</NavLink>
          <NavLink to="/pessoas" onClick={() => setOpen(false)}><Users aria-hidden="true" />Pessoas</NavLink>
          <NavLink className="nav-create" to="/imoveis/novo" onClick={() => setOpen(false)}><Plus aria-hidden="true" />Novo imóvel</NavLink>
          <button className="nav-logout" type="button" onClick={() => void logout()}><LogOut aria-hidden="true" />Sair</button>
        </nav>
      </header>
      <main id="conteudo-principal" className="admin-main" tabIndex={-1}>
        {logoutError ? <p className="form-alert shell-alert" role="alert">Não foi possível sair com segurança. Sua sessão continua ativa; tente novamente.</p> : null}
        {children}
      </main>
    </div>
  );
};
