import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  DollarSign,
  FileCheck,
  Home,
  RefreshCw,
  Save,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  adminApi,
  ApiError,
  type AdminPropertySummaryDto,
  type PeopleAdminApi,
  type PropertyAdminApi,
  type RentalAdminApi,
} from '../api/client.ts';
import {
  ADJUSTMENT_INDEXES,
  createRentalContractSchema,
  IPTU_MODES,
  type CreateRentalContractInput,
  type PersonDto,
} from '../../../shared/rentalSchema.ts';

interface ContractEditorProps {
  api?: RentalAdminApi & Partial<PropertyAdminApi> & Partial<PeopleAdminApi>;
}

interface ContractFormState {
  contractNumber: string;
  propertyId: string;
  landlordId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  adjustmentDate: string;
  adjustmentIndex: string;
  adjustmentPercentage: string;
  rentAmount: string;
  depositAmount: string;
  condominiumAmount: string;
  iptuAmount: string;
  iptuNumber: string;
  iptuMode: 'total' | 'parcelado';
  fireInsuranceAmount: string;
  waterAmount: string;
  maintenanceAmount: string;
  rentDueDay: string;
  waterDueDay: string;
  iptuDueDay: string;
  fireInsuranceDueDay: string;
  notes: string;
}

const initialFormState: ContractFormState = {
  contractNumber: '',
  propertyId: '',
  landlordId: '',
  tenantId: '',
  startDate: '',
  endDate: '',
  adjustmentDate: '',
  adjustmentIndex: 'IGP-M',
  adjustmentPercentage: '',
  rentAmount: '',
  depositAmount: '',
  condominiumAmount: '',
  iptuAmount: '',
  iptuNumber: '',
  iptuMode: 'total',
  fireInsuranceAmount: '',
  waterAmount: '',
  maintenanceAmount: '',
  rentDueDay: '10',
  waterDueDay: '',
  iptuDueDay: '',
  fireInsuranceDueDay: '',
  notes: '',
};

