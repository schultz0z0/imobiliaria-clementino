export const getNeighborhoodSearchUrl = (district: string): string => {
  const params = new URLSearchParams({ district });
  return `/imoveis?${params.toString()}`;
};
