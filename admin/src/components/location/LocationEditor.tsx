import React, { useId, useState, type ChangeEvent } from 'react';

export type LocationEditorValue = {
  postalCode: string; state: string; city: string; district: string; street: string; number: string;
  complement?: string; latitude?: number; longitude?: number; publicLatitude?: number; publicLongitude?: number;
};
type Registration = { name: string; onBlur: (event: ChangeEvent<HTMLInputElement>) => void; ref: (element: HTMLInputElement | null) => void };
type Props = {
  value: LocationEditorValue; onChange: (value: LocationEditorValue) => void; onConfirm: () => void;
  onLookupCep: (cep: string) => Promise<void>; lookupError?: string;
  publicPreview?: { label: string; latitude?: number; longitude?: number };
  fieldRegistration?: (key: keyof LocationEditorValue) => Registration;
  fieldErrors?: Partial<Record<keyof LocationEditorValue, string>>;
};
const fields: Array<{ key: Exclude<keyof LocationEditorValue, 'postalCode'>; label: string; type?: string }> = [
  { key: 'street', label: 'Logradouro' }, { key: 'number', label: 'Número' }, { key: 'complement', label: 'Complemento' },
  { key: 'district', label: 'Bairro' }, { key: 'city', label: 'Cidade' }, { key: 'state', label: 'UF' },
  { key: 'latitude', label: 'Latitude exata', type: 'number' }, { key: 'longitude', label: 'Longitude exata', type: 'number' },
  { key: 'publicLatitude', label: 'Latitude pública (aproximada)', type: 'number' }, { key: 'publicLongitude', label: 'Longitude pública (aproximada)', type: 'number' },
];

export const LocationEditor = ({ value, onChange, onConfirm, onLookupCep, lookupError, publicPreview, fieldRegistration, fieldErrors }: Props) => {
  const [loading, setLoading] = useState(false); const id = useId();
  const update = (key: keyof LocationEditorValue, next: string) => {
    const numeric = key.toLowerCase().includes('latitude') || key.toLowerCase().includes('longitude');
    onChange({ ...value, [key]: numeric && next !== '' ? Number(next) : next || undefined });
  };
  const lookup = async () => { setLoading(true); try { await onLookupCep(value.postalCode); } finally { setLoading(false); } };
  const renderInput = (key: keyof LocationEditorValue, label: string, type = 'text', inputId = `${id}-${String(key)}`) => {
    const registration = fieldRegistration?.(key); const error = fieldErrors?.[key]; const errorId = `${inputId}-error`;
    return <label className="field-group" htmlFor={inputId}>{label}<input {...registration} id={inputId} name={registration?.name ?? String(key)} type={type} value={value[key] ?? ''} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => update(key, event.currentTarget.value)} />{error ? <p id={errorId} className="field-error" role="alert">{error}</p> : null}</label>;
  };
  return <section aria-labelledby={`${id}-title`} className="location-editor">
    <h2 id={`${id}-title`}>Localização</h2><p>O endereço exato é privado. A publicação exibe somente bairro, cidade, UF e marcador aproximado.</p>
    <div className="location-cep-row">{renderInput('postalCode', 'CEP', 'text', `${id}-cep`)}<button className="button button-secondary" type="button" disabled={loading} onClick={lookup}>{loading ? 'Consultando CEP…' : 'Consultar CEP'}</button></div>
    {lookupError ? <p className="form-alert" role="alert">{lookupError} Preencha manualmente.</p> : null}
    <div className="location-fields">{fields.map(({ key, label, type }) => <React.Fragment key={key}>{renderInput(key, label, type)}</React.Fragment>)}</div>
    <input type="hidden" name="latitude" aria-hidden="true" tabIndex={-1} /><input type="hidden" name="publicLatitude" aria-hidden="true" tabIndex={-1} />
    {publicPreview ? <div className="location-map-preview" role="img" aria-label={`Mapa aproximado de ${publicPreview.label}`}><span className="map-marker" aria-hidden="true" /><output aria-live="polite"><strong>{publicPreview.label}</strong>{publicPreview.latitude !== undefined ? <small>Marcador aproximado: {publicPreview.latitude}, {publicPreview.longitude}</small> : null}</output></div> : <div className="location-map-preview map-empty"><span>Confirme os dados para gerar o marcador público aproximado.</span></div>}
    <button className="button button-primary" type="button" onClick={onConfirm}>Confirmar localização aproximada <span className="sr-only">Confirmar localizaÃ§Ã£o aproximada</span></button>
  </section>;
};
