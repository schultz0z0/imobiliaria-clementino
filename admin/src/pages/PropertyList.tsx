import { AlertCircle, Building2, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi, type AdminPropertySummaryDto, type PropertyAdminApi, type PropertyListQuery } from '../api/client.ts';
import { AdminPropertyCard, type PropertyAction } from '../components/properties/AdminPropertyCard.tsx';
import { AdminPropertyFilters, type PropertySort } from '../components/properties/AdminPropertyFilters.tsx';

const PAGE_SIZE = 20;
const statuses = new Set(['draft', 'published', 'inactive']);
const operations = new Set(['sale', 'rent', 'seasonal', 'auction']);
const types = new Set(['apartment', 'house', 'commercial', 'rural', 'land']);
const sorts = new Set<PropertySort>(['updated-desc', 'updated-asc', 'title-asc', 'title-desc', 'price-asc', 'price-desc']);

const parsePositivePage = (value: string | null) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
};

export const propertyQueryFromSearch = (params: URLSearchParams): PropertyListQuery & { page: number; limit: number; sort: PropertySort } => {
  const query: PropertyListQuery = { page: parsePositivePage(params.get('page')), limit: PAGE_SIZE };
  const assignText = (key: 'search' | 'state' | 'city' | 'district') => {
    const text = params.get(key)?.trim();
    if (text) query[key] = key === 'state' ? text.toUpperCase().slice(0, 2) : text;
  };
  assignText('search'); assignText('state'); assignText('city'); assignText('district');
  const status = params.get('status'); if (status && statuses.has(status)) query.status = status as PropertyListQuery['status'];
  const operation = params.get('operation'); if (operation && operations.has(operation)) query.operation = operation as PropertyListQuery['operation'];
  const type = params.get('type'); if (type && types.has(type)) query.type = type as PropertyListQuery['type'];
  const requestedSort = params.get('sort') as PropertySort | null;
  query.sort = requestedSort && sorts.has(requestedSort) ? requestedSort : 'updated-desc';
  return query as PropertyListQuery & { page: number; limit: number; sort: PropertySort };
};

const queryToSearch = (query: PropertyListQuery) => {
  const next = new URLSearchParams();
  for (const key of ['search', 'status', 'operation', 'type', 'state', 'city', 'district'] as const) {
    const value = query[key];
    if (value) next.set(key, String(value));
  }
  next.set('sort', query.sort ?? 'updated-desc');
  next.set('page', String(query.page ?? 1));
  return next;
};

