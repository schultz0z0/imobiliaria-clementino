import { AlertCircle, ArrowLeft, Heart, RefreshCw, Save, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi, ApiError, type PeopleAdminApi } from '../api/client.ts';
import { createPersonSchema, type CreatePersonInput, type PersonDto } from '../../../shared/rentalSchema.ts';

interface PeopleEditorProps {
  mode: 'create' | 'edit';
  api?: PeopleAdminApi;
}

interface FormDataState {
  fullName: string;
  cpf: string;
  birthDate: string;
  email: string;
  phone: string;
  address: string;
  spouseName: string;
  spouseCpf: string;
  spouseBirthDate: string;
  spousePhone: string;
  spouseAddress: string;
  notes: string;
}

const initialFormData: FormDataState = {
  fullName: '',
  cpf: '',
  birthDate: '',
  email: '',
  phone: '',
  address: '',
  spouseName: '',
  spouseCpf: '',
  spouseBirthDate: '',
  spousePhone: '',
  spouseAddress: '',
  notes: '',
};

export const PeopleEditor = ({ mode, api = adminApi }: PeopleEditorProps) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormDataState>(initialFormData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && id) {
      let active = true;
      setLoading(true);
      setGeneralError(null);
      api
        .getPerson(id)
        .then(({ person }) => {
          if (!active) return;
          setFormData({
            fullName: person.fullName ?? '',
            cpf: person.cpf ?? '',
            birthDate: person.birthDate ?? '',
            email: person.email ?? '',
            phone: person.phone ?? '',
            address: person.address ?? '',
            spouseName: person.spouseName ?? '',
            spouseCpf: person.spouseCpf ?? '',
            spouseBirthDate: person.spouseBirthDate ?? '',
            spousePhone: person.spousePhone ?? '',
            spouseAddress: person.spouseAddress ?? '',
            notes: person.notes ?? '',
          });
        })
        .catch((err) => {
          if (!active) return;
          setGeneralError(err instanceof ApiError ? err.message : 'Não foi possível carregar os dados da pessoa.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }
  }, [mode, id, api]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    // Read current form inputs directly to support both controlled and uncontrolled inputs
    const formEl = e.currentTarget;
    const domData = new window.FormData(formEl);

    const rawData = {
      fullName: String(domData.get('fullName') ?? formData.fullName ?? ''),
      cpf: String(domData.get('cpf') ?? formData.cpf ?? ''),
      birthDate: String(domData.get('birthDate') ?? formData.birthDate ?? ''),
      email: String(domData.get('email') ?? formData.email ?? ''),
      phone: String(domData.get('phone') ?? formData.phone ?? ''),
      address: String(domData.get('address') ?? formData.address ?? ''),
      spouseName: String(domData.get('spouseName') ?? formData.spouseName ?? ''),
      spouseCpf: String(domData.get('spouseCpf') ?? formData.spouseCpf ?? ''),
      spouseBirthDate: String(domData.get('spouseBirthDate') ?? formData.spouseBirthDate ?? ''),
      spousePhone: String(domData.get('spousePhone') ?? formData.spousePhone ?? ''),
      spouseAddress: String(domData.get('spouseAddress') ?? formData.spouseAddress ?? ''),
      notes: String(domData.get('notes') ?? formData.notes ?? ''),
    };

    const parseResult = createPersonSchema.safeParse(rawData);

    if (!parseResult.success) {
      const errors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const fieldName = issue.path[0];
        if (fieldName && typeof fieldName === 'string' && !errors[fieldName]) {
          errors[fieldName] = issue.message;
        }
      }
      setFieldErrors(errors);
      setGeneralError('Por favor, corrija os erros nos campos destacados.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        await api.createPerson(parseResult.data);
      } else if (mode === 'edit' && id) {
        await api.updatePerson(id, parseResult.data);
      }
      navigate('/pessoas');
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
        setGeneralError('Ocorreu um erro ao salvar os dados. Tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="panel-state" role="status">
        <RefreshCw className="spin" aria-hidden="true" />
        <h2>Carregando dados da pessoa...</h2>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-heading-actions">
        <div className="page-heading">
          <Link to="/pessoas" className="text-link" style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
            <ArrowLeft style={{ width: '16px', height: '16px' }} aria-hidden="true" />
            Voltar para lista de pessoas
          </Link>
          <p className="eyebrow">{mode === 'create' ? 'Novo Cadastro' : 'Atualização'}</p>
          <h1>{mode === 'create' ? 'Nova Pessoa' : 'Editar Pessoa'}</h1>
          <p>Cadastre os dados pessoais, de contato e do cônjuge para locadores e locatários.</p>
        </div>
      </div>

      {generalError ? (
        <p className="form-alert" role="alert">
          {generalError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="editor-card" noValidate>
        {/* Section 1: Personal Info */}
        <section className="wizard-fieldset">
          <legend style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User style={{ width: '20px', height: '20px', color: 'var(--admin-accent)' }} aria-hidden="true" />
            Dados Pessoais
          </legend>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <div className="field-group">
              <label htmlFor="fullName">
                Nome completo <span style={{ color: 'var(--admin-danger)' }}>*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Ex: João da Silva"
                aria-invalid={!!fieldErrors.fullName}
                aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
              />
              {fieldErrors.fullName ? (
                <span id="fullName-error" className="field-error">
                  {fieldErrors.fullName}
                </span>
              ) : null}
            </div>

            <div className="field-group">
              <label htmlFor="cpf">CPF</label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                value={formData.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                aria-invalid={!!fieldErrors.cpf}
                aria-describedby={fieldErrors.cpf ? 'cpf-error' : undefined}
              />
              {fieldErrors.cpf ? (
                <span id="cpf-error" className="field-error">
                  {fieldErrors.cpf}
                </span>
              ) : null}
            </div>

            <div className="field-group">
              <label htmlFor="birthDate">Data de nascimento</label>
              <input
                id="birthDate"
                name="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={handleChange}
                aria-invalid={!!fieldErrors.birthDate}
                aria-describedby={fieldErrors.birthDate ? 'birthDate-error' : undefined}
              />
              {fieldErrors.birthDate ? (
                <span id="birthDate-error" className="field-error">
                  {fieldErrors.birthDate}
                </span>
              ) : null}
            </div>

            <div className="field-group">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="exemplo@email.com"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
              {fieldErrors.email ? (
                <span id="email-error" className="field-error">
                  {fieldErrors.email}
                </span>
              ) : null}
            </div>

            <div className="field-group">
              <label htmlFor="phone">Telefone / Celular</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
              />
              {fieldErrors.phone ? (
                <span id="phone-error" className="field-error">
                  {fieldErrors.phone}
                </span>
              ) : null}
            </div>
          </div>

          <div className="field-group" style={{ marginTop: '14px' }}>
            <label htmlFor="address">Endereço completo</label>
            <input
              id="address"
              name="address"
              type="text"
              value={formData.address}
              onChange={handleChange}
              placeholder="Rua, número, complemento, bairro, cidade - UF"
              aria-invalid={!!fieldErrors.address}
              aria-describedby={fieldErrors.address ? 'address-error' : undefined}
            />
            {fieldErrors.address ? (
              <span id="address-error" className="field-error">
                {fieldErrors.address}
              </span>
            ) : null}
          </div>
        </section>

        {/* Section 2: Spouse Info */}
        <section className="wizard-fieldset">
          <legend style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heart style={{ width: '20px', height: '20px', color: 'var(--admin-accent)' }} aria-hidden="true" />
            Dados do Cônjuge <small style={{ fontWeight: 'normal', color: 'var(--admin-text-muted)' }}>(Opcional)</small>
          </legend>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <div className="field-group">
              <label htmlFor="spouseName">Nome do cônjuge</label>
              <input
                id="spouseName"
                name="spouseName"
                type="text"
                value={formData.spouseName}
                onChange={handleChange}
                placeholder="Nome completo do cônjuge"
                aria-invalid={!!fieldErrors.spouseName}
                aria-describedby={fieldErrors.spouseName ? 'spouseName-error' : undefined}
              />
              {fieldErrors.spouseName ? (
                <span id="spouseName-error" className="field-error">
                  {fieldErrors.spouseName}
                </span>
              ) : null}
            </div>

            <div className="field-group">
              <label htmlFor="spouseCpf">CPF do cônjuge</label>
              <input
                id="spouseCpf"
                name="spouseCpf"
                type="text"
                value={formData.spouseCpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                aria-invalid={!!fieldErrors.spouseCpf}
                aria-describedby={fieldErrors.spouseCpf ? 'spouseCpf-error' : undefined}
              />
              {fieldErrors.spouseCpf ? (
                <span id="spouseCpf-error" className="field-error">
                  {fieldErrors.spouseCpf}
                </span>
              ) : null}
            </div>

            <div className="field-group">
              <label htmlFor="spouseBirthDate">Data de nascimento do cônjuge</label>
              <input
                id="spouseBirthDate"
                name="spouseBirthDate"
                type="date"
                value={formData.spouseBirthDate}
                onChange={handleChange}
                aria-invalid={!!fieldErrors.spouseBirthDate}
                aria-describedby={fieldErrors.spouseBirthDate ? 'spouseBirthDate-error' : undefined}
              />
              {fieldErrors.spouseBirthDate ? (
                <span id="spouseBirthDate-error" className="field-error">
                  {fieldErrors.spouseBirthDate}
                </span>
              ) : null}
            </div>

            <div className="field-group">
              <label htmlFor="spousePhone">Telefone do cônjuge</label>
              <input
                id="spousePhone"
                name="spousePhone"
                type="tel"
                value={formData.spousePhone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
                aria-invalid={!!fieldErrors.spousePhone}
                aria-describedby={fieldErrors.spousePhone ? 'spousePhone-error' : undefined}
              />
              {fieldErrors.spousePhone ? (
                <span id="spousePhone-error" className="field-error">
                  {fieldErrors.spousePhone}
                </span>
              ) : null}
            </div>
          </div>

          <div className="field-group" style={{ marginTop: '14px' }}>
            <label htmlFor="spouseAddress">Endereço do cônjuge (se diferente)</label>
            <input
              id="spouseAddress"
              name="spouseAddress"
              type="text"
              value={formData.spouseAddress}
              onChange={handleChange}
              placeholder="Rua, número, complemento, bairro, cidade - UF"
              aria-invalid={!!fieldErrors.spouseAddress}
              aria-describedby={fieldErrors.spouseAddress ? 'spouseAddress-error' : undefined}
            />
            {fieldErrors.spouseAddress ? (
              <span id="spouseAddress-error" className="field-error">
                {fieldErrors.spouseAddress}
              </span>
            ) : null}
          </div>
        </section>

        {/* Section 3: Notes */}
        <section className="wizard-fieldset">
          <legend>Observações Gerais</legend>
          <div className="field-group">
            <label htmlFor="notes">Anotações internas</label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Detalhes adicionais, preferências, histórico ou observações sobre esta pessoa..."
              aria-invalid={!!fieldErrors.notes}
              aria-describedby={fieldErrors.notes ? 'notes-error' : undefined}
            />
            {fieldErrors.notes ? (
              <span id="notes-error" className="field-error">
                {fieldErrors.notes}
              </span>
            ) : null}
          </div>
        </section>

        {/* Form Actions */}
        <div className="wizard-actions">
          <Link to="/pessoas" className="button button-quiet">
            Cancelar
          </Link>
          <button type="submit" disabled={saving} className="button button-primary">
            {saving ? <RefreshCw className="spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            <span>{saving ? 'Salvando...' : mode === 'create' ? 'Cadastrar pessoa' : 'Salvar alterações'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
