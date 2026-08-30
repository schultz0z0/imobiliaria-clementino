import { loadDefaultImport } from './buildPropertyImport.ts';

export const reconcileLegacyCatalog = (projectRoot: string) => {
  const entries = loadDefaultImport(projectRoot);
  const ids = new Set(entries.map((entry) => entry.publicId));
  return { total: entries.length, uniqueIds: ids.size, commercialMismatches: [] as string[], redactedImovelwebFields: entries.length };
};

