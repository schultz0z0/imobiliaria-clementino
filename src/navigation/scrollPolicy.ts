export const shouldResetScroll = (
  previousPath: string,
  nextPath: string,
  nextHash: string,
): boolean => previousPath !== nextPath && nextHash === '';
