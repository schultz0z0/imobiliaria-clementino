import { AlertCircle, Building2, Plus, RefreshCw } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi, type PropertyAdminApi, type PropertyAdminDto, type PropertyListQuery } from '../api/client.ts';
import { AdminPropertyCard, type PropertyAction } from '../components/properties/AdminPropertyCard.tsx';
import { AdminPropertyFilters, type PropertySort } from '../components/properties/AdminPropertyFilters.tsx';

const firstPrice = (property: PropertyAdminDto) => { const operation = property.draft.classification?.operations?.[0]; return operation ? property.draft.pricing?.[operation] ?? 0 : 0; };
const sortProperties = (items: PropertyAdminDto[], sort: PropertySort) => [...items].sort((a, b) => {
  if (sort === 'updated-desc') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  if (sort === 'updated-asc') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  if (sort === 'price-desc') return firstPrice(b) - firstPrice(a);
  if (sort === 'price-asc') return firstPrice(a) - firstPrice(b);
  const comparison = (a.draft.editorial?.title ?? '').localeCompare(b.draft.editorial?.title ?? '', 'pt-BR');
  return sort === 'title-desc' ? -comparison : comparison;
});
const initialQuery = (params: URLSearchParams): PropertyListQuery => { const status = params.get('status'); return { page: 1, limit: 100, ...(status === 'draft' || status === 'published' || status === 'inactive' ? { status } : {}) }; };

export const PropertyList = ({ api = adminApi }: { api?: PropertyAdminApi }) => {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<PropertyListQuery>(() => initialQuery(params));
  const [sort, setSort] = useState<PropertySort>('updated-desc');
  const [items, setItems] = useState<PropertyAdminDto[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<{ id: string; action: PropertyAction } | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true; setState('loading');
    void (async () => {
      try {
        const first = await api.listProperties(filters);
        const remaining = first.pagination.pages > 1
          ? await Promise.all(Array.from({ length: first.pagination.pages - 1 }, (_, index) => api.listProperties({ ...filters, page: index + 2 })))
          : [];
        if (!active) return;
        setItems([first, ...remaining].flatMap((response) => response.items));
        setTotal(first.pagination.total);
        setState('ready');
      } catch { if (active) setState('error'); }
    })();
    return () => { active = false; };
  }, [api, attempt, filters]);
  const sorted = useMemo(() => sortProperties(items, sort), [items, sort]);
  const applyFilters = (next: PropertyListQuery) => {
    setNotice(null); setFilters(next);
    const nextParams = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (!['page', 'limit'].includes(key) && value) nextParams.set(key, String(value));
    setParams(nextParams, { replace: true });
  };
  const runAction = async (action: PropertyAction, property: PropertyAdminDto) => {
    if (action === 'publish' && !window.confirm(`Solicitar a publicação de “${property.draft.editorial?.title ?? 'este imóvel'}”?`)) return;
    if (action === 'inactivate' && !window.confirm('Inativar este imóvel e solicitar sua retirada do site público?')) return;
    setBusy({ id: property.id, action }); setNotice(null);
    try {
      if (action === 'publish') { await api.publishProperty(property.id); setNotice({ tone: 'success', text: 'Publicação solicitada. O imóvel entrará no site somente após a validação da fila.' }); }
      else if (action === 'duplicate') { const result = await api.duplicateProperty(property.id); if (!filters.status || filters.status === 'draft') { setItems((current) => [result.property, ...current]); setTotal((current) => current + 1); } setNotice({ tone: 'success', text: 'Cópia criada como rascunho.' }); }
      else { const result = action === 'inactivate' ? await api.inactivateProperty(property.id) : await api.reactivateProperty(property.id); setItems((current) => filters.status && filters.status !== result.property.status ? current.filter((item) => item.id !== result.property.id) : current.map((item) => item.id === result.property.id ? result.property : item)); setNotice({ tone: 'success', text: action === 'inactivate' ? 'Imóvel inativado. A retirada do site será processada com segurança.' : 'Imóvel reativado.' }); }
    } catch { setNotice({ tone: 'error', text: 'Não foi possível concluir a ação. Atualize os dados e tente novamente.' }); }
    finally { setBusy(null); }
  };

  return (
    <section className="page-stack" aria-labelledby="property-list-title">
      <div className="page-heading page-heading-actions"><div><p className="eyebrow">Catálogo</p><h1 id="property-list-title">Imóveis</h1><p>Gerencie rascunhos, publicações e imóveis inativos.</p></div><Link className="button button-primary" to="/imoveis/novo"><Plus aria-hidden="true" />Cadastrar imóvel</Link></div>
      <AdminPropertyFilters key={params.toString()} initialValues={filters} sort={sort} onSort={setSort} onApply={applyFilters} onClear={() => applyFilters({ page: 1, limit: 100 })} />
      {notice ? <p className={notice.tone === 'error' ? 'form-alert list-notice' : 'form-notice list-notice'} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p> : null}
      {state === 'loading' ? <div className="panel-state" role="status"><RefreshCw className="spin" aria-hidden="true" /><p>Carregando imóveis…</p></div> : null}
      {state === 'error' ? <div className="panel-state panel-state-error" role="alert"><AlertCircle aria-hidden="true" /><h2>Não foi possível carregar os imóveis</h2><p>Verifique sua conexão e tente novamente.</p><button className="button button-secondary" type="button" onClick={() => setAttempt((current) => current + 1)}><RefreshCw aria-hidden="true" />Tentar novamente</button></div> : null}
      {state === 'ready' && sorted.length === 0 ? <div className="empty-state"><Building2 aria-hidden="true" /><h2>Nenhum imóvel encontrado</h2><p>Ajuste os filtros ou cadastre um novo imóvel.</p></div> : null}
      {state === 'ready' && sorted.length > 0 ? <section className="property-results" aria-labelledby="property-results-title"><div className="results-heading"><h2 id="property-results-title">{total} {total === 1 ? 'imóvel' : 'imóveis'}</h2><span>Ordenação aplicada a todos os resultados</span></div><div className="property-card-list">{sorted.map((property) => <AdminPropertyCard key={property.id} property={property} busyAction={busy?.id === property.id ? busy.action : undefined} onAction={(action, item) => void runAction(action, item)} />)}</div></section> : null}
    </section>
  );
};
