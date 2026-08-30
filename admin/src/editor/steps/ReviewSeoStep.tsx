import React from 'react';
import { useFormContext } from 'react-hook-form';
import { propertyDraftSchema } from '../../../../shared/propertySchema.ts';
import type { WizardValues } from '../types.ts';
import { PropertyReview } from '../../components/review/PropertyReview.tsx';

const qualityChecks = (values: WizardValues) => {
  const title = values.editorial?.title?.trim() ?? '';
  const description = values.editorial?.description?.trim() ?? '';
  const photos = values.media?.orderedPhotoIds?.length ?? 0;
  const checks = [
    { id: 'title', label: 'Título claro e descritivo', points: 15, passed: title.length >= 30, recommendation: 'Use localização, tipo e diferenciais (30+ caracteres).' },
    { id: 'description', label: 'Descrição completa', points: 20, passed: description.length >= 300, recommendation: 'Escreva pelo menos 300 caracteres.' },
    { id: 'photos', label: 'Galeria com pelo menos 10 fotos', points: 15, passed: photos >= 10, recommendation: 'Adicione pelo menos 10 fotos.' },
    { id: 'cover', label: 'Foto de capa definida', points: 5, passed: Boolean(values.media?.coverPhotoId), recommendation: 'Escolha uma foto de capa.' },
    { id: 'pricing', label: 'Preço da operação informado', points: 15, passed: Boolean(values.classification?.operations?.length && values.classification.operations.every((operation) => values.pricing?.[operation] !== undefined)), recommendation: 'Informe o preço de cada finalidade.' },
    { id: 'address', label: 'Endereço privado completo', points: 10, passed: Boolean(values.privateAddress?.postalCode && values.privateAddress.city && values.privateAddress.district && values.privateAddress.street && values.privateAddress.number), recommendation: 'Complete o endereço no passo Localização.' },
    { id: 'location', label: 'Localização pública aproximada confirmada', points: 5, passed: Boolean(values.publicLocation?.label), recommendation: 'Confirme o marcador aproximado.' },
    { id: 'seo', label: 'SEO personalizado', points: 5, passed: Boolean(values.seo?.title || values.seo?.description), recommendation: 'Revise os metadados SEO.' },
  ];
  return { checks, score: checks.reduce((sum, check) => sum + (check.passed ? check.points : 0), 0), recommendations: checks.filter((check) => !check.passed).map((check) => check.recommendation) };
};

export const ReviewSeoStep = () => {
  const { register, watch } = useFormContext<WizardValues>();
  const values = watch();
  const result = propertyDraftSchema.safeParse(values);
  const photos = values.media?.orderedPhotoIds ?? [];
  const quality = qualityChecks(values);
  const optionalText = { setValueAs: (value: unknown) => String(value ?? '').trim() || null };
  return <div className="wizard-step-stack">
    <fieldset className="wizard-fieldset"><legend>SEO</legend>
      <p className="field-hint">Os metadados são gerados automaticamente. Preencha apenas se quiser substituir o texto sugerido.</p>
      <label className="field-group">Título SEO (opcional)<input maxLength={120} {...register('seo.title', optionalText)} /></label>
      <label className="field-group">Descrição SEO (opcional)<textarea rows={4} maxLength={320} {...register('seo.description', optionalText)} /></label>
      <label className="field-group">Imagem social (opcional)<select {...register('seo.imagePhotoId', optionalText)}><option value="">Usar foto de capa</option>{photos.map((id, index) => <option key={id} value={id}>Foto {index + 1}</option>)}</select></label>
    </fieldset>
    <section className="review-summary" aria-labelledby="review-title"><h2 id="review-title">Revisão do cadastro</h2>
      <dl><div><dt>Título</dt><dd>{values.editorial?.title || 'Não informado'}</dd></div><div><dt>Localização pública</dt><dd>{values.publicLocation?.label || 'Não confirmada'}</dd></div><div><dt>Fotos</dt><dd>{photos.length}</dd></div></dl>
      {result.success ? <p className="form-notice">Cadastro completo para a revisão de publicação.</p> : <div className="form-alert" role="status"><strong>{result.error.issues.length} pendência(s)</strong><ul>{result.error.issues.slice(0, 8).map((issue, index) => <li key={`${issue.path.join('.')}-${index}`}>{issue.message}</li>)}</ul></div>}
      <p className="field-hint">Salvar o rascunho não publica o imóvel. A prévia e os controles de publicação ficam na próxima etapa do projeto.</p>
    </section>
    <PropertyReview
      checks={quality.checks}
      score={quality.score}
      recommendations={quality.recommendations}
      publishable={result.success}
      preview={{
        title: values.editorial?.title,
        description: values.editorial?.description,
        location: values.publicLocation?.label,
        photos: photos.length,
        facts: [values.facts?.bedrooms ? `${values.facts.bedrooms} quartos` : '', values.facts?.bathrooms ? `${values.facts.bathrooms} banheiros` : '', values.facts?.parkingSpaces ? `${values.facts.parkingSpaces} vagas` : ''].filter(Boolean),
      }}
    />
  </div>;
};
