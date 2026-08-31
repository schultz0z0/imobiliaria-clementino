import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { LocationEditor, type LocationEditorValue } from '../../components/location/LocationEditor.tsx';
import { usePropertyEditor } from '../PropertyEditorProvider.tsx';
import type { WizardValues } from '../types.ts';

export const LocationStep = () => {
  const { watch, setValue, register, formState: { errors } } = useFormContext<WizardValues>();
  const { api, publicId } = usePropertyEditor();
  const [lookupError, setLookupError] = useState<string>();
  const [previewError, setPreviewError] = useState<string>();
  const [geocodeMessage, setGeocodeMessage] = useState<string>();
  const geocodedAddressRef = useRef<string>();
  const geocodeAttemptRef = useRef<string>();
  const privateAddress = watch('privateAddress') ?? {};
  const publicLocation = watch('publicLocation');
  const value: LocationEditorValue = {
    postalCode: privateAddress.postalCode ?? '', state: privateAddress.state ?? '', city: privateAddress.city ?? '',
    district: privateAddress.district ?? '', street: privateAddress.street ?? '', number: privateAddress.number ?? '',
    complement: privateAddress.complement, latitude: privateAddress.latitude, longitude: privateAddress.longitude,
    publicLatitude: publicLocation?.latitude, publicLongitude: publicLocation?.longitude,
  };
  const addressForGeocode = {
    postalCode: privateAddress.postalCode ?? '', state: privateAddress.state ?? '', city: privateAddress.city ?? '',
    district: privateAddress.district ?? '', street: privateAddress.street ?? '', number: privateAddress.number ?? '',
    complement: privateAddress.complement,
  };
  const addressKey = JSON.stringify(addressForGeocode);
  const coordinatesAddressRef = useRef(
    Number.isFinite(privateAddress.latitude) && Number.isFinite(privateAddress.longitude) ? addressKey : undefined,
  );
  useEffect(() => {
    const { postalCode, state, city, district, street, number } = addressForGeocode;
    if (!postalCode || !state || !city || !district || !street) return;
    if (!number.trim()) { setGeocodeMessage('Informe o número para localizar o imóvel no mapa.'); return; }
    if (typeof api.geocodeLocation !== 'function') return;
    if (coordinatesAddressRef.current === undefined && Number.isFinite(privateAddress.latitude) && Number.isFinite(privateAddress.longitude)) {
      coordinatesAddressRef.current = addressKey;
      geocodedAddressRef.current = addressKey;
      return;
    }
    if (geocodedAddressRef.current === addressKey || geocodeAttemptRef.current === addressKey) return;
    if (coordinatesAddressRef.current === addressKey) { geocodedAddressRef.current = addressKey; return; }
    const abort = new AbortController();
    geocodeAttemptRef.current = addressKey;
    setGeocodeMessage('Localizando o endereço no mapa…');
    api.geocodeLocation(addressForGeocode, abort.signal).then((result) => {
      if (abort.signal.aborted) return;
      if (!result.ok) { setGeocodeMessage(`${result.error.message} Você poderá informar as coordenadas manualmente.`); return; }
      geocodedAddressRef.current = addressKey;
      coordinatesAddressRef.current = addressKey;
      setValue('privateAddress.latitude', result.location.latitude, { shouldDirty: true, shouldValidate: true });
      setValue('privateAddress.longitude', result.location.longitude, { shouldDirty: true, shouldValidate: true });
      setGeocodeMessage(`Endereço localizado: ${result.location.label}`);
    }).catch((error) => { if (!abort.signal.aborted) setGeocodeMessage(error instanceof Error ? `${error.message} Você poderá informar as coordenadas manualmente.` : 'Não foi possível localizar o endereço. Informe as coordenadas manualmente.'); });
    return () => abort.abort();
  }, [api, addressKey, privateAddress.latitude, privateAddress.longitude, setValue]);
  const change = (next: LocationEditorValue) => {
    const privateKeys = ['postalCode','state','city','district','street','number','complement','latitude','longitude'] as const;
    for (const key of privateKeys) {
      if (key === 'latitude' || key === 'longitude') continue;
      if (next[key] !== privateAddress[key]) setValue(`privateAddress.${key}`, next[key], { shouldDirty: true, shouldValidate: true });
    }
    if (next.latitude !== privateAddress.latitude || next.longitude !== privateAddress.longitude) {
      setValue('privateAddress.latitude', next.latitude, { shouldDirty: true, shouldValidate: true });
      setValue('privateAddress.longitude', next.longitude, { shouldDirty: true, shouldValidate: true });
    }
    if (next.publicLatitude !== publicLocation?.latitude || next.publicLongitude !== publicLocation?.longitude) {
      setValue('publicLocation.latitude', next.publicLatitude, { shouldDirty: true, shouldValidate: true });
      setValue('publicLocation.longitude', next.publicLongitude, { shouldDirty: true, shouldValidate: true });
    }
  };
  const lookup = async (cep: string) => {
    try {
      const result = await api.lookupCep(cep);
      if (!result.ok) { setLookupError(result.error.message); return; }
      setLookupError(undefined);
      for (const [key, fieldValue] of Object.entries(result.address)) setValue(`privateAddress.${key}` as never, fieldValue as never, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Não foi possível consultar o CEP. Preencha o endereço manualmente.');
    }
  };
  const confirm = async () => {
    if (!publicId) { setPreviewError('Aguarde o primeiro salvamento do rascunho e tente novamente.'); return; }
    const required = privateAddress as Required<Pick<LocationEditorValue, 'postalCode'|'state'|'city'|'district'|'street'|'number'>> & LocationEditorValue;
    if (!required.postalCode || !required.state || !required.city || !required.district || !required.street || !required.number) {
      setPreviewError('Preencha CEP, UF, cidade, bairro, rua e número.'); return;
    }
    try {
      const manualCoordinates = value.publicLatitude !== undefined && value.publicLongitude !== undefined
        ? { latitude: value.publicLatitude, longitude: value.publicLongitude } : undefined;
      const result = await api.previewLocation({ publicId, privateAddress: required, manualCoordinates });
      for (const [key, fieldValue] of Object.entries(result.publicLocation)) setValue(`publicLocation.${key}` as never, fieldValue as never, { shouldDirty: true, shouldValidate: true });
      setPreviewError(undefined);
    } catch (error) { setPreviewError(error instanceof Error ? error.message : 'Não foi possível gerar a localização aproximada.'); }
  };
  const onPublicLocationChange = useCallback((latitude: number, longitude: number) => {
    setValue('publicLocation.latitude', latitude, { shouldDirty: true, shouldValidate: true });
    setValue('publicLocation.longitude', longitude, { shouldDirty: true, shouldValidate: true });
  }, [setValue]);
  const fieldRegistration = (key: keyof LocationEditorValue) => {
    const path = ['publicLatitude', 'publicLongitude'].includes(key) ? `publicLocation.${key.replace('public', '').toLowerCase()}` : `privateAddress.${key}`;
    return register(path as never) as never;
  };
  const fieldErrors = Object.fromEntries(Object.keys(value).map((key) => {
    const section = ['publicLatitude', 'publicLongitude'].includes(key) ? errors.publicLocation : errors.privateAddress;
    const field = key.startsWith('public') ? key.replace('public', '').toLowerCase() : key;
    return [key, (section as Record<string, { message?: string }> | undefined)?.[field]?.message];
  })) as Partial<Record<keyof LocationEditorValue, string>>;
  return <div className="wizard-step-stack">
    <LocationEditor value={value} onChange={change} onLookupCep={lookup} onConfirm={confirm} lookupError={lookupError} fieldRegistration={fieldRegistration} fieldErrors={fieldErrors} onPublicLocationChange={onPublicLocationChange} publicPreview={publicLocation?.label ? { label: publicLocation.label, latitude: publicLocation.latitude, longitude: publicLocation.longitude } : undefined} />
    {geocodeMessage ? <p className="form-notice" role="status">{geocodeMessage}</p> : null}
    {previewError ? <p className="form-alert" role="alert">{previewError}</p> : null}
    <aside className="privacy-note"><strong>Privacidade por padrão</strong><p>O número, complemento e coordenadas exatas ficam somente no painel. O site usa bairro, cidade, UF e um marcador deslocado.</p></aside>
  </div>;
};
