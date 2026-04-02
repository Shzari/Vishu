import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  blockDurationMs?: number;
}

export const RATE_LIMIT_KEY = 'rate_limit_options';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
