import React from 'react';

export type PreviewProperty = { title?: string; description?: string; location?: string; price?: string; photos?: number; facts?: string[] };

export const ResponsivePreview = ({ property }: { property: PreviewProperty }) => (
  <section className="responsive-preview" aria-labelledby="responsive-preview-title">
    <h3 id="responsive-preview-title">Prévia pública</h3>
    <div className="preview-frame"><article className="public-preview-card"><p className="eyebrow">{property.location || 'Localização aproximada'}</p><h4>{property.title || 'Título do imóvel'}</h4>{property.price ? <strong>{property.price}</strong> : null}<div className="preview-facts">{(property.facts ?? []).map((fact) => <span key={fact}>{fact}</span>)}</div><p>{property.description || 'A descrição aparecerá aqui após o preenchimento.'}</p><small>{property.photos ?? 0} foto(s) na galeria</small></article></div>
    <p className="field-hint">A prévia exibe apenas dados públicos; endereço exato e coordenadas privadas nunca são mostrados.</p>
  </section>
);

