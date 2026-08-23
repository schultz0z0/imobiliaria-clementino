import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadCatalogSource, type SourceProperty } from './loadCatalogSource';
import type { CatalogOverrides, RawPropertyRecord } from './sourceTypes';
import { validateCatalog } from './validateCatalog';

export interface ImagePropertySource {
  id: string;
  folderPath: string;
  photos: Array<{ index: number; relativePath: string }>;
}

export interface ImageStats {
  sourceBytes: number;
  outputBytes: number;
  generatedFiles: number;
  reusedFiles: number;
}

type ParsedSourceProperty = Extract<SourceProperty, { record: RawPropertyRecord }>;

const hasRecord = (entry: SourceProperty): entry is ParsedSourceProperty => entry.record !== undefined;

const isCurrent = (sourcePath: string, outputPath: string): boolean => {
  try {
    return statSync(outputPath).mtimeMs >= statSync(sourcePath).mtimeMs;
  } catch {
    return false;
  }
};

const generateGalleryImage = async (sourcePath: string, outputPath: string): Promise<boolean> => {
  if (isCurrent(sourcePath, outputPath)) return false;
  await sharp(sourcePath)
    .rotate()
    .resize({ width: 1_600, height: 1_600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(outputPath);
  return true;
};

const generateCoverImage = async (sourcePath: string, outputPath: string): Promise<boolean> => {
  if (isCurrent(sourcePath, outputPath)) return false;
  await sharp(sourcePath)
    .rotate()
    .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toFile(outputPath);
  return true;
};

const runWithConcurrency = async (tasks: Array<() => Promise<void>>, concurrency: number): Promise<void> => {
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await tasks[currentIndex]!();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
};

export const generatePropertyImages = async (
  property: ImagePropertySource,
  outputRoot: string,
): Promise<ImageStats> => {
  const outputDirectory = join(outputRoot, property.id);
  mkdirSync(outputDirectory, { recursive: true });
  const stats: ImageStats = { sourceBytes: 0, outputBytes: 0, generatedFiles: 0, reusedFiles: 0 };
  const orderedPhotos = [...property.photos].sort((left, right) => left.index - right.index);
  const tasks: Array<() => Promise<void>> = orderedPhotos.map((photo) => async () => {
    const sourcePath = resolve(property.folderPath, photo.relativePath);
    const outputPath = join(outputDirectory, `foto-${String(photo.index).padStart(2, '0')}.webp`);
    stats.sourceBytes += statSync(sourcePath).size;
    const generated = await generateGalleryImage(sourcePath, outputPath);
    generated ? stats.generatedFiles += 1 : stats.reusedFiles += 1;
    stats.outputBytes += statSync(outputPath).size;
  });

  await runWithConcurrency(tasks, 4);

  const coverSource = orderedPhotos[0];
  if (coverSource) {
    const sourcePath = resolve(property.folderPath, coverSource.relativePath);
    const outputPath = join(outputDirectory, 'capa.webp');
    const generated = await generateCoverImage(sourcePath, outputPath);
    generated ? stats.generatedFiles += 1 : stats.reusedFiles += 1;
    stats.outputBytes += statSync(outputPath).size;
  }
  return stats;
};

export const toImagePropertySource = (entry: ParsedSourceProperty): ImagePropertySource => ({
  id: entry.record.dados_gerais.id_imovelweb,
  folderPath: entry.folderPath,
  photos: entry.record.fotos.map((photo) => ({ index: photo.index, relativePath: photo.relative_path })),
});

export const generateAllImages = async (
  entries: SourceProperty[],
  outputRoot: string,
): Promise<ImageStats> => {
  const total: ImageStats = { sourceBytes: 0, outputBytes: 0, generatedFiles: 0, reusedFiles: 0 };
  for (const entry of entries) {
    if (!hasRecord(entry)) continue;
    const current = await generatePropertyImages(toImagePropertySource(entry), outputRoot);
    total.sourceBytes += current.sourceBytes;
    total.outputBytes += current.outputBytes;
    total.generatedFiles += current.generatedFiles;
    total.reusedFiles += current.reusedFiles;
  }
  return total;
};

const run = async (): Promise<void> => {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const siteRoot = resolve(scriptDirectory, '..', '..');
  const entries = loadCatalogSource(join(siteRoot, 'content', 'imoveis'));
  const overrides = JSON.parse(
    readFileSync(join(siteRoot, 'content', 'catalog-overrides.json'), 'utf8'),
  ) as CatalogOverrides;
  const validation = validateCatalog(entries, overrides, 53);
  if (validation.errors.length > 0) throw new Error(`Catálogo inválido: ${validation.errors.length} erro(s).`);
  const stats = await generateAllImages(entries, join(siteRoot, 'public', 'imoveis'));
  console.log(`Imagens: ${stats.generatedFiles} geradas, ${stats.reusedFiles} reutilizadas.`);
};

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : '';
if (entrypoint === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
