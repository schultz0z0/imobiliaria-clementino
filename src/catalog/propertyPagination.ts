export const PROPERTY_PAGE_SIZE = 12;

export const getVisiblePropertyCount = (total: number, requested: number) => (
  Math.max(0, Math.min(total, requested))
);

export const getNextVisiblePropertyCount = (total: number, current: number) => (
  getVisiblePropertyCount(total, current + PROPERTY_PAGE_SIZE)
);
