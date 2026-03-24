import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  mkdirSync('./uploads/tmp', { recursive: true });

  const app = await NestFactory.create(AppModule);
  const defaultOrigins =
    process.env.NODE_ENV === 'production'
      ? ['https://vishu.shop', 'https://www.vishu.shop']
      : ['http://localhost:3001'];

  app.enableCors({
    origin:
      process.env.CORS_ORIGIN?.split(',').map((value) => value.trim()) ??
      defaultOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