export const ContractEditor = ({ api = adminApi }: ContractEditorProps) => {
  const [searchParams] = useSearchParams();
  const preselectedPropertyId = searchParams.get('propertyId') ?? '';
  const navigate = useNavigate();

  const [formData, setFormData] = useState<ContractFormState>({
    ...initialFormState,
    propertyId: preselectedPropertyId,
  });
  const [properties, setProperties] = useState<AdminPropertySummaryDto[]>([]);
  const [people, setPeople] = useState<PersonDto[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadLookups = async () => {
      setLoadingLookups(true);
      try {
        const [propsRes, peopleRes] = await Promise.allSettled([
          api.listProperties ? api.listProperties({ limit: 100 }) : Promise.resolve({ items: [] }),
          api.listPeople ? api.listPeople({ limit: 100 }) : Promise.resolve({ items: [] }),
        ]);
        if (!active) return;
        if (propsRes.status === 'fulfilled' && propsRes.value?.items) {
          setProperties(propsRes.value.items);
        }
        if (peopleRes.status === 'fulfilled' && peopleRes.value?.items) {
          setPeople(peopleRes.value.items);
        }
      } finally {
        if (active) setLoadingLookups(false);
      }
    };
    loadLookups();
    return () => {
      active = false;
    };
  }, [api]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    const formEl = e.currentTarget;
    const domData = new window.FormData(formEl);

    const getVal = (name: string, fallback: string) =>
      String(domData.get(name) ?? fallback ?? '').trim();

    const parseNumber = (val: string) => {
      if (!val) return undefined;
      const clean = val.replace(',', '.');
      const num = Number(clean);
      return isNaN(num) ? undefined : num;
    };

    const parseIntVal = (val: string) => {
      if (!val) return undefined;
      const num = parseInt(val, 10);
      return isNaN(num) ? undefined : num;
    };

    const rawData = {
      contractNumber: getVal('contractNumber', formData.contractNumber),
      propertyId: getVal('propertyId', formData.propertyId),
      landlordId: getVal('landlordId', formData.landlordId),
      tenantId: getVal('tenantId', formData.tenantId),
      status: 'active' as const,
      startDate: getVal('startDate', formData.startDate),
      endDate: getVal('endDate', formData.endDate),
      adjustmentDate: getVal('adjustmentDate', formData.adjustmentDate) || undefined,
      adjustmentIndex: getVal('adjustmentIndex', formData.adjustmentIndex) || undefined,
      adjustmentPercentage: parseNumber(getVal('adjustmentPercentage', formData.adjustmentPercentage)),
      rentAmount: parseNumber(getVal('rentAmount', formData.rentAmount)),
      depositAmount: parseNumber(getVal('depositAmount', formData.depositAmount)),
      condominiumAmount: parseNumber(getVal('condominiumAmount', formData.condominiumAmount)),
      iptuAmount: parseNumber(getVal('iptuAmount', formData.iptuAmount)),
      iptuNumber: getVal('iptuNumber', formData.iptuNumber) || undefined,
      iptuMode: (getVal('iptuMode', formData.iptuMode) as 'total' | 'parcelado') || 'total',
      fireInsuranceAmount: parseNumber(getVal('fireInsuranceAmount', formData.fireInsuranceAmount)),
      waterAmount: parseNumber(getVal('waterAmount', formData.waterAmount)),
      maintenanceAmount: parseNumber(getVal('maintenanceAmount', formData.maintenanceAmount)),
      rentDueDay: parseIntVal(getVal('rentDueDay', formData.rentDueDay)),
      waterDueDay: parseIntVal(getVal('waterDueDay', formData.waterDueDay)),
      iptuDueDay: parseIntVal(getVal('iptuDueDay', formData.iptuDueDay)),
      fireInsuranceDueDay: parseIntVal(getVal('fireInsuranceDueDay', formData.fireInsuranceDueDay)),
      notes: getVal('notes', formData.notes) || undefined,
    };

    const startDateVal = getVal('startDate', formData.startDate);
    const endDateVal = getVal('endDate', formData.endDate);

    if (startDateVal && endDateVal && endDateVal < startDateVal) {
      setFieldErrors({
        endDate: 'Data de término deve ser posterior ou igual à data de início',
      });
      setGeneralError('Data de término deve ser posterior ou igual à data de início');
      return;
    }

    const parseResult = createRentalContractSchema.safeParse(rawData);

    if (!parseResult.success) {
      const errors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const fieldName = String(issue.path[0] ?? '');
        if (fieldName && !errors[fieldName]) {
          errors[fieldName] = issue.message;
        }
      }
      setFieldErrors(errors);
      const topMessage = parseResult.error.issues[0]?.message ?? 'Por favor, corrija os erros nos campos.';
      setGeneralError(topMessage);
      return;
    }

    setSaving(true);
    try {
      const { contract } = await api.createContract(parseResult.data);
      navigate(`/contratos/${contract.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setGeneralError(err.message);
        if (err.issues?.length) {
          const apiErrors: Record<string, string> = {};
          for (const issue of err.issues) {
            const field = issue.path.replace(/^\//, '');
            apiErrors[field] = issue.message;
          }
          setFieldErrors(apiErrors);
        }
      } else {
        setGeneralError('Ocorreu um erro ao criar o contrato. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
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
          <p className="eyebrow">Novo Contrato</p>
          <h1>Cadastrar Contrato de Locação</h1>
          <p>Associe o imóvel ao locador e locatário, defina valores, garantias e datas de reajuste.</p>
        </div>
      </div>

      {generalError ? (
        <p className="form-alert" role="alert">
          {generalError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="editor-card" noValidate>
        {/* Section 1: Parties & Property */}
        <section className="wizard-fieldset">
          <legend style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Home style={{ width: '18px', height: '18px' }} aria-hidden="true" />
            <span>1. Imóvel e Partes Envolvidas</span>
          </legend>

          <div className="form-row">
            <label className="field">
              <span className="field-label">Número / Identificador do Contrato *</span>
              <input
                type="text"
                name="contractNumber"
                value={formData.contractNumber}
                onChange={handleChange}
                placeholder="Ex: CTR-2026-001"
                aria-invalid={Boolean(fieldErrors.contractNumber)}
                required
              />
              {fieldErrors.contractNumber ? (
                <small className="field-error">{fieldErrors.contractNumber}</small>
              ) : (
                <small className="field-hint">Código único de referência deste contrato.</small>
              )}
            </label>

            <label className="field">
              <span className="field-label">Imóvel *</span>
              <select
                name="propertyId"
                value={formData.propertyId}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.propertyId)}
                required
              >
                <option value="">Selecione o imóvel...</option>
                {formData.propertyId && !properties.some((p) => p.id === formData.propertyId) ? (
                  <option value={formData.propertyId}>{formData.propertyId}</option>
                ) : null}
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.reference ? `[${p.reference}] ` : ''}{p.title}
                  </option>
                ))}
              </select>
              {fieldErrors.propertyId ? (
                <small className="field-error">{fieldErrors.propertyId}</small>
              ) : null}
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              <span className="field-label">Locador (Proprietário) *</span>
              <select
                name="landlordId"
                value={formData.landlordId}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.landlordId)}
                required
              >
                <option value="">Selecione o locador...</option>
                {formData.landlordId && !people.some((p) => p.id === formData.landlordId) ? (
                  <option value={formData.landlordId}>{formData.landlordId}</option>
                ) : null}
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName} {person.cpf ? `(${person.cpf})` : ''}
                  </option>
                ))}
              </select>
              {fieldErrors.landlordId ? (
                <small className="field-error">{fieldErrors.landlordId}</small>
              ) : null}
            </label>

            <label className="field">
              <span className="field-label">Locatário (Inquilino) *</span>
              <select
                name="tenantId"
                value={formData.tenantId}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.tenantId)}
                required
              >
                <option value="">Selecione o locatário...</option>
                {formData.tenantId && !people.some((p) => p.id === formData.tenantId) ? (
                  <option value={formData.tenantId}>{formData.tenantId}</option>
                ) : null}
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName} {person.cpf ? `(${person.cpf})` : ''}
                  </option>
                ))}
              </select>
              {fieldErrors.tenantId ? (
                <small className="field-error">{fieldErrors.tenantId}</small>
              ) : null}
            </label>
          </div>
        </section>

        {/* Section 2: Dates & Adjustment */}
        <section className="wizard-fieldset">
          <legend style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar style={{ width: '18px', height: '18px' }} aria-hidden="true" />
            <span>2. Vigência e Reajuste</span>
          </legend>

          <div className="form-row">
            <label className="field">
              <span className="field-label">Data de Início *</span>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.startDate)}
                required
              />
              {fieldErrors.startDate ? (
                <small className="field-error">{fieldErrors.startDate}</small>
              ) : null}
            </label>

            <label className="field">
              <span className="field-label">Data de Término *</span>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.endDate)}
                required
              />
              {fieldErrors.endDate ? (
                <small className="field-error">{fieldErrors.endDate}</small>
              ) : null}
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              <span className="field-label">Próxima Data de Reajuste</span>
              <input
                type="date"
                name="adjustmentDate"
                value={formData.adjustmentDate}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.adjustmentDate)}
              />
              {fieldErrors.adjustmentDate ? (
                <small className="field-error">{fieldErrors.adjustmentDate}</small>
              ) : null}
            </label>

            <label className="field">
              <span className="field-label">Índice de Reajuste</span>
              <select
                name="adjustmentIndex"
                value={formData.adjustmentIndex}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.adjustmentIndex)}
              >
                {ADJUSTMENT_INDEXES.map((idx) => (
                  <option key={idx} value={idx}>
                    {idx}
                  </option>
                ))}
              </select>
              {fieldErrors.adjustmentIndex ? (
                <small className="field-error">{fieldErrors.adjustmentIndex}</small>
              ) : null}
            </label>

            <label className="field">
              <span className="field-label">Percentual de Reajuste (%)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                name="adjustmentPercentage"
                value={formData.adjustmentPercentage}
                onChange={handleChange}
                placeholder="Ex: 5.5"
                aria-invalid={Boolean(fieldErrors.adjustmentPercentage)}
              />
              {fieldErrors.adjustmentPercentage ? (
                <small className="field-error">{fieldErrors.adjustmentPercentage}</small>
              ) : null}
            </label>
          </div>
        </section>

        {/* Section 3: Financial & Charges */}
        <section className="wizard-fieldset">
          <legend style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign style={{ width: '18px', height: '18px' }} aria-hidden="true" />
            <span>3. Valores e Vencimento</span>
          </legend>

          <div className="form-row">
            <label className="field">
              <span className="field-label">Valor do Aluguel (R$) *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="rentAmount"
                value={formData.rentAmount}
                onChange={handleChange}
                placeholder="Ex: 3500"
                aria-invalid={Boolean(fieldErrors.rentAmount)}
                required
              />
              {fieldErrors.rentAmount ? (
                <small className="field-error">{fieldErrors.rentAmount}</small>
              ) : null}
            </label>

            <label className="field">
              <span className="field-label">Dia do Vencimento do Aluguel (1 a 31) *</span>
              <input
                type="number"
                min="1"
                max="31"
                name="rentDueDay"
                value={formData.rentDueDay}
                onChange={handleChange}
                placeholder="10"
                aria-invalid={Boolean(fieldErrors.rentDueDay)}
                required
              />
              {fieldErrors.rentDueDay ? (
                <small className="field-error">{fieldErrors.rentDueDay}</small>
              ) : null}
            </label>

            <label className="field">
              <span className="field-label">Caução / Depósito Garantia (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="depositAmount"
                value={formData.depositAmount}
                onChange={handleChange}
                placeholder="Ex: 10500"
                aria-invalid={Boolean(fieldErrors.depositAmount)}
              />
              {fieldErrors.depositAmount ? (
                <small className="field-error">{fieldErrors.depositAmount}</small>
              ) : null}
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              <span className="field-label">Condomínio (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="condominiumAmount"
                value={formData.condominiumAmount}
                onChange={handleChange}
                placeholder="Ex: 600"
                aria-invalid={Boolean(fieldErrors.condominiumAmount)}
              />
              {fieldErrors.condominiumAmount ? (
                <small className="field-error">{fieldErrors.condominiumAmount}</small>
              ) : null}
            </label>

            <label className="field">
              <span className="field-label">Valor IPTU (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="iptuAmount"
                value={formData.iptuAmount}
                onChange={handleChange}
                placeholder="Ex: 180"
                aria-invalid={Boolean(fieldErrors.iptuAmount)}
              />
              {fieldErrors.iptuAmount ? (
                <small className="field-error">{fieldErrors.iptuAmount}</small>
              ) : null}
            </label>

            <label className="field">
              <span className="field-label">Modo IPTU</span>
              <select
                name="iptuMode"
                value={formData.iptuMode}
                onChange={handleChange}
              >
                {IPTU_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === 'total' ? 'Valor Total' : 'Parcelado'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              <span className="field-label">Inscrição Municipal IPTU</span>
              <input
                type="text"
                name="iptuNumber"
                value={formData.iptuNumber}
                onChange={handleChange}
                placeholder="Ex: 1234567-8"
              />
            </label>

            <label className="field">
              <span className="field-label">Dia Vencimento IPTU (1 a 31)</span>
              <input
                type="number"
                min="1"
                max="31"
                name="iptuDueDay"
                value={formData.iptuDueDay}
                onChange={handleChange}
                placeholder="Ex: 15"
              />
            </label>

            <label className="field">
              <span className="field-label">Seguro Incêndio (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="fireInsuranceAmount"
                value={formData.fireInsuranceAmount}
                onChange={handleChange}
                placeholder="Ex: 75"
              />
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              <span className="field-label">Dia Vencimento Seguro Incêndio</span>
              <input
                type="number"
                min="1"
                max="31"
                name="fireInsuranceDueDay"
                value={formData.fireInsuranceDueDay}
                onChange={handleChange}
                placeholder="Ex: 20"
              />
            </label>

            <label className="field">
              <span className="field-label">Água (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="waterAmount"
                value={formData.waterAmount}
                onChange={handleChange}
                placeholder="Ex: 90"
              />
            </label>

            <label className="field">
              <span className="field-label">Dia Vencimento Água</span>
              <input
                type="number"
                min="1"
                max="31"
                name="waterDueDay"
                value={formData.waterDueDay}
                onChange={handleChange}
                placeholder="Ex: 15"
              />
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              <span className="field-label">Taxa / Fundo de Manutenção (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="maintenanceAmount"
                value={formData.maintenanceAmount}
                onChange={handleChange}
                placeholder="Ex: 50"
              />
            </label>
          </div>
        </section>

        {/* Section 4: Notes */}
        <section className="wizard-fieldset">
          <legend style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCheck style={{ width: '18px', height: '18px' }} aria-hidden="true" />
            <span>4. Observações e Cláusulas Específicas</span>
          </legend>

          <label className="field" style={{ width: '100%' }}>
            <span className="field-label">Observações Internas</span>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Instruções de repasse, condições de vistoria, regras especiais do condomínio..."
            />
          </label>
        </section>

        {/* Form Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <Link to="/contratos" className="button button-secondary">
            Cancelar
          </Link>
          <button
            type="submit"
            className="button button-primary"
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {saving ? (
              <>
                <RefreshCw className="spin" style={{ width: '16px', height: '16px' }} aria-hidden="true" />
                <span>Salvando contrato...</span>
              </>
            ) : (
              <>
                <Save style={{ width: '16px', height: '16px' }} aria-hidden="true" />
                <span>Salvar Contrato</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
