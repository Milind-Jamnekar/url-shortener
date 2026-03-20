import { CACHE_MANAGER } from "@nestjs/cache-manager";
import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
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
    // CACHE_TTL_SECONDS is in seconds (default 86400 = 24h) — cache-manager expects milliseconds
    this.cacheTtlMs =
      this.config.get<number>("CACHE_TTL_SECONDS", 86400) * 1000;
  }

  async shorten(
    dto: CreateUrlDto,
  ): Promise<{ shortUrl: string; shortCode: string }> {
    let shortCode: string;

    if (dto.slug) {
      const existing = await this.urlModel.exists({ shortCode: dto.slug });
      if (existing) {
        throw new ConflictException(`Slug "${dto.slug}" is already taken`);
      }
      shortCode = dto.slug;
    } else {
      // Check if this URL was already shortened and hasn't expired
      const duplicate = await this.urlModel
        .findOne({
          originalUrl: dto.url,
          $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
        })
        .lean()
        .exec();

      if (duplicate) {
        this.logger.log(`Duplicate detected — returning existing code: ${duplicate.shortCode}`);
        return {
          shortCode: duplicate.shortCode,
          shortUrl: `${this.appUrl}/${duplicate.shortCode}`,
        };
      }

      shortCode = nanoid(7);
    }

    // Date.now() is in milliseconds, expiresInSeconds is in seconds — multiply by 1000 to convert
    const expiresAt = dto.expiresInSeconds
      ? new Date(Date.now() + dto.expiresInSeconds * 1000)
      : undefined;

    await this.urlModel.create({ originalUrl: dto.url, shortCode, expiresAt });
    this.logger.log(
      `Created short URL — code: ${shortCode} → ${dto.url}${expiresAt ? ` (expires: ${expiresAt.toISOString()})` : ""}`,
    );

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

    if (record.expiresAt && record.expiresAt < new Date()) {
      this.logger.warn(`Short code expired — ${shortCode}`);
      throw new GoneException(`Short URL has expired`);
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
