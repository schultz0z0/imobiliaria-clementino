import React from 'react';
import { useFormContext } from 'react-hook-form';
import type { PropertyOperation } from '../../api/client.ts';
import type { WizardValues } from '../types.ts';

const operationLabels: Record<PropertyOperation, string> = { sale: 'Venda', rent: 'Aluguel', seasonal: 'Temporada', auction: 'Leilão' };
const moneyOptions = { setValueAs: (value: string) => value === '' ? undefined : Number(value) };

export const EditorialPricingStep = () => {
  const { register, watch, setValue, formState: { errors } } = useFormContext<WizardValues>();
  const operations = watch('classification.operations') ?? [];
  const description = watch('editorial.description') ?? '';
  const buildTitle = () => {
    const type = watch('classification.type') ?? 'apartment';
    const district = watch('privateAddress.district') ?? 'bairro';
    const bedrooms = watch('facts.bedrooms') ?? 0;
    const area = watch('facts.usableArea') ?? watch('facts.totalArea');
    const typeLabel = { apartment: 'Apartamento', house: 'Casa', commercial: 'Imóvel comercial', rural: 'Imóvel rural', land: 'Terreno' }[type];
    setValue('editorial.title', `${typeLabel} em ${district}${area ? ` com ${area} m²` : ''}${bedrooms ? ` e ${bedrooms} quartos` : ''}`, { shouldDirty: true, shouldValidate: true });
  };
  return <div className="wizard-step-stack">
    <fieldset className="wizard-fieldset"><legend>Título e descrição</legend>
      <div className="field-row-action"><label className="field-group">Título padronizado<input maxLength={120} {...register('editorial.title')} /></label><button type="button" className="button button-secondary" onClick={buildTitle}>Sugerir título</button></div>
      {errors.editorial?.title ? <p className="field-error" role="alert">Revise o título (10 a 120 caracteres).</p> : null}
      <label className="field-group">Descrição completa<textarea rows={10} maxLength={5000} {...register('editorial.description')} /></label>
      <p className={description.trim().length >= 80 ? 'quality-ok' : 'field-hint'} aria-live="polite">{description.trim().length}/80 caracteres mínimos. Descreva ambientes, estado, localização e diferenciais em português claro.</p>
      <div className="form-grid two-columns"><label className="field-group">Referência comercial<input maxLength={50} {...register('editorial.reference')} /></label><label className="check-card"><input type="checkbox" {...register('editorial.featured')} />Destacar na página inicial</label></div>
    </fieldset>
    <fieldset className="wizard-fieldset"><legend>Valores</legend>
      <div className="form-grid two-columns">
        {operations.map((operation) => <label className="field-group" key={operation}>Preço de {operationLabels[operation]} (R$)<input type="number" min="0" step="0.01" {...register(`pricing.${operation}`, moneyOptions)} /></label>)}
        <label className="field-group">Condomínio mensal (R$)<input type="number" min="0" step="0.01" {...register('pricing.condominium', moneyOptions)} /></label>
        <label className="field-group">IPTU (R$)<input type="number" min="0" step="0.01" {...register('pricing.iptu', moneyOptions)} /></label>
      </div>
    </fieldset>
  </div>;
};

