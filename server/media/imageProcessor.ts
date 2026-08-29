import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { fileTypeFromFile } from 'file-type';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_WIDTH = 12_000;
export const MAX_IMAGE_HEIGHT = 12_000;
export const MAX_IMAGE_PIXELS = 40_000_000;

export type ImageValidationCode =
  | 'IMAGE_TOO_LARGE'
  | 'UNSUPPORTED_IMAGE_TYPE'
  | 'INVALID_IMAGE'
  | 'IMAGE_DIMENSIONS_EXCEEDED'
  | 'MULTIPAGE_IMAGE_UNSUPPORTED';

export class ImageValidationError extends Error {
  constructor(
    readonly code: ImageValidationCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

const acceptedMimeTypes = new Set([
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/webp',
]);

const expectedSharpFormats: Record<string, string[]> = {
  'image/heic': ['heif'],
  'image/heif': ['heif'],
  'image/jpeg': ['jpeg'],
  'image/png': ['png'],
  'image/tiff': ['tiff'],
  'image/webp': ['webp'],
};

const derivativeSpecifications = {
  cover: { maxWidth: 1_600, maxHeight: 900, quality: 84, fit: 'cover' as const },
  gallery: { maxWidth: 1_920, maxHeight: 1_440, quality: 82, fit: 'inside' as const },
  thumb: { maxWidth: 480, maxHeight: 360, quality: 78, fit: 'cover' as const },
};
const execFileAsync = promisify(execFile);

const MAX_HEIF_BOX_DEPTH = 16;
const heifContainerTypes = new Set(['meta', 'moov', 'trak', 'mdia', 'minf', 'stbl', 'iprp', 'ipco']);

export type HeifDimensions = { width: number; height: number };

const safeHeifDimension = (width: number, height: number): HeifDimensions => {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new ImageValidationError('INVALID_IMAGE', 'The HEIF container has invalid dimensions');
  }
  if (
    width > MAX_IMAGE_WIDTH ||
    height > MAX_IMAGE_HEIGHT ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new ImageValidationError(
      'IMAGE_DIMENSIONS_EXCEEDED',
      'Image dimensions exceed the safe decoder limits',
    );
  }
  return { width, height };
};

/**
 * Reads only structurally bounded ISO-BMFF boxes. HEIF's `ispe` entries are
 * checked before any native converter starts, so an unavailable `heif-info`
 * binary cannot weaken the pixel limit on Windows.
 */
export const readHeifDimensions = async (sourcePath: string): Promise<HeifDimensions> => {
  const bytes = await readFile(sourcePath);
  const dimensions: HeifDimensions[] = [];

  const walk = (start: number, end: number, depth: number, skip = 0): void => {
    if (depth > MAX_HEIF_BOX_DEPTH || start + skip > end) {
      throw new ImageValidationError('INVALID_IMAGE', 'The HEIF container has invalid box nesting');
    }
    let offset = start + skip;
    while (offset < end) {
      if (end - offset < 8) {
        throw new ImageValidationError('INVALID_IMAGE', 'The HEIF container has a truncated box');
      }
      let size = bytes.readUInt32BE(offset);
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      let headerSize = 8;
      if (size === 1) {
        if (end - offset < 16) {
          throw new ImageValidationError('INVALID_IMAGE', 'The HEIF container has a truncated large box');
        }
        const largeSize = bytes.readBigUInt64BE(offset + 8);
        if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new ImageValidationError('INVALID_IMAGE', 'The HEIF container has an invalid box size');
        }
        size = Number(largeSize);
        headerSize = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (size < headerSize || offset + size > end) {
        throw new ImageValidationError('INVALID_IMAGE', 'The HEIF container has an invalid box size');
      }
      const payloadStart = offset + headerSize;
      const boxEnd = offset + size;
      if (type === 'ispe') {
        if (boxEnd - payloadStart < 12) {
          throw new ImageValidationError('INVALID_IMAGE', 'The HEIF ispe box is truncated');
        }
        dimensions.push(
          safeHeifDimension(bytes.readUInt32BE(payloadStart + 4), bytes.readUInt32BE(payloadStart + 8)),
        );
      } else if (heifContainerTypes.has(type)) {
        walk(payloadStart, boxEnd, depth + 1, type === 'meta' ? 4 : 0);
      }
      offset = boxEnd;
    }
  };

  walk(0, bytes.byteLength, 0);
  if (dimensions.length === 0) {
    throw new ImageValidationError('INVALID_IMAGE', 'The HEIF container has no bounded image dimensions');
  }
  return dimensions.reduce(
    (largest, current) =>
      current.width * current.height > largest.width * largest.height ? current : largest,
  );
};

const decodeHeifWithSystemCodec = async (
  sourcePath: string,
  destinationPath: string,
): Promise<void> => {
  await readHeifDimensions(sourcePath);
  try {
    const { stdout } = await execFileAsync('heif-info', [sourcePath], {
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    const topLevelDimensions = Array.from(
      stdout.matchAll(/^image:\s*(\d+)x(\d+)/gim),
      (match) => ({ width: Number(match[1]), height: Number(match[2]) }),
    );
    if (topLevelDimensions.length > 1) {
      throw new ImageValidationError(
        'MULTIPAGE_IMAGE_UNSUPPORTED',
        'Animated and multipage images are not supported',
      );
    }
    if (
      topLevelDimensions.some(
        ({ width, height }) =>
          width > MAX_IMAGE_WIDTH ||
          height > MAX_IMAGE_HEIGHT ||
          width * height > MAX_IMAGE_PIXELS,
      )
    ) {
      throw new ImageValidationError(
        'IMAGE_DIMENSIONS_EXCEEDED',
        'Image dimensions exceed the safe decoder limits',
      );
    }
  } catch (error) {
    const isMissingInspector =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT';
    if (!isMissingInspector) {
      throw error;
    }
  }
  const { stdout, stderr } = await execFileAsync('heif-convert', [sourcePath, destinationPath], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  const information = `${stdout}\n${stderr}`;
  const imageCount = information.match(/File contains\s+(\d+)\s+images?/i);
  if (imageCount && Number(imageCount[1]) !== 1) {
    throw new ImageValidationError(
      'MULTIPAGE_IMAGE_UNSUPPORTED',
      'Animated and multipage images are not supported',
    );
  }
};

const checksumFile = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
};

const asValidationError = (error: unknown): ImageValidationError => {
  if (error instanceof ImageValidationError) {
    return error;
  }
  if (error instanceof Error && /(?:pixel limit|image dimensions? exceed)/i.test(error.message)) {
    return new ImageValidationError(
      'IMAGE_DIMENSIONS_EXCEEDED',
      'Image dimensions exceed the safe decoder limits',
    );
  }
  return new ImageValidationError('INVALID_IMAGE', 'The uploaded bytes are not a valid image');
};

export type ProcessedPropertyImage = {
  checksumSha256: string;
  mimeType: string;
  width: number;
  height: number;
  derivatives: Record<
    keyof typeof derivativeSpecifications,
    { path: string; maxWidth: number; maxHeight: number; byteSize: number }
  >;
};

export const processPropertyImage = async (input: {
  inputPath: string;
  outputDirectory: string;
  byteSize: number;
  heifDecoder?: (sourcePath: string, destinationPath: string) => Promise<void>;
}): Promise<ProcessedPropertyImage> => {
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize < 1) {
    throw new ImageValidationError('INVALID_IMAGE', 'The uploaded image is empty');
  }
  if (input.byteSize > MAX_IMAGE_BYTES) {
    throw new ImageValidationError('IMAGE_TOO_LARGE', 'Images may not exceed 20 MB');
  }

  await mkdir(input.outputDirectory, { recursive: true, mode: 0o700 });
  try {
    const detected = await fileTypeFromFile(input.inputPath);
    if (!detected || !acceptedMimeTypes.has(detected.mime)) {
      throw new ImageValidationError(
        'UNSUPPORTED_IMAGE_TYPE',
        'Only HEIC/HEIF, TIFF, JPEG, PNG, and WebP images are accepted',
      );
    }

    let decoderInputPath = input.inputPath;
    let usedHeifFallback = false;
    if (['image/heic', 'image/heif'].includes(detected.mime)) {
      const decodedPath = path.join(input.outputDirectory, 'decoded-heif.png');
      await readHeifDimensions(input.inputPath);
      try {
        await (input.heifDecoder ?? decodeHeifWithSystemCodec)(input.inputPath, decodedPath);
        decoderInputPath = decodedPath;
        usedHeifFallback = true;
      } catch (error) {
        const isMissingSystemDecoder =
          input.heifDecoder === undefined &&
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'ENOENT';
        if (!isMissingSystemDecoder) {
          throw error;
        }
      }
    }
    let metadata;
    try {
      metadata = await sharp(decoderInputPath, {
        failOn: 'warning',
        limitInputPixels: MAX_IMAGE_PIXELS,
        pages: -1,
        unlimited: false,
      }).metadata();
    } catch (error) {
      if (!['image/heic', 'image/heif'].includes(detected.mime) || usedHeifFallback) {
        throw error;
      }
      decoderInputPath = path.join(input.outputDirectory, 'decoded-heif.png');
      await (input.heifDecoder ?? decodeHeifWithSystemCodec)(input.inputPath, decoderInputPath);
      usedHeifFallback = true;
      metadata = await sharp(decoderInputPath, {
        failOn: 'warning',
        limitInputPixels: MAX_IMAGE_PIXELS,
        pages: -1,
        unlimited: false,
      }).metadata();
    }
    if (
      !metadata.format ||
      (usedHeifFallback
        ? metadata.format !== 'png'
        : !expectedSharpFormats[detected.mime]?.includes(metadata.format))
    ) {
      throw new ImageValidationError(
        'INVALID_IMAGE',
        'The image decoder disagrees with the detected content type',
      );
    }
    if ((metadata.pages ?? 1) !== 1 || (metadata.pageHeight && metadata.height !== metadata.pageHeight)) {
      throw new ImageValidationError(
        'MULTIPAGE_IMAGE_UNSUPPORTED',
        'Animated and multipage images are not supported',
      );
    }
    if (!metadata.width || !metadata.height) {
      throw new ImageValidationError('INVALID_IMAGE', 'The image has no usable dimensions');
    }
    const autoOriented = metadata.autoOrient ?? {
      width: [5, 6, 7, 8].includes(metadata.orientation ?? 1)
        ? metadata.height
        : metadata.width,
      height: [5, 6, 7, 8].includes(metadata.orientation ?? 1)
        ? metadata.width
        : metadata.height,
    };
    if (
      metadata.width > MAX_IMAGE_WIDTH ||
      metadata.height > MAX_IMAGE_HEIGHT ||
      metadata.width * metadata.height > MAX_IMAGE_PIXELS
    ) {
      throw new ImageValidationError(
        'IMAGE_DIMENSIONS_EXCEEDED',
        'Image dimensions exceed the safe decoder limits',
      );
    }

    const derivativeEntries = await Promise.all(
      Object.entries(derivativeSpecifications).map(async ([variant, specification]) => {
        const derivativePath = path.join(input.outputDirectory, `${variant}.webp`);
        const info = await sharp(decoderInputPath, {
          failOn: 'warning',
          limitInputPixels: MAX_IMAGE_PIXELS,
          pages: 1,
          unlimited: false,
        })
          .rotate()
          .resize({
            width: specification.maxWidth,
            height: specification.maxHeight,
            fit: specification.fit,
            position: 'attention',
            withoutEnlargement: true,
          })
          .webp({ quality: specification.quality, effort: 4 })
          .toFile(derivativePath);
        return [
          variant,
          {
            path: derivativePath,
            maxWidth: specification.maxWidth,
            maxHeight: specification.maxHeight,
            byteSize: info.size,
          },
        ] as const;
      }),
    );

    return {
      checksumSha256: await checksumFile(input.inputPath),
      mimeType: detected.mime,
      width: autoOriented.width,
      height: autoOriented.height,
      derivatives: Object.fromEntries(derivativeEntries) as ProcessedPropertyImage['derivatives'],
    };
  } catch (error) {
    await rm(input.outputDirectory, { recursive: true, force: true });
    throw asValidationError(error);
  }
};
