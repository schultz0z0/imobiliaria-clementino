import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { AdminLayout } from './layout/AdminLayout.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { PropertyEditor } from './pages/PropertyEditor.tsx';
import { PropertyList } from './pages/PropertyList.tsx';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminLayout><Routes><Route path="/" element={<Dashboard />} /><Route path="/imoveis" element={<PropertyList />} /><Route path="/imoveis/novo" element={<PropertyEditor mode="create" />} /><Route path="/imoveis/:id/editar" element={<PropertyEditor mode="edit" />} /><Route path="*" element={<Dashboard />} /></Routes></AdminLayout>
      </AuthProvider>
    </BrowserRouter>
  );
}
