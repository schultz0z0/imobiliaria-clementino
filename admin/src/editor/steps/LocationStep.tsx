import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { LocationEditor, type LocationEditorValue } from '../../components/location/LocationEditor.tsx';
import { usePropertyEditor } from '../PropertyEditorProvider.tsx';
import type { WizardValues } from '../types.ts';

export const LocationStep = () => {
  const { watch, setValue } = useFormContext<WizardValues>();
  const { api, publicId } = usePropertyEditor();
  const [lookupError, setLookupError] = useState<string>();
  const [previewError, setPreviewError] = useState<string>();
  const privateAddress = watch('privateAddress') ?? {};
  const publicLocation = watch('publicLocation');
  const value: LocationEditorValue = {
    postalCode: privateAddress.postalCode ?? '', state: privateAddress.state ?? '', city: privateAddress.city ?? '',
    district: privateAddress.district ?? '', street: privateAddress.street ?? '', number: privateAddress.number ?? '',
    complement: privateAddress.complement, latitude: privateAddress.latitude, longitude: privateAddress.longitude,
    publicLatitude: publicLocation?.latitude, publicLongitude: publicLocation?.longitude,
  };
  const change = (next: LocationEditorValue) => {
    const privateKeys = ['postalCode','state','city','district','street','number','complement','latitude','longitude'] as const;
    for (const key of privateKeys) {
      if (next[key] !== privateAddress[key]) setValue(`privateAddress.${key}`, next[key], { shouldDirty: true, shouldValidate: true });
    }
    if (next.publicLatitude !== publicLocation?.latitude || next.publicLongitude !== publicLocation?.longitude) {
      setValue('publicLocation.latitude', next.publicLatitude, { shouldDirty: true });
      setValue('publicLocation.longitude', next.publicLongitude, { shouldDirty: true });
    }
  };
  const lookup = async (cep: string) => {
    const result = await api.lookupCep(cep);
    if (!result.ok) { setLookupError(result.error.message); return; }
    setLookupError(undefined);
    for (const [key, fieldValue] of Object.entries(result.address)) setValue(`privateAddress.${key}` as never, fieldValue as never, { shouldDirty: true, shouldValidate: true });
  };
  const confirm = async () => {
    if (!publicId) { setPreviewError('Aguarde o primeiro salvamento do rascunho e tente novamente.'); return; }
    const required = privateAddress as Required<Pick<LocationEditorValue, 'postalCode'|'state'|'city'|'district'|'street'|'number'>> & LocationEditorValue;
    if (!required.postalCode || !required.state || !required.city || !required.district || !required.street || !required.number) {
      setPreviewError('Preencha CEP, UF, cidade, bairro, rua e nÃºmero.'); return;
    }
    try {
      const manualCoordinates = value.publicLatitude !== undefined && value.publicLongitude !== undefined
        ? { latitude: value.publicLatitude, longitude: value.publicLongitude } : undefined;
      const result = await api.previewLocation({ publicId, privateAddress: required, manualCoordinates });
      for (const [key, fieldValue] of Object.entries(result.publicLocation)) setValue(`publicLocation.${key}` as never, fieldValue as never, { shouldDirty: true, shouldValidate: true });
      setPreviewError(undefined);
    } catch (error) { setPreviewError(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel gerar a localizaÃ§Ã£o aproximada.'); }
  };
  return <div className="wizard-step-stack">
    <LocationEditor value={value} onChange={change} onLookupCep={lookup} onConfirm={confirm} lookupError={lookupError} publicPreview={publicLocation?.label ? { label: publicLocation.label, latitude: publicLocation.latitude, longitude: publicLocation.longitude } : undefined} />
    {previewError ? <p className="form-alert" role="alert">{previewError}</p> : null}
    <aside className="privacy-note"><strong>Privacidade por padrÃ£o</strong><p>O nÃºmero, complemento e coordenadas exatas ficam somente no painel. O site usa bairro, cidade, UF e um marcador deslocado.</p></aside>
  </div>;
};
