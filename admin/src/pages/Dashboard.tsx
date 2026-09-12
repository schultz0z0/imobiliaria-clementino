import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Clock3,
  DollarSign,
  FilePenLine,
  FileText,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  adminApi,
  type AdminPropertySummaryDto,
  type PaymentAdminApi,
  type PropertyAdminApi,
  type PropertyStatus,
  type PublicationJobSummary,
  type RentalAdminApi,
} from '../api/client.ts';
import type {
  PaymentCategory,
  PaymentRecordDto,
  RentalContractDto,
} from '../../../shared/rentalSchema.ts';
import { DueBadge, computeDueStatus } from '../components/rentals/DueBadge.tsx';
import { PaymentModal } from '../components/rentals/PaymentModal.tsx';
import { ForwardingModal } from '../components/rentals/ForwardingModal.tsx';

type DashboardData = {
  totals: Record<PropertyStatus, number>;
  recent: AdminPropertySummaryDto[];
  latestPublication: PublicationJobSummary | null;
  payments: PaymentRecordDto[];
  contracts: RentalContractDto[];
};

const statusCards: Array<{ status: PropertyStatus; label: string; description: string }> = [
  { status: 'published', label: 'Publicados', description: 'Visíveis no catálogo' },
  { status: 'rented', label: 'Alugados', description: 'Contratos vigentes' },
  { status: 'draft', label: 'Rascunhos', description: 'Aguardando revisão' },
  { status: 'inactive', label: 'Inativos', description: 'Retirados do catálogo' },
];

const paymentCategoryLabel: Record<PaymentCategory, string> = {
  rent: 'Aluguel',
  condominium: 'Condomínio',
  iptu: 'IPTU',
  water: 'Água',
  fire_insurance: 'Seguro Incêndio',
  maintenance: 'Manutenção',
};

