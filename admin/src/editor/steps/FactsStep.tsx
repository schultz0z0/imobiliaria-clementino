import React, { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import type { WizardValues } from '../types.ts';

const numberOptions = { setValueAs: (value: string) => value === '' ? undefined : Number(value) };
const counters: Array<{ name: 'bedrooms'|'bathrooms'|'suites'|'parkingSpaces'; label: string }> = [
  { name: 'bedrooms', label: 'Quartos' }, { name: 'bathrooms', label: 'Banheiros' },
  { name: 'suites', label: 'SuÃ­tes' }, { name: 'parkingSpaces', label: 'Vagas' },
];

export const FactsStep = () => {
  const { register, watch, setValue } = useFormContext<WizardValues>();
  const isNew = watch('facts.isNew') ?? false;
  useEffect(() => { if (isNew) setValue('facts.ageYears', undefined, { shouldDirty: true }); }, [isNew, setValue]);
  const changeCounter = (name: typeof counters[number]['name'], delta: number) => {
    const current = Number(watch(`facts.${name}`) ?? 0);
    setValue(`facts.${name}`, Math.max(0, current + delta), { shouldDirty: true, shouldValidate: true });
  };
  return <fieldset className="wizard-fieldset">
    <legend>Dados principais do imÃ³vel</legend>
    <div className="form-grid two-columns">
      <label className="field-group">Ãrea total (mÂ²)<input type="number" min="0" step="0.01" {...register('facts.totalArea', numberOptions)} /></label>
      <label className="field-group">Ãrea Ãºtil (mÂ²)<input type="number" min="0" step="0.01" {...register('facts.usableArea', numberOptions)} /></label>
    </div>
    <label className="check-card"><input type="checkbox" {...register('facts.isNew')} /><span>ImÃ³vel novo</span></label>
    {!isNew ? <label className="field-group">Idade do imÃ³vel (anos)<input type="number" min="0" {...register('facts.ageYears', numberOptions)} /></label> : <p className="field-hint">ImÃ³vel marcado como novo: a idade nÃ£o serÃ¡ armazenada.</p>}
    <div className="counter-grid">
      {counters.map(({ name, label }) => <div className="counter-control" key={name}>
        <span id={`${name}-label`}>{label}</span>
        <button type="button" aria-label={`Diminuir ${label}`} onClick={() => changeCounter(name, -1)}>âˆ’</button>
        <input aria-labelledby={`${name}-label`} type="number" min="0" {...register(`facts.${name}`, numberOptions)} />
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => changeCounter(name, 1)}>+</button>
      </div>)}
    </div>
    <div className="form-grid two-columns">
      <label className="field-group">NÃºmero de andares<input type="number" min="1" {...register('facts.floors', numberOptions)} /></label>
      <label className="field-group">PosiÃ§Ã£o do apartamento<select {...register('facts.position')}><option value="">Selecione</option><option value="front">Frente</option><option value="back">Fundos</option><option value="side">Lateral</option><option value="middle">Meio</option></select></label>
    </div>
  </fieldset>;
};

