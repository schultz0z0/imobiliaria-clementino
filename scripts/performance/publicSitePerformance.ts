import process from 'node:process';

export type TimingSummary = {
  count: number;
  min: number;
  median: number;
  p95: number;
  max: number;
};

export type PerformanceSampleGroup = { name: string; timings: number[] };

export const DEFAULT_PUBLIC_PERFORMANCE_BUDGETS: Record<string, number> = {
  home: 2_000,
  listing: 1_500,
  catalog: 1_500,
  detail: 1_500,
  navigation: 1_500,
};

export const percentile = (values: readonly number[], quantile: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1));
  return sorted[index]!;
};

export const summarizeTimings = (timings: readonly number[]): TimingSummary => {
  const values = [...timings].map((value) => Math.round(value));
  return {
    count: values.length,
    min: values.length ? Math.min(...values) : 0,
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: values.length ? Math.max(...values) : 0,
  };
};

export const assertPerformanceBudgets = (
  groups: readonly PerformanceSampleGroup[],
  budgets: Readonly<Record<string, number>> = DEFAULT_PUBLIC_PERFORMANCE_BUDGETS,
): string[] => groups.flatMap((group) => {
  const budget = budgets[group.name];
  if (budget === undefined) return [];
  const summary = summarizeTimings(group.timings);
  return summary.p95 > budget ? [`${group.name} p95 ${summary.p95}ms > budget ${budget}ms`] : [];
});

type PerformanceOptions = {
  siteBase?: string;
  apiBase?: string;
  samples?: number;
  fetchImpl?: typeof fetch;
};

type PublicCatalogResponse = { properties?: Array<{ slug?: string }> };

const timedRequest = async (url: string, fetchImpl: typeof fetch): Promise<number> => {
  const started = performance.now();
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
  await response.arrayBuffer();
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return performance.now() - started;
};

const sample = async (url: string, count: number, fetchImpl: typeof fetch): Promise<number[]> => {
  const timings: number[] = [];
  for (let index = 0; index < count; index += 1) timings.push(await timedRequest(url, fetchImpl));
  return timings;
};

export const runPublicSitePerformance = async ({
  siteBase = process.env.CLEMENTINO_SITE_URL ?? 'http://localhost:4174',
  apiBase = process.env.CLEMENTINO_ADMIN_API ?? 'http://localhost:4176',
  samples = 3,
  fetchImpl = fetch,
}: PerformanceOptions = {}): Promise<PerformanceSampleGroup[]> => {
  const site = siteBase.replace(/\/$/u, '');
  const api = apiBase.replace(/\/$/u, '');
  const catalogResponse = await fetchImpl(`${api}/api/public/catalog`, { signal: AbortSignal.timeout(30_000) });
  if (!catalogResponse.ok) throw new Error(`catalog returned HTTP ${catalogResponse.status}`);
  const catalog = await catalogResponse.json() as PublicCatalogResponse;
  const slug = catalog.properties?.find((property) => property.slug)?.slug;
  if (!slug) throw new Error('catalog has no published property slug');
  const count = Math.max(1, Math.floor(samples));
  return [
    { name: 'home', timings: await sample(`${site}/`, count, fetchImpl) },
    { name: 'listing', timings: await sample(`${site}/imoveis`, count, fetchImpl) },
    { name: 'catalog', timings: await sample(`${api}/api/public/catalog`, count, fetchImpl) },
    { name: 'detail', timings: await sample(`${site}/imoveis/${encodeURIComponent(slug)}`, count, fetchImpl) },
    { name: 'navigation', timings: await sample(`${site}/sobre`, count, fetchImpl) },
  ];
};

const main = async (): Promise<void> => {
  const report = await runPublicSitePerformance();
  for (const group of report) console.log(`${group.name}:`, summarizeTimings(group.timings));
  const failures = assertPerformanceBudgets(report);
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
};

if (process.argv[1]?.endsWith('publicSitePerformance.ts')) void main();
