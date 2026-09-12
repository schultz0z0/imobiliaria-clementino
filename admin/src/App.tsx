import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { AdminLayout } from './layout/AdminLayout.tsx';
import { ContractDetails } from './pages/ContractDetails.tsx';
import { ContractEditor } from './pages/ContractEditor.tsx';
import { ContractList } from './pages/ContractList.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { PeopleEditor } from './pages/PeopleEditor.tsx';
import { PeopleList } from './pages/PeopleList.tsx';
import { PropertyEditor } from './pages/PropertyEditor.tsx';
import { PropertyList } from './pages/PropertyList.tsx';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/imoveis" element={<PropertyList />} />
            <Route path="/imoveis/novo" element={<PropertyEditor mode="create" />} />
            <Route path="/imoveis/:id/editar" element={<PropertyEditor mode="edit" />} />
            <Route path="/contratos" element={<ContractList />} />
            <Route path="/contratos/novo" element={<ContractEditor />} />
            <Route path="/contratos/:id" element={<ContractDetails />} />
            <Route path="/pessoas" element={<PeopleList />} />
            <Route path="/pessoas/novo" element={<PeopleEditor mode="create" />} />
            <Route path="/pessoas/:id/editar" element={<PeopleEditor mode="edit" />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </AdminLayout>
      </AuthProvider>
    </BrowserRouter>
  );
}
