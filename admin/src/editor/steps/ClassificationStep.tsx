import React, { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

import { PROPERTY_SUBTYPES, PROPERTY_SUBTYPES_BY_TYPE, PROPERTY_TYPES, type PropertySubtype, type PropertyType } from '../../../../shared/featureCatalog.ts';
import type { PropertyOperation } from '../../api/client.ts';
import type { WizardValues } from '../types.ts';

const OPERATIONS: Array<{ id: PropertyOperation; label: string }> = [
  { id: 'sale', label: 'Venda' }, { id: 'rent', label: 'Aluguel' },
  { id: 'seasonal', label: 'Temporada' }, { id: 'auction', label: 'LeilÃ£o' },
];

export const ClassificationStep = () => {
  const { watch, setValue, register, formState: { errors } } = useFormContext<WizardValues>();
  const operations = watch('classification.operations') ?? [];
  const type = (watch('classification.type') ?? 'apartment') as PropertyType;
  const subtype = watch('classification.subtype') as PropertySubtype | undefined;
  const compatible = PROPERTY_SUBTYPES_BY_TYPE[type];
  useEffect(() => {
    if (!subtype || !compatible.includes(subtype)) {
      setValue('classification.subtype', compatible[0], { shouldDirty: Boolean(subtype), shouldValidate: true });
    }
  }, [compatible, setValue, subtype]);
  const toggleOperation = (operation: PropertyOperation) => {
    const next = operations.includes(operation)
      ? operations.filter((value) => value !== operation)
      : [...operations, operation];
    setValue('classification.operations', next, { shouldDirty: true, shouldValidate: true });
  };
  return (
    <fieldset className="wizard-fieldset">
      <legend>O que vocÃª vai anunciar?</legend>
      <p className="field-hint">Selecione uma ou mais operaÃ§Ãµes. Os valores sÃ£o informados separadamente na etapa 6.</p>
      <div className="choice-grid" aria-label="OperaÃ§Ãµes">
        {OPERATIONS.map(({ id, label }) => <button key={id} type="button" data-operation={id} className="choice-button" aria-pressed={operations.includes(id)} onClick={() => toggleOperation(id)}>{label}</button>)}
      </div>
      {errors.classification?.operations ? <p role="alert" className="field-error">Selecione pelo menos uma operaÃ§Ã£o.</p> : null}
      <label className="field-group">Tipo do imÃ³vel
        <select {...register('classification.type')}>
          {PROPERTY_TYPES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <label className="field-group">Subtipo
        <select {...register('classification.subtype')}>
          {PROPERTY_SUBTYPES.filter(({ id }) => compatible.includes(id)).map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
    </fieldset>
  );
};

