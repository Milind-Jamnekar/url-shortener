import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { redisStore } from 'cache-manager-redis-yet';
import { UrlModule } from './url/url.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          url: config.getOrThrow<string>('REDIS_URL'),
        }),
        ttl: config.get<number>('CACHE_TTL_SECONDS', 86400) * 1000, // cache-manager v5 uses ms
      }),
    }),
    ThrottlerModule.forRoot([
      {
        // Default limit: 60 requests per minute (applies to redirect + stats)
        ttl: 60000, // 1 minute in ms
        limit: 60,
      },
    ]),
    UrlModule,
  ],
  providers: [
    // Apply rate limiting globally to all endpoints
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
