export const matchesGeneratedCatalog = (current: string, serialized: string): boolean => (
  current.replace(/\r\n/g, '\n') === serialized
);
