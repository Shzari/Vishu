import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const SECRET_PREFIX = 'enc:v1:';
const AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 12;

export function protectStoredSecret(
  value: string | null | undefined,
  configService?: Pick<ConfigService, 'get'>,
) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if (isStoredSecretProtected(normalized)) {
    return normalized;
  }

  const key = resolveStoredSecretKey(configService);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${SECRET_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString('base64url')}`;
}

export function unprotectStoredSecret(
  value: string | null | undefined,
  configService?: Pick<ConfigService, 'get'>,
) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if (!isStoredSecretProtected(normalized)) {
    return normalized;
  }

  const key = resolveStoredSecretKey(configService);
  const payload = normalized.slice(SECRET_PREFIX.length);

  try {
    const buffer = Buffer.from(payload, 'base64url');
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new InternalServerErrorException(
      'Stored platform secret could not be decrypted. Set PLATFORM_SECRET_ENCRYPTION_KEY explicitly before rotating JWT_SECRET.',
    );
  }
}

export function isStoredSecretProtected(value: string | null | undefined) {
  return value?.trim().startsWith(SECRET_PREFIX) ?? false;
}

function resolveStoredSecretKey(configService?: Pick<ConfigService, 'get'>) {
  const configuredKey =
    configService?.get<string>('PLATFORM_SECRET_ENCRYPTION_KEY') ??
    process.env.PLATFORM_SECRET_ENCRYPTION_KEY ??
    process.env.JWT_SECRET ??
    '';
  const normalized = configuredKey.trim();

  if (!normalized) {
    throw new InternalServerErrorException(
      'PLATFORM_SECRET_ENCRYPTION_KEY or JWT_SECRET must be configured before stored platform secrets can be protected.',
    );
  }

  return createHash('sha256')
    .update(`vishu-stored-secrets:${normalized}`)
    .digest();
}
