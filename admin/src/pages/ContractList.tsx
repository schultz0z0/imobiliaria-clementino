import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Plus,
  RefreshCw,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { adminApi, ApiError, type RentalAdminApi } from '../api/client.ts';
import type { ContractStatus, RentalContractDto } from '../../../shared/rentalSchema.ts';

const PAGE_SIZE = 20;

const statusLabel: Record<ContractStatus, string> = {
  active: 'Ativo',
  expired: 'Vencido',
  terminated: 'Rescindido',
};

const statusBadgeClass: Record<ContractStatus, string> = {
  active: 'status-published',
  expired: 'status-draft',
  terminated: 'status-inactive',
};

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatDate = (val: string | null | undefined) => {
  if (!val) return '—';
  try {
    const [year, month, day] = val.slice(0, 10).split('-');
    if (!year || !month || !day) return val;
    return `${day}/${month}/${year}`;
  } catch {
    return val;
  }
};

export const ContractList = ({ api = adminApi }: { api?: RentalAdminApi }) => {
  const [params, setParams] = useSearchParams();
  const statusParam = (params.get('status') as ContractStatus) || undefined;
  const pageParam = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);

  const [items, setItems] = useState<RentalContractDto[]>([]);
  const [pagination, setPagination] = useState({ page: pageParam, total: 0, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async (status: ContractStatus | undefined, page: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listContracts({
        status,
        page,
        limit: PAGE_SIZE,
      });
      setItems(response.items);
      setPagination({
        page: response.pagination.page,
        total: response.pagination.total,
        limit: response.pagination.limit || PAGE_SIZE,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a lista de contratos.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchContracts(statusParam, pageParam);
  }, [fetchContracts, statusParam, pageParam]);

  const handleStatusChange = (status: string) => {
    const next = new URLSearchParams(params);
    if (status) {
      next.set('status', status);
    } else {
      next.delete('status');
    }
    next.set('page', '1');
    setParams(next);
  };

  const handlePageChange = (newPage: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(newPage));
    setParams(next);
  };

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <div className="page-stack">
      <div className="page-heading-actions">
        <div className="page-heading">
          <p className="eyebrow">Gestão de Locações</p>
          <h1>Contratos de Locação</h1>
          <p>Gerencie contratos de locação, valores mensais, partes envolvidas e datas de reajuste.</p>
        </div>
        <Link to="/contratos/novo" className="button button-primary">
          <Plus aria-hidden="true" />
          <span>Novo contrato</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="content-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text-muted)', marginRight: '8px' }}>
            Status:
          </span>
          <button
            type="button"
            className={`button ${!statusParam ? 'button-primary' : 'button-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => handleStatusChange('')}
          >
            Todos
          </button>
          <button
            type="button"
            className={`button ${statusParam === 'active' ? 'button-primary' : 'button-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => handleStatusChange('active')}
          >
            Ativos
          </button>
          <button
            type="button"
            className={`button ${statusParam === 'expired' ? 'button-primary' : 'button-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => handleStatusChange('expired')}
          >
            Vencidos
          </button>
          <button
            type="button"
            className={`button ${statusParam === 'terminated' ? 'button-primary' : 'button-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => handleStatusChange('terminated')}
          >
            Rescindidos
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel-state" role="status">
          <RefreshCw className="spin" aria-hidden="true" />
          <h2>Carregando contratos...</h2>
        </div>
      ) : error ? (
        <div className="panel-state panel-state-error">
          <AlertCircle aria-hidden="true" />
          <h2>Erro ao carregar contratos</h2>
          <p>{error}</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => fetchContracts(statusParam, pageParam)}
          >
            Tentar novamente
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <FileText aria-hidden="true" />
          <h2>Nenhum contrato encontrado</h2>
          <p>
            {statusParam
              ? `Não foram encontrados contratos com status "${statusLabel[statusParam]}".`
              : 'Ainda não há nenhum contrato de locação cadastrado.'}
          </p>
          <Link to="/contratos/novo" className="button button-primary">
            <Plus aria-hidden="true" />
            <span>Novo contrato</span>
          </Link>
        </div>
      ) : (
        <div className="property-results">
          <div className="results-heading">
            <h2>Contratos cadastrados ({pagination.total})</h2>
            <span>
              Página {pagination.page} de {totalPages}
            </span>
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            {items.map((contract) => (
              <article
                key={contract.id}
                className="content-card"
                style={{
                  padding: '20px',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 'var(--admin-radius-md)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className={`status-badge ${statusBadgeClass[contract.status]}`}>
                        {statusLabel[contract.status]}
                      </span>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                        {contract.contractNumber}
                      </h3>
                    </div>
                    <dl
                      className="property-meta"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '12px',
                        margin: '12px 0 0',
                      }}
                    >
                      <div>
                        <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Aluguel</dt>
                        <dd style={{ margin: '2px 0 0', fontWeight: 700, fontSize: '15px' }}>
                          {formatCurrency(contract.rentAmount)}
                        </dd>
                      </div>
                      <div>
                        <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Vencimento</dt>
                        <dd style={{ margin: '2px 0 0', fontWeight: 600 }}>
                          Dia {contract.rentDueDay}
                        </dd>
                      </div>
                      <div>
                        <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Vigência</dt>
                        <dd style={{ margin: '2px 0 0' }}>
                          {formatDate(contract.startDate)} até {formatDate(contract.endDate)}
                        </dd>
                      </div>
                      <div>
                        <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Reajuste</dt>
                        <dd style={{ margin: '2px 0 0' }}>
                          {contract.adjustmentIndex
                            ? `${contract.adjustmentIndex}${
                                contract.adjustmentPercentage ? ` (${contract.adjustmentPercentage}%)` : ''
                              }`
                            : 'Não configurado'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignSelf: 'center' }}>
                    <Link
                      to={`/contratos/${contract.id}`}
                      className="button button-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Eye style={{ width: '16px', height: '16px' }} aria-hidden="true" />
                      <span>Ver detalhes</span>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 ? (
            <nav className="pagination" aria-label="Paginação de contratos" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="button button-secondary"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                <ChevronLeft aria-hidden="true" />
                <span>Anterior</span>
              </button>
              <span>
                Página {pagination.page} de {totalPages}
              </span>
              <button
                type="button"
                className="button button-secondary"
                disabled={pagination.page >= totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                <span>Próxima</span>
                <ChevronRight aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </div>
      )}
    </div>
  );
};
