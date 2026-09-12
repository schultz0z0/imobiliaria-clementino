import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  FileCheck,
  FileText,
  Filter,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Upload,
  User,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  adminApi,
  ApiError,
  type AdminPropertySummaryDto,
  type PaymentAdminApi,
  type PeopleAdminApi,
  type PropertyAdminApi,
  type RentalAdminApi,
} from '../api/client.ts';
import type {
  ContractDocumentDto,
  ContractStatus,
  DocumentCategory,
  PaymentCategory,
  PaymentRecordDto,
  PersonDto,
  RentalContractDto,
} from '../../../shared/rentalSchema.ts';
import { DocumentUploadModal } from '../components/rentals/DocumentUploadModal.tsx';
import { PaymentModal } from '../components/rentals/PaymentModal.tsx';
import { ForwardingModal } from '../components/rentals/ForwardingModal.tsx';

interface ContractDetailsProps {
  api?: RentalAdminApi &
    Partial<PropertyAdminApi> &
    Partial<PeopleAdminApi> &
    Partial<PaymentAdminApi>;
}

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

const documentCategoryLabel: Record<DocumentCategory, string> = {
  contract_pdf: 'Contrato Assinado',
  inspection_report: 'Laudo de Vistoria',
  payment_receipt: 'Comprovante Pagamento',
  forwarding_receipt: 'Comprovante Repasse',
  amendment: 'Aditivo Contratual',
  other: 'Outro Documento',
};

