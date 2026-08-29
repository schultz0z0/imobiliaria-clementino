import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
  ImageValidationError,
  MAX_IMAGE_BYTES,
  processPropertyImage,
} from './imageProcessor.ts';

const temporaryDirectories: string[] = [];
sharp.cache(false);
const execFileAsync = promisify(execFile);
const heicFixture = fileURLToPath(new URL('./fixtures/tiny.heic', import.meta.url));
const tiffFixture = fileURLToPath(new URL('./fixtures/tiny.tiff', import.meta.url));
const animatedWebpFixture = fileURLToPath(
  new URL('./fixtures/animated.webp', import.meta.url),
);
const hasSystemHeicDecoder = await execFileAsync('heif-convert', ['--help'])
  .then(() => true)
  .catch(() => false);

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'clementino-image-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }),
    ),
  );
});

test('sniffs real bytes instead of trusting the extension or declared MIME', async () => {
  const directory = await temporaryDirectory();
  const inputPath = path.join(directory, 'pretends-to-be.jpeg');
  await writeFile(
    inputPath,
    await sharp({ create: { width: 32, height: 24, channels: 3, background: '#a05a2c' } })
      .png()
      .toBuffer(),
  );

  const result = await processPropertyImage({
    inputPath,
    outputDirectory: path.join(directory, 'processed'),
    byteSize: (await sharp(inputPath).toBuffer()).byteLength,
  });

  assert.equal(result.mimeType, 'image/png');
  assert.match(result.checksumSha256, /^[a-f0-9]{64}$/);
});

test('rejects a matching magic prefix when the decoder cannot validate the image', async () => {
  const directory = await temporaryDirectory();
  const inputPath = path.join(directory, 'broken.png');
  const bytes = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  await writeFile(inputPath, bytes);

  await assert.rejects(
    processPropertyImage({
      inputPath,
      outputDirectory: path.join(directory, 'processed'),
      byteSize: bytes.byteLength,
    }),
    (error: unknown) =>
      error instanceof ImageValidationError && error.code === 'INVALID_IMAGE',
  );
});

test('rejects unsupported types and declared byte sizes over 20 MB', async () => {
  const directory = await temporaryDirectory();
  const gifPath = path.join(directory, 'image.jpg');
  const gif = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#fff' },
  })
    .gif()
    .toBuffer();
  await writeFile(gifPath, gif);

  await assert.rejects(
    processPropertyImage({
      inputPath: gifPath,
      outputDirectory: path.join(directory, 'gif-output'),
      byteSize: gif.byteLength,
    }),
    (error: unknown) =>
      error instanceof ImageValidationError && error.code === 'UNSUPPORTED_IMAGE_TYPE',
  );

  await assert.rejects(
    processPropertyImage({
      inputPath: gifPath,
      outputDirectory: path.join(directory, 'large-output'),
      byteSize: MAX_IMAGE_BYTES + 1,
    }),
    (error: unknown) =>
      error instanceof ImageValidationError && error.code === 'IMAGE_TOO_LARGE',
  );
});

