import React, { useId, useState, type ChangeEvent } from 'react';

export type LocationEditorValue = {
  postalCode: string;
  state: string;
  city: string;
  district: string;
  street: string;
  number?: string;
  complement?: string;
  // Existing drafts may keep coordinates, but the admin editor does not expose them.
  latitude?: number;
  longitude?: number;
  publicLatitude?: number;
  publicLongitude?: number;
};

type Registration = {
  name: string;
  onBlur: (event: ChangeEvent<HTMLInputElement>) => void;
  ref: (element: HTMLInputElement | null) => void;
};

type Props = {
  value: LocationEditorValue;
  onChange: (value: LocationEditorValue) => void;
  onConfirm: () => void;
  onLookupCep: (cep: string) => Promise<void>;
  lookupError?: string;
  fieldRegistration?: (key: keyof LocationEditorValue) => Registration;
  fieldErrors?: Partial<Record<keyof LocationEditorValue, string>>;
};

const fields: Array<{
  key: Exclude<keyof LocationEditorValue, 'postalCode' | 'latitude' | 'longitude' | 'publicLatitude' | 'publicLongitude'>;
  label: string;
}> = [
  { key: 'street', label: 'Logradouro' },
  { key: 'number', label: 'Número (opcional)' },
  { key: 'complement', label: 'Complemento (opcional)' },
  { key: 'district', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'UF' },
];

export const LocationEditor = ({
  value,
  onChange,
  onConfirm,
  onLookupCep,
  lookupError,
  fieldRegistration,
  fieldErrors,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const id = useId();
  const lookupMessage = lookupError && lookupError.includes('Preencha manualmente')
    ? lookupError
    : lookupError
      ? `${lookupError} Preencha manualmente.`
      : undefined;

  const update = (key: keyof LocationEditorValue, next: string) => {
    onChange({ ...value, [key]: next || undefined });
  };

  const lookup = async () => {
    setLoading(true);
    try {
      await onLookupCep(value.postalCode);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    key: keyof LocationEditorValue,
    label: string,
    inputId = `${id}-${String(key)}`,
  ) => {
    const registration = fieldRegistration?.(key);
    const error = fieldErrors?.[key];
    const errorId = `${inputId}-error`;
    return (
      <label className="field-group" htmlFor={inputId}>
        {label}
        <input
          {...registration}
          id={inputId}
          name={registration?.name ?? String(key)}
          type="text"
          value={value[key] ?? ''}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => update(key, event.currentTarget.value)}
        />
        {error ? <p id={errorId} className="field-error" role="alert">{error}</p> : null}
      </label>
    );
  };

  return (
    <section aria-labelledby={`${id}-title`} className="location-editor">
      <h2 id={`${id}-title`}>Localização</h2>
      <p>Preencha o endereço para identificar o imóvel. O endereço exato permanece privado; no site exibimos apenas bairro, cidade e UF.</p>
      <div className="location-cep-row">
        {renderInput('postalCode', 'CEP', `${id}-cep`)}
        <button className="button button-secondary" type="button" disabled={loading} onClick={lookup}>
          {loading ? 'Consultando CEP…' : 'Consultar CEP'}
        </button>
      </div>
      {lookupMessage ? <p className="form-alert" role="alert">{lookupMessage}</p> : null}
      <div className="location-fields">
        {fields.map(({ key, label }) => <React.Fragment key={key}>{renderInput(key, label)}</React.Fragment>)}
      </div>
      <button className="button button-primary" type="button" onClick={onConfirm}>
        Salvar localização
      </button>
    </section>
  );
};
