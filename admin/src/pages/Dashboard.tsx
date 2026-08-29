import { AlertCircle, Building2, Clock3, FilePenLine, Plus, RefreshCw, Rocket } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type PropertyAdminApi, type PropertyAdminDto, type PropertyStatus, type PublicationJobSummary } from '../api/client.ts';

type DashboardData = { totals: Record<PropertyStatus, number>; recent: PropertyAdminDto[]; latestPublished: PropertyAdminDto | null; latestPublication: PublicationJobSummary | null };
const statusCards: Array<{ status: PropertyStatus; label: string; description: string }> = [
  { status: 'published', label: 'Publicados', description: 'Visíveis no catálogo' },
  { status: 'draft', label: 'Rascunhos', description: 'Aguardando revisão' },
  { status: 'inactive', label: 'Inativos', description: 'Retirados do catálogo' },
];
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export const Dashboard = ({ api = adminApi }: { api?: PropertyAdminApi }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(async () => {
    setState('loading');
    try {
      const [drafts, published, inactive, recent, latestPublication] = await Promise.all([
        api.listProperties({ page: 1, limit: 1, status: 'draft' }),
        api.listProperties({ page: 1, limit: 1, status: 'published' }),
        api.listProperties({ page: 1, limit: 1, status: 'inactive' }),
        api.listProperties({ page: 1, limit: 4 }),
        api.getLatestPublication(),
      ]);
      setData({ totals: { draft: drafts.pagination.total, published: published.pagination.total, inactive: inactive.pagination.total }, recent: recent.items, latestPublished: published.items[0] ?? null, latestPublication: latestPublication.publication });
      setState('ready');
    } catch { setState('error'); }
  }, [api]);
  useEffect(() => { void load(); }, [attempt, load]);
  const total = useMemo(() => data ? Object.values(data.totals).reduce((sum, item) => sum + item, 0) : 0, [data]);

  if (state === 'loading') return <section className="page-stack" aria-labelledby="dashboard-title"><div className="page-heading"><div><p className="eyebrow">Painel administrativo</p><h1 id="dashboard-title">Visão geral</h1></div></div><div className="panel-state" role="status"><RefreshCw className="spin" aria-hidden="true" /><p>Carregando o catálogo…</p></div></section>;
  if (state === 'error') return <section className="page-stack" aria-labelledby="dashboard-title"><div className="page-heading"><div><p className="eyebrow">Painel administrativo</p><h1 id="dashboard-title">Visão geral</h1></div></div><div className="panel-state panel-state-error" role="alert"><AlertCircle aria-hidden="true" /><h2>Não foi possível carregar a visão geral</h2><p>Verifique sua conexão e tente novamente.</p><button className="button button-secondary" type="button" onClick={() => setAttempt((current) => current + 1)}><RefreshCw aria-hidden="true" />Tentar novamente</button></div></section>;

  return (
    <section className="page-stack" aria-labelledby="dashboard-title">
      <div className="page-heading page-heading-actions"><div><p className="eyebrow">Painel administrativo</p><h1 id="dashboard-title">Visão geral</h1><p>Acompanhe e mantenha o catálogo da Clementino atualizado.</p></div><Link className="button button-primary" to="/imoveis/novo"><Plus aria-hidden="true" />Cadastrar imóvel</Link></div>
      {total === 0 ? <div className="empty-state"><Building2 aria-hidden="true" /><h2>Nenhum imóvel cadastrado</h2><p>Use “Cadastrar imóvel” para criar o primeiro rascunho do catálogo.</p></div> : <>
        <div className="dashboard-stats" aria-label="Totais por status">{statusCards.map((card) => <Link key={card.status} className={`stat-card stat-${card.status}`} to={`/imoveis?status=${card.status}`}><span>{card.label}</span><strong>{data!.totals[card.status]}</strong><small>{card.description}</small></Link>)}</div>
        <div className="dashboard-grid">
          <section className="content-card" aria-labelledby="latest-publication-title"><div className="section-title-row"><div><p className="eyebrow">Site público</p><h2 id="latest-publication-title">Última publicação</h2></div><Rocket aria-hidden="true" /></div>{data!.latestPublication ? <div className="publication-summary"><span className={`status-badge publication-${data!.latestPublication.status}`}>{({ queued: 'Na fila', running: 'Processando', succeeded: 'Publicada', failed: 'Falhou' } as const)[data!.latestPublication.status]}</span><strong>{data!.latestPublished?.draft.editorial?.title ?? `Publicação #${data!.latestPublication.id}`}</strong><p>{data!.latestPublication.finishedAt ? `Finalizada em ${formatDate(data!.latestPublication.finishedAt)}.` : `Solicitada em ${data!.latestPublication.queuedAt ? formatDate(data!.latestPublication.queuedAt) : 'data não informada'}.`}</p><small>O site só muda depois que a publicação termina e todas as validações passam.</small></div> : <div className="inline-empty"><Clock3 aria-hidden="true" /><p>Ainda não há uma publicação processada.</p></div>}</section>
          <section className="content-card" aria-labelledby="recent-properties-title"><div className="section-title-row"><div><p className="eyebrow">Atividade</p><h2 id="recent-properties-title">Alterados recentemente</h2></div><FilePenLine aria-hidden="true" /></div><ul className="recent-list">{data!.recent.map((property) => <li key={property.id}><Link to={`/imoveis/${property.id}/editar`}><span><strong>{property.draft.editorial?.title ?? 'Imóvel sem título'}</strong><small>{property.commercialReference} · {property.draft.privateAddress?.district ?? 'Localização não informada'}</small></span><time dateTime={property.updatedAt}>{formatDate(property.updatedAt)}</time></Link></li>)}</ul><Link className="text-link" to="/imoveis">Ver todos os imóveis</Link></section>
        </div>
      </>}
    </section>
  );
};
