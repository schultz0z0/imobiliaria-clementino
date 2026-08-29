import React, { useId, useState } from 'react';

export type LocationEditorValue = {
  postalCode: string;
  state: string;
  city: string;
  district: string;
  street: string;
  number: string;
  complement?: string;
  latitude?: number;
  longitude?: number;
  publicLatitude?: number;
  publicLongitude?: number;
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
  { key: 'street', label: 'Logradouro' },
  { key: 'number', label: 'Número' },
  { key: 'complement', label: 'Complemento' },
  { key: 'district', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'UF' },
  { key: 'latitude', label: 'Latitude exata', type: 'number' },
  { key: 'longitude', label: 'Longitude exata', type: 'number' },
  { key: 'publicLatitude', label: 'Latitude pública (aproximada)', type: 'number' },
  { key: 'publicLongitude', label: 'Longitude pública (aproximada)', type: 'number' },
];

export const LocationEditor = ({
  value,
  onChange,
  onConfirm,
  onLookupCep,
  lookupError,
  publicPreview,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const id = useId();
  const update = (key: keyof LocationEditorValue, next: string) => {
    const numeric = key.toLowerCase().includes('latitude') || key.toLowerCase().includes('longitude');
    onChange({ ...value, [key]: numeric && next !== '' ? Number(next) : next || undefined });
  };
  const lookup = async () => {
    setLoading(true);
    try {
      await onLookupCep(value.postalCode);
    } finally {
      setLoading(false);
    }
  };
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4">
      <h2 id={`${id}-title`} className="text-lg font-semibold">Localização</h2>
      <p className="text-sm">O endereço exato é privado. A publicação exibe somente bairro, cidade, UF e marcador aproximado.</p>
      <div className="flex gap-2">
        <label className="flex-1" htmlFor={`${id}-cep`}>CEP
          <input id={`${id}-cep`} name="postalCode" inputMode="numeric" value={value.postalCode} onChange={(event) => update('postalCode', event.currentTarget.value)} />
        </label>
        <button type="button" disabled={loading} onClick={lookup}>{loading ? 'Consultando CEP…' : 'Consultar CEP'}</button>
      </div>
      {lookupError ? <p role="alert">{lookupError} Preencha manualmente.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ key, label, type = 'text' }) => (
          <label key={key} htmlFor={`${id}-${key}`}>{label}
            <input id={`${id}-${key}`} name={key} type={type} value={value[key] ?? ''} onChange={(event) => update(key, event.currentTarget.value)} />
          </label>
        ))}
      </div>
      {publicPreview ? <output aria-live="polite">{publicPreview.label}{publicPreview.latitude !== undefined ? ` — ${publicPreview.latitude}, ${publicPreview.longitude}` : ''}</output> : null}
      <button type="button" onClick={onConfirm}>Confirmar localização</button>
    </section>
  );
};
