import React from 'react';
import { useFormContext } from 'react-hook-form';
import { COMMON_FEATURES, PRIVATE_FEATURES } from '../../../../shared/featureCatalog.ts';
import type { WizardValues } from '../types.ts';

export const FeaturesStep = () => {
  const { register, watch, setValue } = useFormContext<WizardValues>();
  const common = watch('features.common') ?? [];
  const privateFeatures = watch('features.private') ?? [];
  const toggle = (kind: 'common'|'private', id: string) => {
    const current = kind === 'common' ? common : privateFeatures;
    const next = current.includes(id as never) ? current.filter((item) => item !== id) : [...current, id] as never[];
    setValue(`features.${kind}`, next, { shouldDirty: true, shouldValidate: true });
  };
  return <div className="wizard-step-stack">
    <fieldset className="wizard-fieldset"><legend>Extras</legend><div className="check-grid">
      <label className="check-card"><input type="checkbox" {...register('features.acceptsFgts')} />Aceita FGTS</label>
      <label className="check-card"><input type="checkbox" {...register('features.acceptsExchange')} />Aceita permuta</label>
    </div></fieldset>
    <fieldset className="wizard-fieldset"><legend>Ãreas comuns</legend><div className="feature-grid">
      {COMMON_FEATURES.map(({ id, label }) => <button type="button" className="feature-button" data-feature-kind="common" aria-pressed={common.includes(id)} key={id} onClick={() => toggle('common', id)}>{label}</button>)}
    </div></fieldset>
    <fieldset className="wizard-fieldset"><legend>Ãrea privativa</legend><div className="feature-grid">
      {PRIVATE_FEATURES.map(({ id, label }) => <button type="button" className="feature-button" data-feature-kind="private" aria-pressed={privateFeatures.includes(id)} key={id} onClick={() => toggle('private', id)}>{label}</button>)}
    </div></fieldset>
  </div>;
};

