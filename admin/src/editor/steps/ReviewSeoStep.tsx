import React from 'react';
import { useFormContext } from 'react-hook-form';
import { propertyDraftSchema } from '../../../../shared/propertySchema.ts';
import type { WizardValues } from '../types.ts';

export const ReviewSeoStep = () => {
  const { register, watch } = useFormContext<WizardValues>();
  const values = watch();
  const result = propertyDraftSchema.safeParse(values);
  const photos = values.media?.orderedPhotoIds ?? [];
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
  </div>;
};
