import React from 'react';
import { useFormContext } from 'react-hook-form';
import { propertyDraftSchema } from '../../../../shared/propertySchema.ts';
import type { WizardValues } from '../types.ts';

export const ReviewSeoStep = () => {
  const { register, watch } = useFormContext<WizardValues>();
  const values = watch();
  const result = propertyDraftSchema.safeParse(values);
  const photos = values.media?.orderedPhotoIds ?? [];
  return <div className="wizard-step-stack">
    <fieldset className="wizard-fieldset"><legend>SEO</legend>
      <p className="field-hint">Os metadados sÃ£o gerados automaticamente. Preencha apenas se quiser substituir o texto sugerido.</p>
      <label className="field-group">TÃ­tulo SEO (opcional)<input maxLength={120} {...register('seo.title')} /></label>
      <label className="field-group">DescriÃ§Ã£o SEO (opcional)<textarea rows={4} maxLength={320} {...register('seo.description')} /></label>
      <label className="field-group">Imagem social (opcional)<select {...register('seo.imagePhotoId')}><option value="">Usar foto de capa</option>{photos.map((id, index) => <option key={id} value={id}>Foto {index + 1}</option>)}</select></label>
    </fieldset>
    <section className="review-summary" aria-labelledby="review-title"><h2 id="review-title">RevisÃ£o do cadastro</h2>
      <dl><div><dt>TÃ­tulo</dt><dd>{values.editorial?.title || 'NÃ£o informado'}</dd></div><div><dt>LocalizaÃ§Ã£o pÃºblica</dt><dd>{values.publicLocation?.label || 'NÃ£o confirmada'}</dd></div><div><dt>Fotos</dt><dd>{photos.length}</dd></div></dl>
      {result.success ? <p className="form-notice">Cadastro completo para a revisÃ£o de publicaÃ§Ã£o.</p> : <div className="form-alert" role="status"><strong>{result.error.issues.length} pendÃªncia(s)</strong><ul>{result.error.issues.slice(0, 8).map((issue, index) => <li key={`${issue.path.join('.')}-${index}`}>{issue.message}</li>)}</ul></div>}
      <p className="field-hint">Salvar o rascunho nÃ£o publica o imÃ³vel. A prÃ©via e os controles de publicaÃ§Ã£o ficam na prÃ³xima etapa do projeto.</p>
    </section>
  </div>;
};

