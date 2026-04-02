import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'fs';

type UploadedImageLike = {
  path?: string;
  mimetype?: string;
};

const IMAGE_SIGNATURES = [
  {
    extension: '.jpg',
    mimeTypes: ['image/jpeg'],
    matches: (buffer: Buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    extension: '.png',
    mimeTypes: ['image/png'],
    matches: (buffer: Buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },
  {
    extension: '.gif',
    mimeTypes: ['image/gif'],
    matches: (buffer: Buffer) =>
      buffer.length >= 6 &&
      (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
        buffer.subarray(0, 6).toString('ascii') === 'GIF89a'),
  },
  {
    extension: '.webp',
    mimeTypes: ['image/webp'],
    matches: (buffer: Buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export function assertSafeUploadedImage(file: UploadedImageLike) {
  if (!file?.path) {
    throw new BadRequestException('Uploaded image could not be processed');
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = readFileSync(file.path);
  } catch {
    throw new BadRequestException('Uploaded image could not be processed');
  }

  if (fileBuffer.length === 0) {
    throw new BadRequestException('Uploaded image is empty');
  }

  const detectedImage = IMAGE_SIGNATURES.find((entry) =>
    entry.matches(fileBuffer),
  );

  if (!detectedImage) {
    throw new BadRequestException(
      'Uploaded image content is invalid or unsupported',
    );
  }

  const normalizedMimeType = file.mimetype?.toLowerCase().trim();
  if (
    normalizedMimeType &&
    !detectedImage.mimeTypes.includes(normalizedMimeType)
  ) {
    throw new BadRequestException(
      'Uploaded image type does not match its file content',
    );
  }

  return {
    extension: detectedImage.extension,
  };
}
