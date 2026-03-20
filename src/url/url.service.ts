import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Cache } from "cache-manager";
import { Model } from "mongoose";
import { nanoid } from "nanoid";
import { CreateUrlDto } from "./dto/create-url.dto";
import { Url, UrlDocument } from "./schemas/url.schema";

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
    this.appUrl = this.config.getOrThrow<string>("APP_URL");
    this.cacheTtlMs =
      this.config.get<number>("CACHE_TTL_SECONDS", 86400) * 1000;
  }

  async shorten(
    dto: CreateUrlDto,
  ): Promise<{ shortUrl: string; shortCode: string }> {
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
    let cached: string | undefined;
    try {
      cached = await this.cache.get<string>(shortCode);
    } catch (err) {
      this.logger.warn(
        `Cache read failed for ${shortCode} — falling back to MongoDB: ${(err as Error).message}`,
      );
    }

    if (cached) {
      this.logger.debug(`Cache HIT — ${shortCode}`);
      void this.recordClick(shortCode);
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
    try {
      await this.cache.set(shortCode, record.originalUrl, this.cacheTtlMs);
      this.logger.debug(
        `Cached — ${shortCode} (TTL: ${this.cacheTtlMs / 1000}s)`,
      );
    } catch (err) {
      this.logger.warn(
        `Cache write failed for ${shortCode}: ${(err as Error).message}`,
      );
    }

    void this.recordClick(shortCode);
    return record.originalUrl;
  }

  private async recordClick(shortCode: string): Promise<void> {
    try {
      await this.urlModel
        .updateOne(
          { shortCode },
          { $inc: { clicks: 1 }, $set: { lastClickedAt: new Date() } },
        )
        .exec();
    } catch (err) {
      this.logger.warn(
        `Failed to record click for ${shortCode}: ${(err as Error).message}`,
      );
    }
  }

  async getStats(shortCode: string): Promise<{
    shortCode: string;
    originalUrl: string;
    clicks: number;
    lastClickedAt: Date | null;
    createdAt: Date;
  }> {
    const record = await this.urlModel.findOne({ shortCode }).lean().exec();

    if (!record) {
      throw new NotFoundException(`Short URL not found`);
    }

    return {
      shortCode: record.shortCode,
      originalUrl: record.originalUrl,
      clicks: record.clicks,
      lastClickedAt: record.lastClickedAt ?? null,
      createdAt: (record as any).createdAt,
    };
  }
}
