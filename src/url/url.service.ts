import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Model } from 'mongoose';
import { nanoid } from 'nanoid';
import { Url, UrlDocument } from './schemas/url.schema';
import { CreateUrlDto } from './dto/create-url.dto';

@Injectable()
export class UrlService {
  private readonly logger = new Logger(UrlService.name);
  private readonly appUrl: string;
  private readonly cacheTtlMs: number;

  constructor(
    @InjectModel(Url.name) private readonly urlModel: Model<UrlDocument>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
  ) {
    this.appUrl = this.config.getOrThrow<string>('APP_URL');
    this.cacheTtlMs = this.config.get<number>('CACHE_TTL_SECONDS', 86400) * 1000;
  }

  async shorten(dto: CreateUrlDto): Promise<{ shortUrl: string; shortCode: string }> {
    const shortCode = nanoid(7);
    await this.urlModel.create({ originalUrl: dto.url, shortCode });

    this.logger.log(`Created short URL — code: ${shortCode} → ${dto.url}`);

    return {
      shortCode,
      shortUrl: `${this.appUrl}/${shortCode}`,
    };
  }

  async getOriginalUrl(shortCode: string): Promise<string> {
    // 1. Cache hit — return immediately without touching MongoDB
    const cached = await this.cache.get<string>(shortCode);
    if (cached) {
      this.logger.debug(`Cache HIT — ${shortCode}`);
      return cached;
    }

    // 2. Cache miss — query MongoDB
    this.logger.debug(`Cache MISS — ${shortCode}, querying MongoDB`);
    const record = await this.urlModel.findOne({ shortCode }).lean().exec();

    if (!record) {
      this.logger.warn(`Short code not found — ${shortCode}`);
      throw new NotFoundException(`Short URL not found`);
    }

    // 3. Populate cache for next time
    await this.cache.set(shortCode, record.originalUrl, this.cacheTtlMs);
    this.logger.debug(`Cached — ${shortCode} (TTL: ${this.cacheTtlMs / 1000}s)`);

    return record.originalUrl;
  }
}
