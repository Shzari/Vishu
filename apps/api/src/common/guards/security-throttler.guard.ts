import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class SecurityThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const forwardedForHeader = req.headers?.['x-forwarded-for'];
    const forwardedForValue = Array.isArray(forwardedForHeader)
      ? forwardedForHeader[0]
      : forwardedForHeader;

    if (typeof forwardedForValue === 'string' && forwardedForValue.trim()) {
      const firstForwardedIp = forwardedForValue
        .split(',')
        .map((entry) => entry.trim())
        .find(Boolean);
      if (firstForwardedIp) {
        return firstForwardedIp;
      }
    }

    if (Array.isArray(req.ips) && req.ips.length > 0) {
      return req.ips[0];
    }

    return req.ip;
  }
}
