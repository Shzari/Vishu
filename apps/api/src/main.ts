import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { existsSync, mkdirSync, statSync } from 'fs';
import { join, normalize, sep } from 'path';
import {
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  ensureTemporaryUploadDir,
  getJwtSecret,
  hasAuthCookie,
  isSafeHttpMethod,
  isTrustedBrowserOrigin,
  resolveAllowedBrowserOrigins,
} from './common/security/security.utils';
import { PlatformSecretsService } from './common/security/platform-secrets.service';
import { AppModule } from './app.module';

async function bootstrap() {
  ensureTemporaryUploadDir();
  mkdirSync('./uploads', { recursive: true });

  const app = await NestFactory.create(AppModule);
  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  express.set('trust proxy', 1);
  const uploadRoot = join(process.cwd(), 'uploads');
  const sendMediaNotFound = (res: Response) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    res.status(404).json({
      message: 'Media file not found',
      error: 'Not Found',
      statusCode: 404,
    });
  };
  express.use('/media', (req: Request, res: Response, next: NextFunction) => {
    let decodedPath = '/';
    try {
      decodedPath = decodeURIComponent(req.path || '/');
    } catch {
      sendMediaNotFound(res);
      return;
    }
    const relativePath = decodedPath.replace(/^[/\\]+/, '');
    const targetPath = normalize(join(uploadRoot, relativePath));
    const normalizedRoot = normalize(uploadRoot);
    const isInsideUploadRoot =
      targetPath === normalizedRoot ||
      targetPath.startsWith(`${normalizedRoot}${sep}`);

    if (
      !relativePath ||
      !isInsideUploadRoot ||
      !existsSync(targetPath) ||
      !statSync(targetPath).isFile()
    ) {
      sendMediaNotFound(res);
      return;
    }

    next();
  });
  getJwtSecret();
  const configService = app.get(ConfigService);
  const allowedOrigins = resolveAllowedBrowserOrigins(configService);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER_NAME],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use((req, res, next) => {
    const hasBearerToken = req.headers.authorization?.startsWith('Bearer ');
    const hasCookieSession = hasAuthCookie(req.headers.cookie);

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    const requiresCsrfProtection =
      !isSafeHttpMethod(req.method) && hasCookieSession && !hasBearerToken;

    if (requiresCsrfProtection) {
      const csrfHeader = req.header(CSRF_HEADER_NAME);
      const trustedOrigin = isTrustedBrowserOrigin(
        req.header('origin'),
        req.header('referer'),
        configService,
      );

      if (csrfHeader !== CSRF_HEADER_VALUE || !trustedOrigin) {
        res.status(403).json({
          message:
            'Blocked a state-changing cookie-authenticated request that did not pass origin verification.',
        });
        return;
      }
    }

    if (
      req.path.startsWith('/auth') ||
      req.path.startsWith('/account') ||
      hasCookieSession ||
      hasBearerToken
    ) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });
  await app.init();
  await app.get(PlatformSecretsService).migrateStoredPlatformSecrets();
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
