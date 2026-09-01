import { publishablePropertySchema, type PropertyDraft } from '../../shared/propertySchema.ts';
import type { ApiFieldIssue } from '../../shared/apiContract.ts';

export type QualityCheck = {
  id: string;
  label: string;
  points: number;
  passed: boolean;
  recommendation?: string;
};

export type PropertyQuality = {
  score: number;
  checks: QualityCheck[];
  recommendations: string[];
  publishable: boolean;
  blockingIssues: ApiFieldIssue[];
};

const issue = (path: readonly PropertyKey[], message: string): ApiFieldIssue => ({
  path: path.map((segment) => (typeof segment === 'symbol' ? segment.description ?? 'field' : segment)),
  message,
});

/**
 * Produces a deterministic editorial quality score. Recommendations improve
 * discoverability but never replace the strict publication schema: only schema
 * and business issues block publication.
 */
export const assessPropertyQuality = (draft: unknown): PropertyQuality => {
  const parsed = publishablePropertySchema.safeParse(draft);
  const value = (parsed.success ? parsed.data : draft) as Partial<PropertyDraft>;
  const checks: QualityCheck[] = [];
  const recommendations: string[] = [];
  const add = (id: string, label: string, points: number, passed: boolean, recommendation?: string) => {
    checks.push({ id, label, points, passed, recommendation });
    if (!passed && recommendation) recommendations.push(recommendation);
  };

  const editorial = value.editorial;
  const facts = value.facts;
  const pricing = value.pricing;
  const media = value.media;
  const address = value.privateAddress;
  const seo = value.seo;

  add('title', 'Título claro e descritivo', 15, Boolean(editorial?.title && editorial.title.trim().length >= 30), 'Use um título com localização, tipo e diferenciais (30+ caracteres).');
  add('description', 'Descrição completa', 20, Boolean(editorial?.description && editorial.description.trim().length >= 300), 'Escreva pelo menos 300 caracteres com ambientes, localização e diferenciais.');
  add('photos', 'Galeria com pelo menos 10 fotos', 15, (media?.orderedPhotoIds?.length ?? 0) >= 10, 'Adicione pelo menos 10 fotos nítidas e escolha uma capa.');
  add('cover', 'Foto de capa definida', 5, Boolean(media?.coverPhotoId), 'Defina a melhor foto como capa do anúncio.');
  add('pricing', 'Preço da operação informado', 15, Boolean(pricing && value.classification?.operations?.every((operation) => pricing[operation] !== undefined)), 'Informe o preço de cada finalidade selecionada.');
  add('condominium-iptu', 'Condomínio e IPTU revisados', 10, pricing?.condominium !== undefined && pricing?.iptu !== undefined, 'Preencha condomínio e IPTU ou confirme que não se aplicam.');
  add('address', 'Endereço privado completo', 10, Boolean(address?.postalCode && address.state && address.city && address.district && address.street), 'Complete CEP, UF, cidade, bairro e logradouro no painel.');
  add('location', 'Localização pública aproximada confirmada', 5, Boolean(value.publicLocation?.label && value.publicLocation?.precision === 'approximate'), 'Confirme o marcador aproximado para proteger o endereço exato.');
  add('seo', 'SEO personalizado', 5, Boolean(seo?.title || seo?.description), 'Revise o título e a descrição SEO para melhorar a apresentação nos buscadores.');

  const total = checks.reduce((sum, check) => sum + (check.passed ? check.points : 0), 0);
  const blockingIssues = parsed.success ? [] : parsed.error.issues.map((entry) => issue(entry.path, entry.message));
  return {
    score: total,
    checks,
    recommendations,
    publishable: blockingIssues.length === 0,
    blockingIssues,
  };
};

export const calculatePropertyQuality = assessPropertyQuality;

