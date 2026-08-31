import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { LocationEditor, type LocationEditorValue } from '../../components/location/LocationEditor.tsx';
import { usePropertyEditor } from '../PropertyEditorProvider.tsx';
import type { WizardValues } from '../types.ts';

export const LocationStep = () => {
  const { watch, setValue, register, formState: { errors } } = useFormContext<WizardValues>();
  const { api, publicId } = usePropertyEditor();
  const [lookupError, setLookupError] = useState<string>();
  const [previewError, setPreviewError] = useState<string>();
  const privateAddress = watch('privateAddress') ?? {};
  const publicLocation = watch('publicLocation');
  const value: LocationEditorValue = {
    postalCode: privateAddress.postalCode ?? '',
    state: privateAddress.state ?? '',
    city: privateAddress.city ?? '',
    district: privateAddress.district ?? '',
    street: privateAddress.street ?? '',
    number: privateAddress.number ?? '',
    complement: privateAddress.complement,
    latitude: privateAddress.latitude,
    longitude: privateAddress.longitude,
    publicLatitude: publicLocation?.latitude,
    publicLongitude: publicLocation?.longitude,
  };

  const change = (next: LocationEditorValue) => {
    const addressKeys = ['postalCode', 'state', 'city', 'district', 'street', 'number', 'complement'] as const;
    for (const key of addressKeys) {
      if (next[key] !== privateAddress[key]) {
        setValue(`privateAddress.${key}`, next[key], { shouldDirty: true, shouldValidate: true });
      }
    }
  };

  const lookup = async (cep: string) => {
    try {
      const result = await api.lookupCep(cep);
      if (!result.ok) {
        setLookupError(result.error.message);
        return;
      }
      setLookupError(undefined);
      for (const [key, fieldValue] of Object.entries(result.address)) {
        setValue(`privateAddress.${key}` as never, fieldValue as never, { shouldDirty: true, shouldValidate: true });
      }
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Não foi possível consultar o CEP. Preencha o endereço manualmente.');
    }
  };

  const confirm = async () => {
    if (!publicId) {
      setPreviewError('Aguarde o primeiro salvamento do rascunho e tente novamente.');
      return;
    }
    const required = privateAddress as {
      postalCode?: string;
      state?: string;
      city?: string;
      district?: string;
      street?: string;
      number?: string;
      complement?: string;
      latitude?: number;
      longitude?: number;
    };
    if (!required.postalCode || !required.state || !required.city || !required.district || !required.street) {
      setPreviewError('Preencha CEP, UF, cidade, bairro e logradouro.');
      return;
    }
    try {
      const result = await api.previewLocation({
        publicId,
        privateAddress: {
          postalCode: required.postalCode,
          state: required.state,
          city: required.city,
          district: required.district,
          street: required.street,
          ...(required.number?.trim() ? { number: required.number.trim() } : {}),
          ...(required.complement?.trim() ? { complement: required.complement.trim() } : {}),
          ...(Number.isFinite(required.latitude) ? { latitude: required.latitude } : {}),
          ...(Number.isFinite(required.longitude) ? { longitude: required.longitude } : {}),
        },
      });
      for (const [key, fieldValue] of Object.entries(result.publicLocation)) {
        setValue(`publicLocation.${key}` as never, fieldValue as never, { shouldDirty: true, shouldValidate: true });
      }
      setPreviewError(undefined);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Não foi possível salvar a localização.');
    }
  };

  const fieldRegistration = (key: keyof LocationEditorValue) =>
    register(`privateAddress.${key}` as never) as never;

  const fieldErrors = Object.fromEntries(
    Object.keys(value).map((key) => [
      key,
      (errors.privateAddress as Record<string, { message?: string }> | undefined)?.[key]?.message,
    ]),
  ) as Partial<Record<keyof LocationEditorValue, string>>;

  return (
    <div className="wizard-step-stack">
      <LocationEditor
        value={value}
        onChange={change}
        onLookupCep={lookup}
        onConfirm={confirm}
        lookupError={lookupError}
        fieldRegistration={fieldRegistration}
        fieldErrors={fieldErrors}
      />
      {previewError ? <p className="form-alert" role="alert">{previewError}</p> : null}
      <aside className="privacy-note">
        <strong>Privacidade por padrão</strong>
        <p>O número e o complemento, quando informados, ficam somente no painel. O site exibe apenas bairro, cidade e UF.</p>
      </aside>
    </div>
  );
};
