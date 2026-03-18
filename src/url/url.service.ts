import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { nanoid } from 'nanoid';
import { Url, UrlDocument } from './schemas/url.schema';
import { CreateUrlDto } from './dto/create-url.dto';

@Injectable()
export class UrlService {
  private readonly appUrl: string;

  constructor(
    @InjectModel(Url.name) private readonly urlModel: Model<UrlDocument>,
    private readonly config: ConfigService,
  ) {
    this.appUrl = this.config.getOrThrow<string>('APP_URL');
  }

  async shorten(dto: CreateUrlDto): Promise<{ shortUrl: string; shortCode: string }> {
    const shortCode = nanoid(7);
    await this.urlModel.create({ originalUrl: dto.url, shortCode });
    return {
      shortCode,
      shortUrl: `${this.appUrl}/${shortCode}`,
    };
  }

  async getOriginalUrl(shortCode: string): Promise<string> {
    const record = await this.urlModel.findOne({ shortCode }).lean().exec();
    if (!record) {
      throw new NotFoundException(`Short URL not found`);
    }
    return record.originalUrl;
  }
}
