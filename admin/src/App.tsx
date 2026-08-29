import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { AdminLayout } from './layout/AdminLayout.tsx';

const Overview = () => (
  <section className="page-stack" aria-labelledby="overview-title">
    <div className="page-heading"><div><p className="eyebrow">Painel administrativo</p><h1 id="overview-title">Visão geral</h1></div></div>
    <div className="empty-state"><h2>Seu catálogo, em um só lugar</h2><p>Use a navegação para cadastrar e gerenciar os imóveis do site.</p></div>
  </section>
);

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminLayout><Routes><Route path="*" element={<Overview />} /></Routes></AdminLayout>
      </AuthProvider>
    </BrowserRouter>
  );
}