export const PropertyList = ({ api = adminApi }: { api?: PropertyAdminApi }) => {
  const [params, setParams] = useSearchParams();
  const searchKey = params.toString();
  const query = useMemo(() => propertyQueryFromSearch(new URLSearchParams(searchKey)), [searchKey]);
  const [items, setItems] = useState<AdminPropertySummaryDto[]>([]);
  const [pagination, setPagination] = useState({ page: query.page, total: 0, pages: 0 });
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [busy, setBusy] = useState<{ id: string; action: PropertyAction } | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setState('loading');
    api.listProperties(query).then((response) => {
      if (!active) return;
      setItems(response.items);
      setPagination({ page: response.pagination.page, total: response.pagination.total, pages: response.pagination.pages });
      setState('ready');
    }, () => { if (active) setState('error'); });
    return () => { active = false; };
  }, [api, query, refreshVersion]);

  const updateQuery = (next: PropertyListQuery) => {
    setNotice(null);
    setParams(queryToSearch({ ...next, limit: PAGE_SIZE }));
  };
  const applyFilters = (filters: PropertyListQuery) => updateQuery({ ...filters, page: 1, sort: query.sort });
  const runAction = async (action: PropertyAction, property: AdminPropertySummaryDto) => {
    if (action === 'publish' && !window.confirm(`Solicitar a publicação de “${property.title}”?`)) return;
    if (action === 'inactivate' && !window.confirm('Inativar este imóvel e solicitar sua retirada do site público?')) return;
    setBusy({ id: property.id, action }); setNotice(null);
    try {
      if (action === 'publish') {
        await api.publishProperty(property.id);
        setNotice({ tone: 'success', text: 'Publicação solicitada. O imóvel entrará no site somente após a validação da fila.' });
      } else if (action === 'duplicate') {
        await api.duplicateProperty(property.id);
        setNotice({ tone: 'success', text: 'Cópia criada como rascunho.' });
      } else if (action === 'inactivate') {
        await api.inactivateProperty(property.id);
        setNotice({ tone: 'success', text: 'Imóvel inativado. A retirada do site será processada com segurança.' });
      } else {
        await api.reactivateProperty(property.id);
        setNotice({ tone: 'success', text: 'Imóvel reativado.' });
      }
      setRefreshVersion((version) => version + 1);
    } catch {
      setNotice({ tone: 'error', text: 'Não foi possível concluir a ação. Atualize os dados e tente novamente.' });
    } finally { setBusy(null); }
  };

  return (
    <section className="page-stack" aria-labelledby="property-list-title">
      <div className="page-heading page-heading-actions"><div><p className="eyebrow">Catálogo</p><h1 id="property-list-title">Imóveis</h1><p>Gerencie rascunhos, publicações e imóveis inativos.</p></div><Link className="button button-primary" to="/imoveis/novo"><Plus aria-hidden="true" />Cadastrar imóvel</Link></div>
      <AdminPropertyFilters key={searchKey} initialValues={query} sort={query.sort} onSort={(sort) => updateQuery({ ...query, sort, page: 1 })} onApply={applyFilters} onClear={() => updateQuery({ page: 1, limit: PAGE_SIZE, sort: query.sort })} />
      {notice ? <p className={notice.tone === 'error' ? 'form-alert list-notice' : 'form-notice list-notice'} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p> : null}
      {state === 'loading' ? <div className="panel-state" role="status"><RefreshCw className="spin" aria-hidden="true" /><p>Carregando imóveis…</p></div> : null}
      {state === 'error' ? <div className="panel-state panel-state-error" role="alert"><AlertCircle aria-hidden="true" /><h2>Não foi possível carregar os imóveis</h2><p>Verifique sua conexão e tente novamente.</p><button className="button button-secondary" type="button" onClick={() => setRefreshVersion((version) => version + 1)}><RefreshCw aria-hidden="true" />Tentar novamente</button></div> : null}
      {state === 'ready' && items.length === 0 ? <div className="empty-state"><Building2 aria-hidden="true" /><h2>Nenhum imóvel encontrado</h2><p>Ajuste os filtros ou cadastre um novo imóvel.</p></div> : null}
      {state === 'ready' && items.length > 0 ? <section className="property-results" aria-labelledby="property-results-title"><div className="results-heading"><h2 id="property-results-title">{pagination.total} {pagination.total === 1 ? 'imóvel' : 'imóveis'}</h2><span>Ordenados no servidor</span></div><div className="property-card-list">{items.map((property) => <AdminPropertyCard key={property.id} property={property} busyAction={busy?.id === property.id ? busy.action : undefined} onAction={(action, item) => void runAction(action, item)} />)}</div>{pagination.pages > 1 ? <nav className="pagination" aria-label="Paginação dos imóveis"><button className="button button-secondary" type="button" aria-label="Página anterior" disabled={pagination.page <= 1} onClick={() => updateQuery({ ...query, page: pagination.page - 1 })}><ChevronLeft aria-hidden="true" />Anterior</button><span aria-live="polite">Página {pagination.page} de {pagination.pages}</span><button className="button button-secondary" type="button" aria-label="Próxima página" disabled={pagination.page >= pagination.pages} onClick={() => updateQuery({ ...query, page: pagination.page + 1 })}>Próxima<ChevronRight aria-hidden="true" /></button></nav> : null}</section> : null}
    </section>
  );
};
