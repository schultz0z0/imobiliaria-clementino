import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { AdminLayout } from './layout/AdminLayout.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { PropertyEditorBootstrap } from './pages/PropertyEditorBootstrap.tsx';
import { PropertyList } from './pages/PropertyList.tsx';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminLayout><Routes><Route path="/" element={<Dashboard />} /><Route path="/imoveis" element={<PropertyList />} /><Route path="/imoveis/novo" element={<PropertyEditorBootstrap mode="create" />} /><Route path="/imoveis/:id/editar" element={<PropertyEditorBootstrap mode="edit" />} /><Route path="*" element={<Dashboard />} /></Routes></AdminLayout>
      </AuthProvider>
    </BrowserRouter>
  );
}
