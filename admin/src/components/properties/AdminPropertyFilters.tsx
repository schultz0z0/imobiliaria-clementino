import { Filter, RotateCcw, Search } from 'lucide-react';
import React from 'react';
import type { PropertyListQuery } from '../../api/client.ts';

export type PropertySort = 'updated-desc' | 'updated-asc' | 'title-asc' | 'title-desc' | 'price-desc' | 'price-asc';

type Props = {
  initialValues: PropertyListQuery;
  sort: PropertySort;
  onApply: (filters: PropertyListQuery) => void;
  onClear: () => void;
  onSort: (sort: PropertySort) => void;
};

const value = (data: FormData, key: string) => String(data.get(key) ?? '').trim();

export const AdminPropertyFilters = ({ initialValues, sort, onApply, onClear, onSort }: Props) => (
  <section className="property-filters" aria-labelledby="property-filters-title">
    <div className="section-title-row">
      <div><p className="eyebrow">Catálogo</p><h2 id="property-filters-title">Encontre um imóvel</h2></div>
      <Filter aria-hidden="true" />
    </div>
    <form
      className="filters-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new window.FormData(event.currentTarget);
        const filters: PropertyListQuery = { page: 1, limit: 100 };
        const search = value(data, 'search');
        const status = value(data, 'status');
        const operation = value(data, 'operation');
        const type = value(data, 'type');
        const state = value(data, 'state').toUpperCase();
        const city = value(data, 'city');
        const district = value(data, 'district');
        if (search) filters.search = search;
        if (status) filters.status = status as PropertyListQuery['status'];
        if (operation) filters.operation = operation as PropertyListQuery['operation'];
        if (type) filters.type = type as PropertyListQuery['type'];
        if (state) filters.state = state;
        if (city) filters.city = city;
        if (district) filters.district = district;
        onApply(filters);
      }}
    >
      <label className="filter-search"><span>Buscar por título, referência, ID ou localização</span><span className="input-with-icon"><Search aria-hidden="true" /><input name="search" defaultValue={initialValues.search} placeholder="Ex.: Copacabana ou REF-001" /></span></label>
      <div className="filter-grid">
        <label><span>Status</span><select name="status" defaultValue={initialValues.status ?? ''}><option value="">Todos</option><option value="published">Publicados</option><option value="draft">Rascunhos</option><option value="inactive">Inativos</option></select></label>
        <label><span>Operação</span><select name="operation" defaultValue={initialValues.operation ?? ''}><option value="">Todas</option><option value="sale">Venda</option><option value="rent">Aluguel</option><option value="seasonal">Temporada</option><option value="auction">Leilão</option></select></label>
        <label><span>Tipo</span><select name="type" defaultValue={initialValues.type ?? ''}><option value="">Todos</option><option value="apartment">Apartamento</option><option value="house">Casa</option><option value="commercial">Comercial</option><option value="rural">Rural</option><option value="land">Terreno</option></select></label>
        <label><span>UF</span><input name="state" defaultValue={initialValues.state} inputMode="text" maxLength={2} placeholder="RJ" /></label>
        <label><span>Cidade</span><input name="city" defaultValue={initialValues.city} placeholder="Rio de Janeiro" /></label>
        <label><span>Bairro</span><input name="district" defaultValue={initialValues.district} placeholder="Copacabana" /></label>
      </div>
      <div className="filter-actions">
        <button className="button button-secondary" type="submit"><Search aria-hidden="true" />Aplicar filtros</button>
        <button className="button button-quiet" type="button" onClick={onClear}><RotateCcw aria-hidden="true" />Limpar</button>
        <label className="sort-control"><span>Ordenar</span><select name="sort" value={sort} onChange={(event) => onSort(event.currentTarget.value as PropertySort)}><option value="updated-desc">Alterados recentemente</option><option value="updated-asc">Alterados há mais tempo</option><option value="title-asc">Título A–Z</option><option value="title-desc">Título Z–A</option><option value="price-desc">Maior preço</option><option value="price-asc">Menor preço</option></select></label>
      </div>
    </form>
  </section>
);
