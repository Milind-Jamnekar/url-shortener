import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, LogLevel } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const logLevels: LogLevel[] = isProd
    ? ['log', 'warn', 'error']
    : ['log', 'warn', 'error', 'debug', 'verbose'];

  const app = await NestFactory.create(AppModule, { logger: logLevels });

  const logger = new Logger('Bootstrap');

  // Security headers — allow Scalar CDN for the API reference UI
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          workerSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  // Auto-validate and transform incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // OpenAPI document
  const appUrl = process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

  const config = new DocumentBuilder()
    .setTitle('URL Shortener API')
    .setDescription('API for shortening URLs, tracking clicks, and managing short links')
    .setVersion('1.0')
    .addServer(appUrl)
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Scalar API reference UI at /reference
  app.use('/reference', apiReference({ content: document, theme: 'purple' }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Application is running on port ${port}`);
  logger.log(`API reference available at http://localhost:${port}/reference`);
}

bootstrap();