const publicationStatusLabel = (publication: PublicationJobSummary) => {
  if (publication.property.status === 'inactive') {
    return (
      {
        queued: 'Retirada na fila',
        running: 'Retirada em processamento',
        succeeded: 'Retirada concluída',
        failed: 'Retirada falhou',
      } as const
    )[publication.status];
  }
  return (
    {
      queued: 'Na fila',
      running: 'Processando',
      succeeded: 'Publicada',
      failed: 'Falhou',
    } as const
  )[publication.status];
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export interface DashboardProps {
  api?: PropertyAdminApi & Partial<RentalAdminApi> & Partial<PaymentAdminApi>;
  referenceDate?: Date;
}

export const Dashboard: React.FC<DashboardProps> = ({
  api = adminApi,
  referenceDate = new Date(),
}) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  // Modals state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [forwardingModalOpen, setForwardingModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecordDto | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [
        drafts,
        published,
        rented,
        inactive,
        recent,
        latestPublication,
        paymentsData,
        contractsData,
      ] = await Promise.all([
        api.listProperties({ page: 1, limit: 1, status: 'draft' }),
        api.listProperties({ page: 1, limit: 1, status: 'published' }),
        api.listProperties({ page: 1, limit: 1, status: 'rented' }),
        api.listProperties({ page: 1, limit: 1, status: 'inactive' }),
        api.listProperties({ page: 1, limit: 4 }),
        api.getLatestPublication(),
        api.listPayments ? api.listPayments({ limit: 100 }) : Promise.resolve({ items: [] }),
        api.listContracts ? api.listContracts({ limit: 100 }) : Promise.resolve({ items: [] }),
      ]);

      setData({
        totals: {
          draft: drafts.pagination.total,
          published: published.pagination.total,
          rented: rented.pagination.total,
          inactive: inactive.pagination.total,
        },
        recent: recent.items,
        latestPublication: latestPublication.publication,
        payments: paymentsData.items ?? [],
        contracts: contractsData.items ?? [],
      });
      setState('ready');
    } catch {
      setState('error');
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [attempt, load]);

  const total = useMemo(
    () => (data ? Object.values(data.totals).reduce((sum, item) => sum + item, 0) : 0),
    [data],
  );

  const contractMap = useMemo(() => {
    const map = new Map<string, RentalContractDto>();
    if (data?.contracts) {
      for (const c of data.contracts) {
        map.set(c.id, c);
      }
    }
    return map;
  }, [data?.contracts]);

  const { overdueList, dueSoonList, awaitingForwardingList, pendingActionItems } = useMemo(() => {
    const overdue: PaymentRecordDto[] = [];
    const dueSoon: PaymentRecordDto[] = [];
    const awaitingForwarding: PaymentRecordDto[] = [];

    if (data?.payments) {
      for (const pmt of data.payments) {
        const s = computeDueStatus(pmt, referenceDate);
        if (s === 'overdue') overdue.push(pmt);
        else if (s === 'due-soon') dueSoon.push(pmt);
        else if (s === 'paid') awaitingForwarding.push(pmt);
      }
    }

    const actionItems = [...overdue, ...dueSoon, ...awaitingForwarding];

    return {
      overdueList: overdue,
      dueSoonList: dueSoon,
      awaitingForwardingList: awaitingForwarding,
      pendingActionItems: actionItems,
    };
  }, [data?.payments, referenceDate]);

  const handlePaymentSuccess = (updatedPayment: PaymentRecordDto) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        payments: prev.payments.map((p) => (p.id === updatedPayment.id ? updatedPayment : p)),
      };
    });
    setSelectedPayment(null);
    setPaymentModalOpen(false);
  };

  const handleForwardingSuccess = (updatedPayment: PaymentRecordDto) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        payments: prev.payments.map((p) => (p.id === updatedPayment.id ? updatedPayment : p)),
      };
    });
    setSelectedPayment(null);
    setForwardingModalOpen(false);
  };

  if (state === 'loading') {
    return (
      <section className="page-stack" aria-labelledby="dashboard-title">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Painel administrativo</p>
            <h1 id="dashboard-title">Visão geral</h1>
          </div>
        </div>
        <div className="panel-state" role="status">
          <RefreshCw className="spin" aria-hidden="true" />
          <p>Carregando o catálogo…</p>
        </div>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section className="page-stack" aria-labelledby="dashboard-title">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Painel administrativo</p>
            <h1 id="dashboard-title">Visão geral</h1>
          </div>
        </div>
        <div className="panel-state panel-state-error" role="alert">
          <AlertCircle aria-hidden="true" />
          <h2>Não foi possível carregar a visão geral</h2>
          <p>Verifique sua conexão e tente novamente.</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setAttempt((current) => current + 1)}
          >
            <RefreshCw aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-stack" aria-labelledby="dashboard-title">
      <div className="page-heading page-heading-actions">
        <div>
          <p className="eyebrow">Painel administrativo</p>
          <h1 id="dashboard-title">Visão geral</h1>
          <p>Acompanhe e mantenha o catálogo e as locações da Clementino atualizados.</p>
        </div>
        <Link className="button button-primary" to="/imoveis/novo">
          <Plus aria-hidden="true" />
          Cadastrar imóvel
        </Link>
      </div>

      {total === 0 ? (
        <div className="empty-state">
          <Building2 aria-hidden="true" />
          <h2>Nenhum imóvel cadastrado</h2>
          <p>Use “Cadastrar imóvel” para criar o primeiro rascunho do catálogo.</p>
        </div>
      ) : (
        <>
          {/* Property Status Cards */}
          <div className="dashboard-stats" aria-label="Totais por status">
            {statusCards.map((card) => (
              <Link
                key={card.status}
                className={`stat-card stat-${card.status}`}
                to={`/imoveis?status=${card.status}`}
              >
                <span>{card.label}</span>
                <strong>{data!.totals[card.status]}</strong>
                <small>{card.description}</small>
              </Link>
            ))}
          </div>

          {/* Section: Hub de Locações & Vencimentos */}
          <section className="content-card rental-hub-card" aria-labelledby="rental-hub-title">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Gestão de Locações</p>
                <h2 id="rental-hub-title">Hub de Locações &amp; Vencimentos</h2>
              </div>
              <Link
                className="button button-secondary"
                to="/contratos"
                style={{ minHeight: '38px', padding: '6px 14px', fontSize: '13px' }}
              >
                <FileText aria-hidden="true" style={{ width: '15px', height: '15px' }} />
                <span>Ver contratos</span>
              </Link>
            </div>

            {/* Semaphore counters */}
            <div className="semaphore-grid" role="region" aria-label="Semáforo de vencimentos">
              <Link
                to="/contratos?status=active"
                className="semaphore-card semaphore-overdue"
                title="Ver contratos com pagamentos atrasados"
              >
                <div className="semaphore-indicator">
                  <span className="semaphore-dot dot-overdue" aria-hidden="true" />
                  <span className="semaphore-title">Vencidos</span>
                </div>
                <strong className="semaphore-count">{overdueList.length}</strong>
                <small>Boletos em atraso</small>
              </Link>

              <Link
                to="/contratos?status=active"
                className="semaphore-card semaphore-due-soon"
                title="Ver contratos vencendo em breve"
              >
                <div className="semaphore-indicator">
                  <span className="semaphore-dot dot-due-soon" aria-hidden="true" />
                  <span className="semaphore-title">Vencendo em 7 dias</span>
                </div>
                <strong className="semaphore-count">{dueSoonList.length}</strong>
                <small>Próximos do vencimento</small>
              </Link>

              <Link
                to="/contratos?status=active"
                className="semaphore-card semaphore-forwarding"
                title="Ver pagamentos aguardando repasse ao locador"
              >
                <div className="semaphore-indicator">
                  <span className="semaphore-dot dot-forwarding" aria-hidden="true" />
                  <span className="semaphore-title">Aguardando Repasse</span>
                </div>
                <strong className="semaphore-count">{awaitingForwardingList.length}</strong>
                <small>Pagos pelo inquilino</small>
              </Link>
            </div>

            {/* Quick Action List */}
            <div className="pending-actions-section" style={{ marginTop: '22px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  Ações Rápidas de Cobrança e Repasse
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                  {pendingActionItems.length} {pendingActionItems.length === 1 ? 'pendência' : 'pendências'}
                </span>
              </div>

              {pendingActionItems.length === 0 ? (
                <div
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--admin-radius-sm)',
                    background: 'var(--admin-surface-muted)',
                    textAlign: 'center',
                    color: 'var(--admin-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <ShieldCheck
                    style={{ width: '18px', height: '18px', color: '#17613a' }}
                    aria-hidden="true"
                  />
                  <span>Tudo em dia! Nenhuma pendência financeira no momento.</span>
                </div>
              ) : (
                <div className="pending-payments-list">
                  {pendingActionItems.slice(0, 6).map((item) => {
                    const status = computeDueStatus(item, referenceDate);
                    const contract = contractMap.get(item.contractId);
                    const isPaid = !!item.paidAt;

                    return (
                      <div key={item.id} className="pending-payment-item">
                        <div className="pending-payment-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <DueBadge status={status} />
                            <strong>
                              {contract?.contractNumber ? `${contract.contractNumber} · ` : ''}
                              {paymentCategoryLabel[item.category] || item.category}
                            </strong>
                            <span style={{ color: 'var(--admin-text-muted)', fontSize: '12px' }}>
                              ({item.referenceMonth})
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--admin-text-muted)',
                              marginTop: '4px',
                            }}
                          >
                            {isPaid
                              ? `Pago em ${item.paidAt?.slice(0, 10)}`
                              : `Vencimento: ${item.dueDate}`}
                            {' · '}
                            <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>
                              {formatCurrency(item.amount)}
                            </span>
                          </div>
                        </div>

                        <div className="pending-payment-action">
                          {!isPaid ? (
                            <button
                              type="button"
                              className="button button-primary"
                              style={{ minHeight: '36px', padding: '6px 14px', fontSize: '12px' }}
                              onClick={() => {
                                setSelectedPayment(item);
                                setPaymentModalOpen(true);
                              }}
                            >
                              <DollarSign
                                style={{ width: '14px', height: '14px' }}
                                aria-hidden="true"
                              />
                              Dar baixa em boleto
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="button button-secondary"
                              style={{ minHeight: '36px', padding: '6px 14px', fontSize: '12px' }}
                              onClick={() => {
                                setSelectedPayment(item);
                                setForwardingModalOpen(true);
                              }}
                            >
                              <ArrowUpRight
                                style={{ width: '14px', height: '14px' }}
                                aria-hidden="true"
                              />
                              Dar baixa em repasse
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: '14px' }}>
                <Link to="/contratos" className="text-link" style={{ fontSize: '13px' }}>
                  Gerenciar contratos e fluxo financeiro completo →
                </Link>
              </div>
            </div>
          </section>

          {/* Grid: Site publico & Recentes */}
          <div className="dashboard-grid">
            <section className="content-card" aria-labelledby="latest-publication-title">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">Site público</p>
                  <h2 id="latest-publication-title">Última publicação</h2>
                </div>
                <Rocket aria-hidden="true" />
              </div>
              {data!.latestPublication ? (
                <div className="publication-summary">
                  <span className={`status-badge publication-${data!.latestPublication.status}`}>
                    {publicationStatusLabel(data!.latestPublication)}
                  </span>
                  <strong>{data!.latestPublication.property.title}</strong>
                  <p>
                    {data!.latestPublication.finishedAt
                      ? `Finalizada em ${formatDate(data!.latestPublication.finishedAt)}.`
                      : `Solicitada em ${
                          data!.latestPublication.queuedAt
                            ? formatDate(data!.latestPublication.queuedAt)
                            : 'data não informada'
                        }.`}
                  </p>
                  <small>
                    {data!.latestPublication.property.reference} · O site só muda depois que a
                    solicitação termina e todas as validações passam.
                  </small>
                </div>
              ) : (
                <div className="inline-empty">
                  <Clock3 aria-hidden="true" />
                  <p>Ainda não há uma publicação processada.</p>
                </div>
              )}
            </section>

            <section className="content-card" aria-labelledby="recent-properties-title">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">Atividade</p>
                  <h2 id="recent-properties-title">Alterados recentemente</h2>
                </div>
                <FilePenLine aria-hidden="true" />
              </div>
              <ul className="recent-list">
                {data!.recent.map((property) => (
                  <li key={property.id}>
                    <Link to={`/imoveis/${property.id}/editar`}>
                      <span>
                        <strong>{property.title}</strong>
                        <small>
                          {property.reference} ·{' '}
                          {property.location.district || 'Localização não informada'}
                        </small>
                      </span>
                      <time dateTime={property.updatedAt}>{formatDate(property.updatedAt)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link className="text-link" to="/imoveis">
                Ver todos os imóveis
              </Link>
            </section>
          </div>

          {/* Payment Modal */}
          <PaymentModal
            isOpen={paymentModalOpen}
            payment={selectedPayment}
            onClose={() => {
              setPaymentModalOpen(false);
              setSelectedPayment(null);
            }}
            onSuccess={handlePaymentSuccess}
            api={api}
            contractNumber={
              selectedPayment ? contractMap.get(selectedPayment.contractId)?.contractNumber : undefined
            }
          />

          {/* Forwarding Modal */}
          <ForwardingModal
            isOpen={forwardingModalOpen}
            payment={selectedPayment}
            onClose={() => {
              setForwardingModalOpen(false);
              setSelectedPayment(null);
            }}
            onSuccess={handleForwardingSuccess}
            api={api}
            contractNumber={
              selectedPayment ? contractMap.get(selectedPayment.contractId)?.contractNumber : undefined
            }
          />
        </>
      )}
    </section>
  );
};
