import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, LogLevel } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const logLevels: LogLevel[] = isProd
    ? ['log', 'warn', 'error']
    : ['log', 'warn', 'error', 'debug', 'verbose'];

  const app = await NestFactory.create(AppModule, { logger: logLevels });

  const logger = new Logger('Bootstrap');

  // Security headers
  app.use(helmet());

  // Auto-validate and transform incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Application is running on port ${port}`);
}

bootstrap();