const paymentCategoryLabel: Record<PaymentCategory, string> = {
  rent: 'Aluguel',
  condominium: 'Condomínio',
  iptu: 'IPTU',
  water: 'Água',
  fire_insurance: 'Seguro Incêndio',
  maintenance: 'Manutenção',
};

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—';
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

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const ContractDetails = ({ api = adminApi }: ContractDetailsProps) => {
  const { id } = useParams<{ id: string }>();

  const [contract, setContract] = useState<RentalContractDto | null>(null);
  const [landlord, setLandlord] = useState<PersonDto | null>(null);
  const [tenant, setTenant] = useState<PersonDto | null>(null);
  const [property, setProperty] = useState<AdminPropertySummaryDto | null>(null);
  const [documents, setDocuments] = useState<ContractDocumentDto[]>([]);
  const [payments, setPayments] = useState<PaymentRecordDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminating, setTerminating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecordDto | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [forwardingModalOpen, setForwardingModalOpen] = useState(false);
  const [generatingPayments, setGeneratingPayments] = useState(false);
  type PaymentFilter = 'all' | 'pending' | 'paid' | 'forwarded' | 'overdue';
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { contract: loadedContract } = await api.getContract(id);
      setContract(loadedContract);

      const [landlordRes, tenantRes, propRes, docsRes, paymentsRes] = await Promise.allSettled([
        api.getPerson ? api.getPerson(loadedContract.landlordId) : Promise.resolve({ person: null }),
        api.getPerson ? api.getPerson(loadedContract.tenantId) : Promise.resolve({ person: null }),
        api.getProperty ? api.getProperty(loadedContract.propertyId) : Promise.resolve({ property: null }),
        api.listContractDocuments ? api.listContractDocuments(loadedContract.id) : Promise.resolve({ documents: [] }),
        api.listPayments ? api.listPayments({ contractId: loadedContract.id }) : Promise.resolve({ items: [] }),
      ]);

      if (landlordRes.status === 'fulfilled' && landlordRes.value.person) {
        setLandlord(landlordRes.value.person);
      }
      if (tenantRes.status === 'fulfilled' && tenantRes.value.person) {
        setTenant(tenantRes.value.person);
      }
      if (propRes.status === 'fulfilled' && propRes.value.property) {
        setProperty(propRes.value.property as any);
      }
      if (docsRes.status === 'fulfilled' && docsRes.value.documents) {
        setDocuments(docsRes.value.documents);
      }
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value.items) {
        setPayments(paymentsRes.value.items);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os detalhes do contrato.');
    } finally {
      setLoading(false);
    }
  }, [id, api]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleTerminate = async () => {
    if (!contract || contract.status !== 'active') return;
    const confirmed = window.confirm(
      `Tem certeza que deseja rescindir o contrato "${contract.contractNumber}"? O imóvel voltará para o status selecionado.`,
    );
    if (!confirmed) return;

    setTerminating(true);
    setNotice(null);
    try {
      const { contract: updated } = await api.terminateContract(contract.id, 'published');
      setContract(updated);
      setNotice({
        tone: 'success',
        text: `Contrato "${updated.contractNumber}" rescindido com sucesso. O imóvel foi retornado para o catálogo.`,
      });
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof ApiError ? err.message : 'Falha ao rescindir contrato. Tente novamente.',
      });
    } finally {
      setTerminating(false);
    }
  };

  const handleGenerateAllPayments = async () => {
    if (!contract) return;
    setGeneratingPayments(true);
    setNotice(null);
    try {
      if (api.generateAllContractPayments) {
        const res = await api.generateAllContractPayments(contract.id);
        setPayments(res.payments);
        setNotice({
          tone: 'success',
          text: `Cobranças sincronizadas com sucesso! Total de ${res.payments.length} cobranças para a vigência do contrato.`,
        });
      } else {
        await loadAll();
      }
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof ApiError ? err.message : 'Falha ao sincronizar cobranças do contrato.',
      });
    } finally {
      setGeneratingPayments(false);
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const counts = useMemo(() => {
    let pending = 0;
    let paid = 0;
    let forwarded = 0;
    let overdue = 0;

    for (const p of payments) {
      if (p.forwardedAt) {
        forwarded++;
      }
      if (p.paidAt) {
        if (!p.forwardedAt) paid++;
      } else {
        pending++;
        if (p.dueDate < todayStr) {
          overdue++;
        }
      }
    }

    return { total: payments.length, pending, paid, forwarded, overdue };
  }, [payments, todayStr]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (paymentFilter === 'all') return true;
      if (paymentFilter === 'forwarded') return Boolean(p.forwardedAt);
      if (paymentFilter === 'paid') return Boolean(p.paidAt && !p.forwardedAt);
      if (paymentFilter === 'pending') return !p.paidAt;
      if (paymentFilter === 'overdue') return !p.paidAt && p.dueDate < todayStr;
      return true;
    });
  }, [payments, paymentFilter, todayStr]);

  if (loading) {
    return (
      <div className="panel-state" role="status">
        <RefreshCw className="spin" aria-hidden="true" />
        <h2>Carregando detalhes do contrato...</h2>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="panel-state panel-state-error">
        <AlertCircle aria-hidden="true" />
        <h2>Erro ao abrir contrato</h2>
        <p>{error ?? 'Contrato não encontrado.'}</p>
        <Link to="/contratos" className="button button-secondary">
          Voltar para lista de contratos
        </Link>
      </div>
    );
  }

  return (
    <div className="page-stack">
      {/* Header and Back navigation */}
      <div className="page-heading-actions">
        <div className="page-heading">
          <Link
            to="/contratos"
            className="text-link"
            style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} aria-hidden="true" />
            Voltar para lista de contratos
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className={`status-badge ${statusBadgeClass[contract.status]}`}>
              {statusLabel[contract.status]}
            </span>
            <p className="eyebrow" style={{ margin: 0 }}>
              Contrato de Locação
            </p>
          </div>
          <h1 style={{ marginTop: '4px' }}>{contract.contractNumber}</h1>
          <p>Visão 360 do contrato: dados das partes, encargos financeiros, documentos e pagamentos.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {contract.status === 'active' ? (
            <button
              type="button"
              className="button button-secondary"
              style={{ color: 'var(--admin-danger)', borderColor: 'var(--admin-danger)' }}
              disabled={terminating}
              onClick={handleTerminate}
            >
              <Power aria-hidden="true" />
              <span>{terminating ? 'Rescindindo...' : 'Rescindir contrato'}</span>
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p className={notice.tone === 'success' ? 'form-notice' : 'form-alert'} role="alert">
          {notice.text}
        </p>
      ) : null}

      {/* Grid of Sections: 360 View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Card 1: Landlord */}
        <section className="content-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <User style={{ width: '20px', height: '20px', color: 'var(--admin-primary)' }} aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: '18px' }}>Locador (Proprietário)</h2>
          </div>
          {landlord ? (
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>{landlord.fullName}</h3>
              <dl className="property-meta" style={{ display: 'grid', gap: '8px' }}>
                {landlord.cpf ? (
                  <div>
                    <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>CPF</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{landlord.cpf}</dd>
                  </div>
                ) : null}
                {landlord.email ? (
                  <div>
                    <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>E-mail</dt>
                    <dd style={{ margin: 0 }}>
                      <a href={`mailto:${landlord.email}`} className="text-link">
                        {landlord.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {landlord.phone ? (
                  <div>
                    <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Telefone / WhatsApp</dt>
                    <dd style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{landlord.phone}</span>
                      <a
                        href={`https://wa.me/55${landlord.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link"
                        title="Abrir no WhatsApp"
                      >
                        <MessageCircle style={{ width: '15px', height: '15px' }} aria-hidden="true" />
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div style={{ marginTop: '14px' }}>
                <Link to={`/pessoas/${landlord.id}/editar`} className="text-link" style={{ fontSize: '13px' }}>
                  Ver cadastro completo do locador →
                </Link>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--admin-text-muted)' }}>ID: {contract.landlordId}</p>
          )}
        </section>

        {/* Card 2: Tenant */}
        <section className="content-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Users style={{ width: '20px', height: '20px', color: 'var(--admin-primary)' }} aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: '18px' }}>Locatário (Inquilino)</h2>
          </div>
          {tenant ? (
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>{tenant.fullName}</h3>
              <dl className="property-meta" style={{ display: 'grid', gap: '8px' }}>
                {tenant.cpf ? (
                  <div>
                    <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>CPF</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{tenant.cpf}</dd>
                  </div>
                ) : null}
                {tenant.email ? (
                  <div>
                    <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>E-mail</dt>
                    <dd style={{ margin: 0 }}>
                      <a href={`mailto:${tenant.email}`} className="text-link">
                        {tenant.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {tenant.phone ? (
                  <div>
                    <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Telefone / WhatsApp</dt>
                    <dd style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{tenant.phone}</span>
                      <a
                        href={`https://wa.me/55${tenant.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link"
                        title="Abrir no WhatsApp"
                      >
                        <MessageCircle style={{ width: '15px', height: '15px' }} aria-hidden="true" />
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div style={{ marginTop: '14px' }}>
                <Link to={`/pessoas/${tenant.id}/editar`} className="text-link" style={{ fontSize: '13px' }}>
                  Ver cadastro completo do locatário →
                </Link>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--admin-text-muted)' }}>ID: {contract.tenantId}</p>
          )}
        </section>

        {/* Card 3: Property */}
        <section className="content-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Building2 style={{ width: '20px', height: '20px', color: 'var(--admin-primary)' }} aria-hidden="true" />
            <h2 style={{ margin: 0, fontSize: '18px' }}>Imóvel Alugado</h2>
          </div>
          {property ? (
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>{property.title}</h3>
              <dl className="property-meta" style={{ display: 'grid', gap: '8px' }}>
                <div>
                  <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Referência</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{property.reference || property.publicId}</dd>
                </div>
                <div>
                  <dt style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Localização</dt>
                  <dd style={{ margin: 0 }}>
                    {[property.location?.district, property.location?.city, property.location?.state]
                      .filter(Boolean)
                      .join(', ')}
                  </dd>
                </div>
              </dl>
              <div style={{ marginTop: '14px' }}>
                <Link to={`/imoveis/${property.id}/editar`} className="text-link" style={{ fontSize: '13px' }}>
                  Ver cadastro do imóvel →
                </Link>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--admin-text-muted)' }}>ID: {contract.propertyId}</p>
          )}
        </section>
      </div>

      {/* Financial & Terms Details */}
      <section className="content-card" style={{ padding: '24px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign aria-hidden="true" />
          <span>Valores, Prazos e Encargos</span>
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Aluguel Mensal</span>
            <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700 }}>
              {formatCurrency(contract.rentAmount)}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Vencimento do Aluguel</span>
            <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 600 }}>
              Dia {contract.rentDueDay} de cada mês
            </p>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Início do Contrato</span>
            <p style={{ margin: '4px 0 0', fontSize: '16px' }}>{formatDate(contract.startDate)}</p>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Término do Contrato</span>
            <p style={{ margin: '4px 0 0', fontSize: '16px' }}>{formatDate(contract.endDate)}</p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--admin-border)',
          }}
        >
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Índice de Reajuste</span>
            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{contract.adjustmentIndex || 'Não informado'}</p>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Percentual de Reajuste</span>
            <p style={{ margin: '4px 0 0' }}>
              {contract.adjustmentPercentage !== undefined ? `${contract.adjustmentPercentage}%` : '—'}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Próximo Reajuste</span>
            <p style={{ margin: '4px 0 0' }}>{formatDate(contract.adjustmentDate)}</p>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Caução / Garantia</span>
            <p style={{ margin: '4px 0 0' }}>{formatCurrency(contract.depositAmount)}</p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            paddingTop: '16px',
            marginTop: '16px',
            borderTop: '1px solid var(--admin-border)',
          }}
        >
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Condomínio</span>
            <p style={{ margin: '4px 0 0' }}>{formatCurrency(contract.condominiumAmount)}</p>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
              IPTU ({contract.iptuMode === 'total' ? 'Total' : 'Parcelado'})
            </span>
            <p style={{ margin: '4px 0 0' }}>
              {formatCurrency(contract.iptuAmount)}
              {contract.iptuDueDay ? ` (Venc. dia ${contract.iptuDueDay})` : ''}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Seguro Incêndio</span>
            <p style={{ margin: '4px 0 0' }}>
              {formatCurrency(contract.fireInsuranceAmount)}
              {contract.fireInsuranceDueDay ? ` (Venc. dia ${contract.fireInsuranceDueDay})` : ''}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Água / Saneamento</span>
            <p style={{ margin: '4px 0 0' }}>
              {formatCurrency(contract.waterAmount)}
              {contract.waterDueDay ? ` (Venc. dia ${contract.waterDueDay})` : ''}
            </p>
          </div>
        </div>

        {contract.notes ? (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--admin-border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Observações Internas</span>
            <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontSize: '14px' }}>{contract.notes}</p>
          </div>
        ) : null}
      </section>

      {/* Documents Section */}
      <section className="content-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText aria-hidden="true" />
            <span>Documentos e Anexos ({documents.length})</span>
          </h2>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setUploadModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Plus style={{ width: '16px', height: '16px' }} aria-hidden="true" />
            <span>Anexar Documento / PDF</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0', textAlign: 'center' }}>
            <FileText aria-hidden="true" style={{ width: '32px', height: '32px', opacity: 0.5, margin: '0 auto 8px' }} />
            <p style={{ margin: '0 0 12px' }}>Nenhum documento anexado a este contrato ainda.</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setUploadModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
            >
              <Upload style={{ width: '15px', height: '15px' }} aria-hidden="true" />
              <span>Anexar contrato assinado, vistoria ou aditivo</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'var(--admin-surface-muted)',
                  borderRadius: 'var(--admin-radius-sm)',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="status-badge" style={{ fontSize: '11px' }}>
                      {documentCategoryLabel[doc.category] || doc.category}
                    </span>
                    <strong>{doc.filename}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
                    {formatBytes(doc.byteSize)} · Enviado em {formatDate(doc.uploadedAt)}
                    {doc.description ? ` · ${doc.description}` : ''}
                  </div>
                </div>

                <div>
                  <a
                    href={`/api/admin/rentals/documents/${doc.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payments History / Timeline */}
      <section className="content-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock aria-hidden="true" />
              <span>Lançamentos Financeiros da Vigência ({payments.length})</span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--admin-text-muted)' }}>
              Cobranças de aluguel e encargos. Registre pagamentos antecipadamente ou no vencimento e dê baixa nos repasses ao proprietário.
            </p>
          </div>
          <button
            type="button"
            className="button button-secondary"
            disabled={generatingPayments}
            onClick={handleGenerateAllPayments}
            title="Gera cobranças para todos os meses do contrato caso ainda não existam"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <RefreshCw className={generatingPayments ? 'spin' : ''} style={{ width: '15px', height: '15px' }} aria-hidden="true" />
            <span>{generatingPayments ? 'Sincronizando...' : 'Gerar / Sincronizar Cobranças da Vigência'}</span>
          </button>
        </div>

        {/* Filter chips */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className={`button ${paymentFilter === 'all' ? 'button-primary' : 'button-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '20px' }}
            onClick={() => setPaymentFilter('all')}
          >
            Todos ({counts.total})
          </button>
          <button
            type="button"
            className={`button ${paymentFilter === 'pending' ? 'button-primary' : 'button-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '20px' }}
            onClick={() => setPaymentFilter('pending')}
          >
            Aguardando Pagamento ({counts.pending})
          </button>
          <button
            type="button"
            className={`button ${paymentFilter === 'paid' ? 'button-primary' : 'button-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '20px' }}
            onClick={() => setPaymentFilter('paid')}
          >
            Pagos / Aguardando Repasse ({counts.paid})
          </button>
          <button
            type="button"
            className={`button ${paymentFilter === 'forwarded' ? 'button-primary' : 'button-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '20px' }}
            onClick={() => setPaymentFilter('forwarded')}
          >
            Repassados ao Locador ({counts.forwarded})
          </button>
          {counts.overdue > 0 && (
            <button
              type="button"
              className={`button ${paymentFilter === 'overdue' ? 'button-primary' : 'button-secondary'}`}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '20px',
                color: paymentFilter === 'overdue' ? undefined : 'var(--admin-danger)',
                borderColor: 'var(--admin-danger)',
              }}
              onClick={() => setPaymentFilter('overdue')}
            >
              Vencidos ({counts.overdue})
            </button>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0', textAlign: 'center' }}>
            <Clock aria-hidden="true" style={{ width: '32px', height: '32px', opacity: 0.5, margin: '0 auto 8px' }} />
            <p style={{ margin: '0 0 12px' }}>Nenhum lançamento financeiro gerado para este contrato ainda.</p>
            <button
              type="button"
              className="button button-primary"
              disabled={generatingPayments}
              onClick={handleGenerateAllPayments}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
            >
              <RefreshCw className={generatingPayments ? 'spin' : ''} style={{ width: '15px', height: '15px' }} aria-hidden="true" />
              <span>Gerar cobranças de toda a vigência</span>
            </button>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--admin-text-muted)' }}>Nenhum lançamento com este filtro.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {filteredPayments.map((pmt) => {
              const isOverdue = !pmt.paidAt && pmt.dueDate < todayStr;
              return (
                <div
                  key={pmt.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    border: '1px solid var(--admin-border)',
                    borderRadius: 'var(--admin-radius-sm)',
                    backgroundColor: pmt.paidAt ? 'var(--admin-surface)' : 'var(--admin-surface-muted)',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong>Mês {pmt.referenceMonth}</strong>
                      <span className="status-badge" style={{ fontSize: '11px' }}>
                        {paymentCategoryLabel[pmt.category] || pmt.category}
                      </span>
                      {pmt.forwardedAt ? (
                        <span className="status-badge status-published" style={{ fontSize: '11px' }}>
                          Repassado
                        </span>
                      ) : pmt.paidAt ? (
                        <span
                          className="status-badge"
                          style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af' }}
                        >
                          Pago pelo Inquilino
                        </span>
                      ) : isOverdue ? (
                        <span className="status-badge status-inactive" style={{ fontSize: '11px' }}>
                          Vencido
                        </span>
                      ) : (
                        <span className="status-badge status-draft" style={{ fontSize: '11px' }}>
                          Aguardando Pagamento
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--admin-text-muted)',
                        marginTop: '4px',
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>
                        Vencimento: <strong>{formatDate(pmt.dueDate)}</strong>
                      </span>
                      {pmt.paidAt ? <span>Pago em: {formatDate(pmt.paidAt)}</span> : null}
                      {pmt.forwardedAt ? <span>Repassado em: {formatDate(pmt.forwardedAt)}</span> : null}
                    </div>
                    {(pmt.paidReceiptId || pmt.forwardedReceiptId) && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {pmt.paidReceiptId && (
                          <a
                            href={`/api/admin/rentals/documents/${pmt.paidReceiptId}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-link"
                            style={{
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Download style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                            Comprovante Pagamento
                          </a>
                        )}
                        {pmt.forwardedReceiptId && (
                          <a
                            href={`/api/admin/rentals/documents/${pmt.forwardedReceiptId}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-link"
                            style={{
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Download style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                            Comprovante Repasse
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '16px' }}>{formatCurrency(pmt.amount)}</strong>
                    </div>
                    <div>
                      {!pmt.paidAt ? (
                        <button
                          type="button"
                          className="button button-primary"
                          style={{ padding: '6px 12px', fontSize: '13px' }}
                          onClick={() => {
                            setSelectedPayment(pmt);
                            setPaymentModalOpen(true);
                          }}
                        >
                          Dar baixa em boleto
                        </button>
                      ) : !pmt.forwardedAt ? (
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            borderColor: 'var(--admin-primary)',
                            color: 'var(--admin-primary)',
                          }}
                          onClick={() => {
                            setSelectedPayment(pmt);
                            setForwardingModalOpen(true);
                          }}
                        >
                          Dar baixa em repasse
                        </button>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            color: 'var(--admin-success, #16a34a)',
                            fontWeight: 600,
                          }}
                        >
                          <CheckCircle2 style={{ width: '16px', height: '16px' }} aria-hidden="true" />
                          Concluído
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modals */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        contractId={contract.id}
        contractNumber={contract.contractNumber}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={(doc) => {
          setDocuments((prev) => [doc, ...prev]);
          setNotice({ tone: 'success', text: `Documento "${doc.filename}" anexado com sucesso!` });
        }}
        api={api}
      />

      <PaymentModal
        isOpen={paymentModalOpen}
        payment={selectedPayment}
        contractNumber={contract.contractNumber}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedPayment(null);
        }}
        onSuccess={(updatedPmt) => {
          setPayments((prev) => prev.map((p) => (p.id === updatedPmt.id ? updatedPmt : p)));
          setNotice({
            tone: 'success',
            text: `Pagamento de ${paymentCategoryLabel[updatedPmt.category] || updatedPmt.category} (Mês ${updatedPmt.referenceMonth}) registrado com sucesso!`,
          });
          loadAll();
        }}
        api={api}
      />

      <ForwardingModal
        isOpen={forwardingModalOpen}
        payment={selectedPayment}
        contractNumber={contract.contractNumber}
        onClose={() => {
          setForwardingModalOpen(false);
          setSelectedPayment(null);
        }}
        onSuccess={(updatedPmt) => {
          setPayments((prev) => prev.map((p) => (p.id === updatedPmt.id ? updatedPmt : p)));
          setNotice({
            tone: 'success',
            text: `Repasse de ${paymentCategoryLabel[updatedPmt.category] || updatedPmt.category} (Mês ${updatedPmt.referenceMonth}) registrado com sucesso!`,
          });
          loadAll();
        }}
        api={api}
      />
    </div>
  );
};
