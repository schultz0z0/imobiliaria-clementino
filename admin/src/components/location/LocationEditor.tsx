import React, { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';

export const OPENSTREETMAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export type LocationEditorValue = {
  postalCode: string; state: string; city: string; district: string; street: string; number: string;
  complement?: string; latitude?: number; longitude?: number; publicLatitude?: number; publicLongitude?: number;
};
type Registration = { name: string; onBlur: (event: ChangeEvent<HTMLInputElement>) => void; ref: (element: HTMLInputElement | null) => void };
type Props = {
  value: LocationEditorValue; onChange: (value: LocationEditorValue) => void; onConfirm: () => void;
  onLookupCep: (cep: string) => Promise<void>; lookupError?: string;
  publicPreview?: { label: string; latitude?: number; longitude?: number };
  onPublicLocationChange?: (latitude: number, longitude: number) => void;
  fieldRegistration?: (key: keyof LocationEditorValue) => Registration;
  fieldErrors?: Partial<Record<keyof LocationEditorValue, string>>;
};
const fields: Array<{ key: Exclude<keyof LocationEditorValue, 'postalCode'>; label: string; type?: string }> = [
  { key: 'street', label: 'Logradouro' }, { key: 'number', label: 'Número' }, { key: 'complement', label: 'Complemento' },
  { key: 'district', label: 'Bairro' }, { key: 'city', label: 'Cidade' }, { key: 'state', label: 'UF' },
  { key: 'latitude', label: 'Latitude exata', type: 'number' }, { key: 'longitude', label: 'Longitude exata', type: 'number' },
  { key: 'publicLatitude', label: 'Latitude pública (aproximada)', type: 'number' }, { key: 'publicLongitude', label: 'Longitude pública (aproximada)', type: 'number' },
];

type LocationMapProps = { label: string; latitude?: number; longitude?: number; onMarkerDrag?: (latitude: number, longitude: number) => void };
const LocationMap = ({ label, latitude, longitude, onMarkerDrag }: LocationMapProps) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<{ remove: () => void } | null>(null);
  const markerInstance = useRef<{ setLatLng: (coords: [number, number]) => void } | null>(null);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  useEffect(() => {
    if (!hasCoordinates || typeof window === 'undefined' || !mapElement.current) return;
    let disposed = false;
    import('leaflet').then(({ default: L }) => {
      if (disposed || !mapElement.current || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      const map = L.map(mapElement.current, { scrollWheelZoom: false, attributionControl: true }).setView([latitude!, longitude!], 16);
      L.tileLayer(OPENSTREETMAP_TILE_URL, { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      const marker = L.marker([latitude!, longitude!], { draggable: Boolean(onMarkerDrag), title: 'Marcador aproximado' }).addTo(map);
      if (onMarkerDrag) marker.on('dragend', () => { const point = marker.getLatLng(); onMarkerDrag(point.lat, point.lng); });
      mapInstance.current = map;
      markerInstance.current = marker;
    }).catch(() => undefined);
    return () => { disposed = true; markerInstance.current = null; mapInstance.current?.remove(); mapInstance.current = null; };
  }, [hasCoordinates, latitude, longitude, onMarkerDrag]);
  useEffect(() => { if (markerInstance.current && hasCoordinates) markerInstance.current.setLatLng([latitude!, longitude!]); }, [hasCoordinates, latitude, longitude]);
  if (!hasCoordinates) return <div className="location-map-preview map-empty" data-testid="location-map-fallback" role="status"><span>Confirme os dados ou informe as coordenadas públicas manualmente.</span></div>;
  return <div className="location-map-shell">
    <div ref={mapElement} className="location-map-preview location-map" data-testid="location-map" role="img" aria-label={`Mapa aproximado de ${label}`}>
      <span className="map-attribution-visible">© OpenStreetMap contributors</span>
      <output aria-live="polite"><strong>{label}</strong><small>Arraste o marcador para ajustar a localização aproximada.</small></output>
    </div>
  </div>;
};

export const LocationEditor = ({ value, onChange, onConfirm, onLookupCep, lookupError, publicPreview, onPublicLocationChange, fieldRegistration, fieldErrors }: Props) => {
  const [loading, setLoading] = useState(false); const id = useId();
  const lookupMessage = lookupError && lookupError.includes('Preencha manualmente') ? lookupError : lookupError ? `${lookupError} Preencha manualmente.` : undefined;
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
    {lookupMessage ? <p className="form-alert" role="alert">{lookupMessage}</p> : null}
    <div className="location-fields">{fields.map(({ key, label, type }) => <React.Fragment key={key}>{renderInput(key, label, type)}</React.Fragment>)}</div>
    <input type="hidden" name="latitude" aria-hidden="true" tabIndex={-1} /><input type="hidden" name="publicLatitude" aria-hidden="true" tabIndex={-1} />
    <LocationMap label={publicPreview?.label ?? 'Localização do imóvel'} latitude={publicPreview?.latitude} longitude={publicPreview?.longitude} onMarkerDrag={onPublicLocationChange} />
    <button className="button button-primary" type="button" onClick={onConfirm}>Confirmar localização aproximada <span className="sr-only">Confirmar localização aproximada</span></button>
  </section>;
};
