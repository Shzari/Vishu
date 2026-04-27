import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from '../decorators/rate-limit.decorator';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blockedUntil: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitEntry>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    const options = this.reflector.getAllAndOverride<
      RateLimitOptions | undefined
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const key = this.buildKey(request);
    this.cleanupExpiredEntries(now);

    const existing = this.store.get(key);
    if (!existing || existing.resetAt <= now) {
      this.store.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
        blockedUntil: 0,
      });
      return true;
    }

    if (existing.blockedUntil > now) {
      throw this.buildRateLimitException();
    }

    existing.count += 1;
    if (existing.count > options.max) {
      existing.blockedUntil =
        now + (options.blockDurationMs ?? options.windowMs);
      throw this.buildRateLimitException();
    }

    this.store.set(key, existing);
    return true;
  }

  private buildKey(request: Request) {
    const ip = this.getClientIp(request);
    const route =
      request.route?.path ??
      request.originalUrl?.split('?')[0] ??
      request.url ??
      'unknown';

    return `${request.method}:${route}:${ip}`;
  }

  private getClientIp(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0];
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private cleanupExpiredEntries(now: number) {
    if (this.store.size < 5000) {
      return;
    }

    for (const [key, value] of this.store.entries()) {
      if (value.resetAt <= now && value.blockedUntil <= now) {
        this.store.delete(key);
      }
    }
  }

  private buildRateLimitException() {
    return new HttpException(
      'Too many requests. Please wait and try again.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
