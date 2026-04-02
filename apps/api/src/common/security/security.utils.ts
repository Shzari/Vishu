import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { closeSync, existsSync, mkdirSync, openSync, readSync } from 'fs';
import { join } from 'path';
import type { Response } from 'express';

const WEAK_JWT_SECRETS = new Set([
  '',
  'change-me',
  'changeme',
  'replace-with-strong-secret',
  'replace-with-a-long-random-secret',
]);

const IMAGE_EXTENSION_BY_MIME = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
} as const;

type AllowedImageMimeType = keyof typeof IMAGE_EXTENSION_BY_MIME;

export const AUTH_COOKIE_NAME = 'vishu_access_token';
export const CSRF_HEADER_NAME = 'x-vishu-csrf';
export const CSRF_HEADER_VALUE = '1';

export function getJwtSecret(
  configService?: Pick<ConfigService, 'get'>,
): string {
  const configured =
    configService?.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET ?? '';
  const normalized = configured.trim();

  if (WEAK_JWT_SECRETS.has(normalized.toLowerCase())) {
    throw new InternalServerErrorException(
      'JWT_SECRET must be configured with a non-default value before the API can start.',
    );
  }

  return normalized;
}

export function generateOpaqueToken() {
  return randomBytes(32).toString('hex');
}

export function hashOpaqueToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function getTemporaryUploadDir() {
  return join(process.cwd(), '.tmp', 'uploads');
}

export function ensureTemporaryUploadDir() {
  const uploadDir = getTemporaryUploadDir();
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  return uploadDir;
}

export function isAllowedImageMimeType(
  mimeType: string,
): mimeType is AllowedImageMimeType {
  return normalizeImageMimeType(mimeType) in IMAGE_EXTENSION_BY_MIME;
}

export function getSafeImageExtensionForMimeType(mimeType: string) {
  const normalized = normalizeImageMimeType(mimeType);
  const extension =
    IMAGE_EXTENSION_BY_MIME[normalized as AllowedImageMimeType];

  if (!extension) {
    throw new BadRequestException(
      'Only JPEG, PNG, WebP, and GIF images are allowed',
    );
  }

  return extension;
}

export function buildSafeUploadedImageName(prefix: string, mimeType: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}${getSafeImageExtensionForMimeType(mimeType)}`;
}

export function assertStoredImageFileMatchesMimeType(
  filePath: string,
  mimeType: string,
) {
  const normalized = normalizeImageMimeType(mimeType);
  const file = openSync(filePath, 'r');
  const header = Buffer.alloc(12);

  try {
    readSync(file, header, 0, header.length, 0);
  } finally {
    closeSync(file);
  }

  const gifHeader = header.subarray(0, 6).toString('ascii');
  const matches =
    (normalized === 'image/jpeg' &&
      header[0] === 0xff &&
      header[1] === 0xd8 &&
      header[2] === 0xff) ||
    (normalized === 'image/png' &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47) ||
    (normalized === 'image/gif' &&
      (gifHeader === 'GIF87a' || gifHeader === 'GIF89a')) ||
    (normalized === 'image/webp' &&
      header.subarray(0, 4).toString('ascii') === 'RIFF' &&
      header.subarray(8, 12).toString('ascii') === 'WEBP');

  if (!matches) {
    throw new BadRequestException(
      'Uploaded file content does not match the declared image type',
    );
  }
}

export function setAuthCookie(
  response: Response,
  token: string,
  configService?: Pick<ConfigService, 'get'>,
) {
  response.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: shouldUseSecureCookies(configService),
    path: '/',
    maxAge: getAuthCookieMaxAge(configService),
  });
}

export function clearAuthCookie(
  response: Response,
  configService?: Pick<ConfigService, 'get'>,
) {
  response.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: shouldUseSecureCookies(configService),
    path: '/',
  });
}

export function readCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${name}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) {
      continue;
    }

    return decodeURIComponent(trimmed.slice(prefix.length));
  }

  return null;
}

export function hasAuthCookie(cookieHeader: string | undefined) {
  return readCookieValue(cookieHeader, AUTH_COOKIE_NAME) !== null;
}

export function isSafeHttpMethod(method: string | undefined) {
  const normalized = (method ?? 'GET').toUpperCase();
  return (
    normalized === 'GET' ||
    normalized === 'HEAD' ||
    normalized === 'OPTIONS' ||
    normalized === 'TRACE'
  );
}

export function resolveAllowedBrowserOrigins(
  configService?: Pick<ConfigService, 'get'>,
) {
  const configuredOrigins =
    configService?.get<string>('CORS_ORIGIN') ?? process.env.CORS_ORIGIN ?? '';
  const appBaseUrl =
    configService?.get<string>('APP_BASE_URL') ?? process.env.APP_BASE_URL ?? '';
  const nodeEnv =
    configService?.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? '';
  const defaults =
    nodeEnv === 'production'
      ? ['https://vishu.shop', 'https://www.vishu.shop']
      : ['http://localhost:3001'];
  const origins = new Set<string>();

  for (const entry of configuredOrigins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)) {
    const normalized = normalizeOrigin(entry);
    if (normalized) {
      origins.add(normalized);
    }
  }

  const normalizedAppBaseUrl = normalizeOrigin(appBaseUrl);
  if (normalizedAppBaseUrl) {
    origins.add(normalizedAppBaseUrl);
  }

  for (const entry of defaults) {
    const normalized = normalizeOrigin(entry);
    if (normalized) {
      origins.add(normalized);
    }
  }

  return Array.from(origins);
}

export function isTrustedBrowserOrigin(
  originHeader: string | undefined,
  refererHeader: string | undefined,
  configService?: Pick<ConfigService, 'get'>,
) {
  const allowedOrigins = new Set(resolveAllowedBrowserOrigins(configService));
  if (!allowedOrigins.size) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(originHeader);
  if (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  const normalizedRefererOrigin = extractOriginFromUrl(refererHeader);
  if (normalizedRefererOrigin && allowedOrigins.has(normalizedRefererOrigin)) {
    return true;
  }

  return false;
}

function normalizeImageMimeType(mimeType: string) {
  return mimeType.trim().toLowerCase();
}

function normalizeOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return null;
  }
}

function extractOriginFromUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return null;
  }
}

function shouldUseSecureCookies(
  configService?: Pick<ConfigService, 'get'>,
) {
  const appBaseUrl =
    configService?.get<string>('APP_BASE_URL') ?? process.env.APP_BASE_URL ?? '';
  const nodeEnv =
    configService?.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? '';

  return nodeEnv === 'production' || appBaseUrl.startsWith('https://');
}

function getAuthCookieMaxAge(
  configService?: Pick<ConfigService, 'get'>,
) {
  const value =
    configService?.get<string>('JWT_EXPIRES_IN') ??
    process.env.JWT_EXPIRES_IN ??
    '7d';
  const parsed = parseDurationToMs(value);

  return parsed ?? 1000 * 60 * 60 * 24 * 7;
}

function parseDurationToMs(value: string) {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 1000 * 60;
    case 'h':
      return amount * 1000 * 60 * 60;
    case 'd':
      return amount * 1000 * 60 * 60 * 24;
    default:
      return null;
  }
}
