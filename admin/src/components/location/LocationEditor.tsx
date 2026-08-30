import React, { useId, useState } from 'react';

export type LocationEditorValue = {
  postalCode: string; state: string; city: string; district: string; street: string; number: string;
  complement?: string; latitude?: number; longitude?: number; publicLatitude?: number; publicLongitude?: number;
};

type Props = {
  value: LocationEditorValue;
  onChange: (value: LocationEditorValue) => void;
  onConfirm: () => void;
  onLookupCep: (cep: string) => Promise<void>;
  lookupError?: string;
  publicPreview?: { label: string; latitude?: number; longitude?: number };
};

const fields: Array<{ key: keyof LocationEditorValue; label: string; type?: string }> = [
  { key: 'street', label: 'Logradouro' }, { key: 'number', label: 'NÃºmero' },
  { key: 'complement', label: 'Complemento' }, { key: 'district', label: 'Bairro' },
  { key: 'city', label: 'Cidade' }, { key: 'state', label: 'UF' },
  { key: 'latitude', label: 'Latitude exata', type: 'number' }, { key: 'longitude', label: 'Longitude exata', type: 'number' },
  { key: 'publicLatitude', label: 'Latitude pÃºblica (aproximada)', type: 'number' },
  { key: 'publicLongitude', label: 'Longitude pÃºblica (aproximada)', type: 'number' },
];

export const LocationEditor = ({ value, onChange, onConfirm, onLookupCep, lookupError, publicPreview }: Props) => {
  const [loading, setLoading] = useState(false);
  const id = useId();
  const update = (key: keyof LocationEditorValue, next: string) => {
    const numeric = key.toLowerCase().includes('latitude') || key.toLowerCase().includes('longitude');
    onChange({ ...value, [key]: numeric && next !== '' ? Number(next) : next || undefined });
  };
  const lookup = async () => {
    setLoading(true);
    try { await onLookupCep(value.postalCode); } finally { setLoading(false); }
  };
  return <section aria-labelledby={`${id}-title`} className="location-editor">
    <h2 id={`${id}-title`}>LocalizaÃ§Ã£o</h2>
    <p>O endereÃ§o exato Ã© privado. A publicaÃ§Ã£o exibe somente bairro, cidade, UF e marcador aproximado.</p>
    <div className="location-cep-row"><label className="field-group" htmlFor={`${id}-cep`}>CEP<input id={`${id}-cep`} name="postalCode" inputMode="numeric" value={value.postalCode} onChange={(event) => update('postalCode', event.currentTarget.value)} /></label><button className="button button-secondary" type="button" disabled={loading} onClick={lookup}>{loading ? 'Consultando CEPâ€¦' : 'Consultar CEP'}</button></div>
    {lookupError ? <p className="form-alert" role="alert">{lookupError} Preencha manualmente.</p> : null}
    <div className="location-fields">{fields.map(({ key, label, type = 'text' }) => <label className="field-group" key={key} htmlFor={`${id}-${key}`}>{label}<input id={`${id}-${key}`} name={key} type={type} value={value[key] ?? ''} onChange={(event) => update(key, event.currentTarget.value)} /></label>)}</div>
    {publicPreview ? <div className="location-map-preview" role="img" aria-label={`Mapa aproximado de ${publicPreview.label}`}><span className="map-marker" aria-hidden="true" /><output aria-live="polite"><strong>{publicPreview.label}</strong>{publicPreview.latitude !== undefined ? <small>Marcador aproximado: {publicPreview.latitude}, {publicPreview.longitude}</small> : null}</output></div> : <div className="location-map-preview map-empty"><span>Confirme os dados para gerar o marcador pÃºblico aproximado.</span></div>}
    <button className="button button-primary" type="button" onClick={onConfirm}>Confirmar localizaÃ§Ã£o aproximada</button>
  </section>;
};
