import { AlertCircle, ChevronLeft, ChevronRight, Edit2, FileText, Heart, Mail, MapPin, Phone, Plus, RefreshCw, Search, Trash2, User, Users } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi, ApiError, type PeopleAdminApi } from '../api/client.ts';
import type { PersonDto } from '../../../shared/rentalSchema.ts';

const PAGE_SIZE = 20;

export const PeopleList = ({ api = adminApi }: { api?: PeopleAdminApi }) => {
  const [params, setParams] = useSearchParams();
  const searchParam = params.get('search') ?? '';
  const pageParam = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);

  const [searchTerm, setSearchTerm] = useState(searchParam);
  const [items, setItems] = useState<PersonDto[]>([]);
  const [pagination, setPagination] = useState({ page: pageParam, total: 0, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchPeople = useCallback(async (search: string, page: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listPeople({
        search: search.trim() || undefined,
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
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a lista de pessoas.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchPeople(searchParam, pageParam);
  }, [fetchPeople, searchParam, pageParam]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new window.FormData(e.currentTarget);
    const queryText = String(data.get('search') ?? searchTerm ?? '').trim();
    const next = new URLSearchParams(params);
    if (queryText) {
      next.set('search', queryText);
    } else {
      next.delete('search');
    }
    next.set('page', '1');
    setParams(next);
  };

  const handlePageChange = (newPage: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(newPage));
    setParams(next);
  };

  const handleDelete = async (person: PersonDto) => {
    const confirmed = window.confirm(`Tem certeza que deseja excluir "${person.fullName}"?`);
    if (!confirmed) return;

    setBusyId(person.id);
    setNotice(null);
    try {
      await api.deletePerson(person.id);
      setNotice({ tone: 'success', text: `Pessoa "${person.fullName}" excluída com sucesso.` });
      await fetchPeople(searchParam, pageParam);
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof ApiError ? err.message : 'Falha ao excluir pessoa. Ela pode estar vinculada a contratos ativos.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <div className="page-stack">
      <div className="page-heading-actions">
        <div className="page-heading">
          <p className="eyebrow">Locadores e Locatários</p>
          <h1>Pessoas</h1>
          <p>Cadastre e gerencie locadores, locatários e seus respectivos contatos.</p>
        </div>
        <Link to="/pessoas/novo" className="button button-primary">
          <Plus aria-hidden="true" />
          <span>Nova pessoa</span>
        </Link>
      </div>

      {notice ? (
        <p className={notice.tone === 'success' ? 'form-notice' : 'form-alert'} role="alert">
          {notice.text}
        </p>
      ) : null}

      <div className="content-card">
        <form onSubmit={handleSearchSubmit} className="filters-form" role="search">
          <div className="filter-actions" style={{ gridTemplateColumns: '1fr auto auto', alignItems: 'center' }}>
            <div className="input-with-icon">
              <Search aria-hidden="true" />
              <input
                type="search"
                name="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, CPF, e-mail ou telefone..."
                aria-label="Buscar pessoas"
              />
            </div>
            <button type="submit" className="button button-secondary">
              Buscar
            </button>
            {searchParam ? (
              <button
                type="button"
                className="button button-quiet"
                onClick={() => {
                  setSearchTerm('');
                  const next = new URLSearchParams(params);
                  next.delete('search');
                  next.set('page', '1');
                  setParams(next);
                }}
              >
                Limpar
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {loading ? (
        <div className="panel-state">
          <RefreshCw className="spin" aria-hidden="true" />
          <h2>Carregando pessoas...</h2>
        </div>
      ) : error ? (
        <div className="panel-state panel-state-error">
          <AlertCircle aria-hidden="true" />
          <h2>Erro ao carregar pessoas</h2>
          <p>{error}</p>
          <button type="button" className="button button-secondary" onClick={() => fetchPeople(searchParam, pageParam)}>
            Tentar novamente
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <Users aria-hidden="true" />
          <h2>Nenhuma pessoa encontrada</h2>
          <p>
            {searchParam
              ? `Não foram encontrados resultados para "${searchParam}".`
              : 'Ainda não há nenhuma pessoa cadastrada.'}
          </p>
          {searchParam ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setSearchTerm('');
                const next = new URLSearchParams(params);
                next.delete('search');
                setParams(next);
              }}
            >
              Ver todas as pessoas
            </button>
          ) : (
            <Link to="/pessoas/novo" className="button button-primary">
              <Plus aria-hidden="true" />
              Cadastrar primeira pessoa
            </Link>
          )}
        </div>
      ) : (
        <div className="property-results">
          <div className="results-heading">
            <h2>Pessoas cadastradas ({pagination.total})</h2>
            <span>
              Página {pagination.page} de {totalPages}
            </span>
          </div>

          <div className="property-card-list" style={{ display: 'grid', gap: '16px' }}>
            {items.map((person) => (
              <article key={person.id} className="content-card" style={{ padding: '20px', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700 }}>
                      {person.fullName}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', color: 'var(--admin-text-muted)', fontSize: '13px' }}>
                      {person.cpf ? (
                        <span>
                          <strong>CPF:</strong> {person.cpf}
                        </span>
                      ) : null}
                      {person.email ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Mail style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                          {person.email}
                        </span>
                      ) : null}
                      {person.phone ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Phone style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                          {person.phone}
                        </span>
                      ) : null}
                      {person.birthDate ? (
                        <span>
                          <strong>Nasc.:</strong> {person.birthDate}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Link
                      to={`/pessoas/${person.id}/editar`}
                      className="button button-secondary"
                      style={{ minHeight: '38px', padding: '6px 14px', fontSize: '13px' }}
                    >
                      <Edit2 style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                      Editar
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === person.id}
                      onClick={() => handleDelete(person)}
                      className="button button-quiet"
                      style={{ minHeight: '38px', padding: '6px 14px', fontSize: '13px', color: 'var(--admin-danger)' }}
                    >
                      <Trash2 style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                      Excluir
                    </button>
                  </div>
                </div>

                {person.address ? (
                  <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--admin-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin style={{ width: '14px', height: '14px', flexShrink: 0 }} aria-hidden="true" />
                    <span>{person.address}</span>
                  </div>
                ) : null}

                {person.spouseName ? (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--admin-surface-muted)', borderRadius: 'var(--admin-radius-sm)', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <Heart style={{ width: '14px', height: '14px', color: 'var(--admin-accent)' }} aria-hidden="true" />
                      <span>Cônjuge: {person.spouseName}</span>
                      {person.spouseCpf ? <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>({person.spouseCpf})</span> : null}
                    </div>
                    {(person.spousePhone || person.spouseBirthDate) ? (
                      <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--admin-text-muted)', display: 'flex', gap: '12px' }}>
                        {person.spousePhone ? <span>Tel: {person.spousePhone}</span> : null}
                        {person.spouseBirthDate ? <span>Nasc: {person.spouseBirthDate}</span> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {person.notes ? (
                  <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--admin-text-muted)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <FileText style={{ width: '14px', height: '14px', marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
                    <span>{person.notes}</span>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          {totalPages > 1 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                className="button button-secondary"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                <ChevronLeft aria-hidden="true" />
                Anterior
              </button>
              <span style={{ fontSize: '14px', color: 'var(--admin-text-muted)' }}>
                {pagination.page} de {totalPages}
              </span>
              <button
                type="button"
                className="button button-secondary"
                disabled={pagination.page >= totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Próxima
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