test('rejects dimensions that exceed the decoder safety limits before rendering derivatives', async () => {
  const directory = await temporaryDirectory();
  const inputPath = path.join(directory, 'too-wide.png');
  const png = await sharp({
    create: { width: 12_001, height: 1, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  await writeFile(inputPath, png);

  await assert.rejects(
    processPropertyImage({
      inputPath,
      outputDirectory: path.join(directory, 'processed'),
      byteSize: png.byteLength,
    }),
    (error: unknown) =>
      error instanceof ImageValidationError && error.code === 'IMAGE_DIMENSIONS_EXCEEDED',
  );
});

test('classifies a high-compression total-pixel bomb as a dimension limit rejection', async () => {
  const directory = await temporaryDirectory();
  const inputPath = path.join(directory, 'pixel-bomb.png');
  const png = await sharp({
    create: { width: 7_000, height: 6_000, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  await writeFile(inputPath, png);

  await assert.rejects(
    processPropertyImage({
      inputPath,
      outputDirectory: path.join(directory, 'processed'),
      byteSize: png.byteLength,
    }),
    (error: unknown) =>
      error instanceof ImageValidationError && error.code === 'IMAGE_DIMENSIONS_EXCEEDED',
  );
});

test('explicitly rejects animated WebP uploads', async () => {
  const directory = await temporaryDirectory();
  const bytes = await readFile(animatedWebpFixture);
  await assert.rejects(
    processPropertyImage({
      inputPath: animatedWebpFixture,
      outputDirectory: path.join(directory, 'processed'),
      byteSize: bytes.byteLength,
    }),
    (error: unknown) =>
      error instanceof ImageValidationError && error.code === 'MULTIPAGE_IMAGE_UNSUPPORTED',
  );
});

test('accepts a static WebP upload as input', async () => {
  const directory = await temporaryDirectory();
  const inputPath = path.join(directory, 'static.webp');
  const webp = await sharp({
    create: { width: 18, height: 10, channels: 3, background: '#2f4f4f' },
  })
    .webp()
    .toBuffer();
  await writeFile(inputPath, webp);
  const result = await processPropertyImage({
    inputPath,
    outputDirectory: path.join(directory, 'processed'),
    byteSize: webp.byteLength,
  });
  assert.equal(result.mimeType, 'image/webp');
});

test('auto-rotates orientation, strips EXIF, and writes bounded WebP derivatives', async () => {
  const directory = await temporaryDirectory();
  const inputPath = path.join(directory, 'oriented.jpg');
  const jpeg = await sharp({
    create: { width: 400, height: 200, channels: 3, background: '#4682b4' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  await writeFile(inputPath, jpeg);

  const result = await processPropertyImage({
    inputPath,
    outputDirectory: path.join(directory, 'processed'),
    byteSize: jpeg.byteLength,
  });

  assert.equal(result.width, 200);
  assert.equal(result.height, 400);
  assert.deepEqual(Object.keys(result.derivatives).sort(), ['cover', 'gallery', 'thumb']);
  for (const [variant, derivative] of Object.entries(result.derivatives)) {
    const metadata = await sharp(derivative.path).metadata();
    assert.equal(metadata.format, 'webp', variant);
    assert.equal(metadata.exif, undefined, variant);
    assert.equal(metadata.orientation, undefined, variant);
    assert.ok((metadata.width ?? Infinity) <= derivative.maxWidth, variant);
    assert.ok((metadata.height ?? Infinity) <= derivative.maxHeight, variant);
  }
});

test('accepts a real TIFF image and validates it through the decoder', async () => {
  const directory = await temporaryDirectory();
  const inputPath = tiffFixture;
  const tiff = await readFile(inputPath);

  const result = await processPropertyImage({
    inputPath,
    outputDirectory: path.join(directory, 'processed'),
    byteSize: tiff.byteLength,
  });

  assert.equal(result.mimeType, 'image/tiff');
  assert.equal((await sharp(result.derivatives.gallery.path).metadata()).format, 'webp');
});

test('accepts a real HEIC fixture through the production decoder fallback contract', async () => {
  const directory = await temporaryDirectory();
  const decodedPng = await sharp({
    create: { width: 24, height: 16, channels: 3, background: '#bc8f8f' },
  })
    .png()
    .toBuffer();
  const result = await processPropertyImage({
    inputPath: heicFixture,
    outputDirectory: path.join(directory, 'processed'),
    byteSize: 293_608,
    heifDecoder: async (_source, destination) => writeFile(destination, decodedPng),
  });

  assert.equal(result.mimeType, 'image/heif');
  assert.equal((await sharp(result.derivatives.thumb.path).metadata()).format, 'webp');
});

test(
  'decodes the real HEIC fixture with the installed production codec',
  { skip: hasSystemHeicDecoder ? false : 'heif-convert is installed in the production container' },
  async () => {
    const directory = await temporaryDirectory();
    const result = await processPropertyImage({
      inputPath: heicFixture,
      outputDirectory: path.join(directory, 'processed'),
      byteSize: 293_608,
    });
    assert.equal(result.mimeType, 'image/heif');
  },
);
