const APPROVED_IMAGE_EXTENSION = /\.(?:heic|heif|tif|tiff|jpe?g|png|webp)$/i;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

export const validatePhotoFiles = (files: ArrayLike<Pick<File, 'name'|'size'>>): string | undefined => {
  const invalid = Array.from(files).find((file) => file.size > MAX_PHOTO_BYTES || !APPROVED_IMAGE_EXTENSION.test(file.name));
  return invalid ? `${invalid.name}: use HEIC, TIFF, JPG, PNG ou WebP com atÃ© 20 MB.` : undefined;
};

export const reorderPhotoIds = (ids: string[], source: string, target: string): string[] => {
  if (source === target || !ids.includes(source) || !ids.includes(target)) return [...ids];
  const sourceIndex = ids.indexOf(source);
  const targetIndex = ids.indexOf(target);
  const next = ids.filter((id) => id !== source);
  next.splice(next.indexOf(target) + (sourceIndex < targetIndex ? 1 : 0), 0, source);
  return next;
};
