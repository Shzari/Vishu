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
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
} as const;

type AllowedImageMimeType = keyof typeof IMAGE_EXTENSION_BY_MIME;

const HEIF_FTYP_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
]);
const AVIF_FTYP_BRANDS = new Set(['avif', 'avis']);

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
  return resolveAllowedImageMimeType(mimeType) !== null;
}

export function getSafeImageExtensionForMimeType(mimeType: string) {
  const normalized = normalizeImageMimeType(mimeType);
  const extension = IMAGE_EXTENSION_BY_MIME[normalized as AllowedImageMimeType];

  if (!extension) {
    throw new BadRequestException(
      'Only JPEG, PNG, WebP, GIF, AVIF, HEIC, and HEIF images are allowed',
    );
  }

  return extension;
}

export function resolveAllowedImageMimeType(
  mimeType: string,
  fileName?: string,
): AllowedImageMimeType | null {
  const normalized = normalizeImageMimeType(mimeType);
  if (normalized in IMAGE_EXTENSION_BY_MIME) {
    return normalized as AllowedImageMimeType;
  }

  const extension = fileName?.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  switch (extension) {
    case 'gif':
      return 'image/gif';
    case 'avif':
      return 'image/avif';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'jpg':
    case 'jpeg':
    case 'jfif':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
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
  const header = Buffer.alloc(64);

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
      header.subarray(8, 12).toString('ascii') === 'WEBP') ||
    (normalized === 'image/avif' && hasIsoBaseMediaBrand(header, AVIF_FTYP_BRANDS)) ||
    ((normalized === 'image/heic' || normalized === 'image/heif') &&
      hasIsoBaseMediaBrand(header, HEIF_FTYP_BRANDS));

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

export function readCookieValue(
  cookieHeader: string | undefined,
  name: string,
) {
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
    configService?.get<string>('APP_BASE_URL') ??
    process.env.APP_BASE_URL ??
    '';
  const adminBaseUrl =
    configService?.get<string>('ADMIN_BASE_URL') ??
    process.env.ADMIN_BASE_URL ??
    '';
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

  const normalizedAdminBaseUrl = normalizeOrigin(adminBaseUrl);
  if (normalizedAdminBaseUrl) {
    origins.add(normalizedAdminBaseUrl);
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

export function isAdminPortRequest(
  request: {
    headers?: Record<string, string | string[] | undefined>;
    hostname?: string;
  },
  configService?: Pick<ConfigService, 'get'>,
) {
  const adminPort =
    configService?.get<string>('ADMIN_PORT') ?? process.env.ADMIN_PORT ?? '8443';
  const adminBaseUrl =
    configService?.get<string>('ADMIN_BASE_URL') ??
    process.env.ADMIN_BASE_URL ??
    '';
  const allowedOrigins = new Set<string>();
  const normalizedAdminBaseUrl = normalizeOrigin(adminBaseUrl);

  if (normalizedAdminBaseUrl) {
    allowedOrigins.add(normalizedAdminBaseUrl);
  }

  const forwardedHost = firstHeaderValue(request.headers?.['x-forwarded-host']);
  const proxySecret =
    configService?.get<string>('ADMIN_PROXY_SECRET') ??
    process.env.ADMIN_PROXY_SECRET ??
    '';
  const requestProxySecret = firstHeaderValue(
    request.headers?.['x-vishu-admin-proxy'],
  );
  const candidateHosts = [forwardedHost].filter(Boolean) as string[];

  if (proxySecret.trim() && requestProxySecret !== proxySecret.trim()) {
    return false;
  }

  if (candidateHosts.some((value) => hostHasPort(value, adminPort))) {
    return true;
  }

  if (
    candidateHosts.some((value) => {
      const normalizedHost = value.trim().toLowerCase();
      const hostOrigins = [
        normalizeOrigin(`https://${normalizedHost}`),
        normalizeOrigin(`http://${normalizedHost}`),
      ].filter(Boolean) as string[];

      return hostOrigins.some((candidate) => allowedOrigins.has(candidate));
    })
  ) {
    return true;
  }

  return false;
}

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function hostHasPort(value: string | undefined, port: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized === `vishu.shop:${port}` || normalized.endsWith(`:${port}`);
}

function normalizeImageMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

function hasIsoBaseMediaBrand(header: Buffer, allowedBrands: Set<string>) {
  if (
    header.length < 12 ||
    header.subarray(4, 8).toString('ascii') !== 'ftyp'
  ) {
    return false;
  }

  for (let offset = 8; offset + 4 <= header.length; offset += 4) {
    if (allowedBrands.has(header.subarray(offset, offset + 4).toString('ascii'))) {
      return true;
    }
  }

  return false;
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

function shouldUseSecureCookies(configService?: Pick<ConfigService, 'get'>) {
  const nodeEnv =
    configService?.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? '';

  if (nodeEnv === 'production') {
    return true;
  }

  const allowedOrigins = resolveAllowedBrowserOrigins(configService);
  const hasLocalDevOrigin = allowedOrigins.some((origin) =>
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin),
  );

  if (hasLocalDevOrigin) {
    return false;
  }

  const appBaseUrl =
    configService?.get<string>('APP_BASE_URL') ??
    process.env.APP_BASE_URL ??
    '';

  return appBaseUrl.startsWith('https://');
}

function getAuthCookieMaxAge(configService?: Pick<ConfigService, 'get'>) {
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
