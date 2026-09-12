import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  FileCheck,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Power,
  RefreshCw,
  User,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText aria-hidden="true" />
            <span>Documentos Anexados ({documents.length})</span>
          </h2>
        </div>

        {documents.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <FileText aria-hidden="true" />
            <p style={{ margin: 0 }}>Nenhum documento anexado a este contrato ainda.</p>
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
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    style={{ padding: '6px 12px', fontSize: '12px' }}
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
        <h2 style={{ margin: '0 0 16px', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock aria-hidden="true" />
          <span>Histórico de Pagamentos e Repasses ({payments.length})</span>
        </h2>

        {payments.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <Clock aria-hidden="true" />
            <p style={{ margin: 0 }}>Nenhum lançamento financeiro gerado para este contrato ainda.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {payments.map((pmt) => (
              <div
                key={pmt.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 'var(--admin-radius-sm)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>Mês {pmt.referenceMonth}</strong>
                    <span className="status-badge" style={{ fontSize: '11px' }}>
                      {paymentCategoryLabel[pmt.category] || pmt.category}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
                    Vencimento: {formatDate(pmt.dueDate)}
                    {pmt.paidAt ? ` · Pago em ${formatDate(pmt.paidAt)}` : ' · Aguardando pagamento'}
                    {pmt.forwardedAt ? ` · Repassado em ${formatDate(pmt.forwardedAt)}` : ''}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '15px' }}>{formatCurrency(pmt.amount)}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
