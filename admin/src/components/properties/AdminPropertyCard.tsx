import { Building2, Copy, Eye, FilePenLine, Power, Rocket, RotateCcw } from 'lucide-react';
import React from 'react';
import type { AdminPropertySummaryDto, PropertyOperation } from '../../api/client.ts';

export type PropertyAction = 'publish' | 'inactivate' | 'reactivate' | 'duplicate';

type Props = {
  property: AdminPropertySummaryDto;
  busyAction?: PropertyAction;
  onAction: (action: PropertyAction, property: AdminPropertySummaryDto) => void;
};

const statusLabel = { draft: 'Rascunho', published: 'Publicado', inactive: 'Inativo' } as const;
const operationLabel: Record<PropertyOperation, string> = { sale: 'Venda', rent: 'Aluguel', seasonal: 'Temporada', auction: 'Leilão' };
const price = (property: AdminPropertySummaryDto) => {
  return property.firstPrice === null ? 'Valor não informado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(property.firstPrice);
};
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const publicOrigin = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_PUBLIC_SITE_URL ?? 'https://clementinoimoveis.com.br';

export const AdminPropertyCard = ({ property, busyAction, onAction }: Props) => {
  const title = property.title;
  const location = [property.location.district, property.location.city, property.location.state].filter(Boolean).join(', ');
  const operations = property.classification.operations.map((operation) => operationLabel[operation]).join(' · ') || 'Operação não informada';
  return (
    <article className="admin-property-card" aria-labelledby={`property-${property.id}`}>
      <div className="property-cover-placeholder" aria-hidden="true"><Building2 /></div>
      <div className="property-card-main">
        <div className="property-card-heading">
          <div><span className={`status-badge status-${property.status}`}>{statusLabel[property.status]}</span><h3 id={`property-${property.id}`} data-property-title>{title}</h3></div>
          <strong className="property-price">{price(property)}</strong>
        </div>
        <dl className="property-meta">
          <div><dt>Referência</dt><dd>{property.reference}</dd></div>
          <div><dt>ID público</dt><dd>{property.publicId}</dd></div>
          <div><dt>Finalidade</dt><dd>{operations}</dd></div>
          <div><dt>Localização</dt><dd>{location || 'Não informada'}</dd></div>
          <div><dt>Atualizado</dt><dd>{date(property.updatedAt)}</dd></div>
        </dl>
      </div>
      <div className="property-actions" aria-label={`Ações de ${title}`}>
        {property.status === 'published' ? <a className="action-link" href={`${publicOrigin}/imoveis/${property.slug}`} target="_blank" rel="noreferrer"><Eye aria-hidden="true" />Visualizar</a> : <span className="action-disabled" aria-disabled="true" title="Disponível somente para imóveis publicados"><Eye aria-hidden="true" />Visualização indisponível</span>}
        <a className="action-link" href={`/imoveis/${property.id}/editar`}><FilePenLine aria-hidden="true" />Editar</a>
        {property.status !== 'inactive' ? <button type="button" onClick={() => onAction('publish', property)} disabled={Boolean(busyAction)}><Rocket aria-hidden="true" />{busyAction === 'publish' ? 'Solicitando…' : 'Publicar'}</button> : null}
        {property.status !== 'inactive' ? <button type="button" onClick={() => onAction('inactivate', property)} disabled={Boolean(busyAction)}><Power aria-hidden="true" />{busyAction === 'inactivate' ? 'Inativando…' : 'Inativar'}</button> : <button type="button" onClick={() => onAction('reactivate', property)} disabled={Boolean(busyAction)}><RotateCcw aria-hidden="true" />{busyAction === 'reactivate' ? 'Reativando…' : 'Reativar'}</button>}
        <button type="button" onClick={() => onAction('duplicate', property)} disabled={Boolean(busyAction)}><Copy aria-hidden="true" />{busyAction === 'duplicate' ? 'Duplicando…' : 'Duplicar'}</button>
      </div>
    </article>
  );
};
