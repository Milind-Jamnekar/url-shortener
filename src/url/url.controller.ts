import { Body, Controller, Get, HttpCode, Param, Post, Redirect } from '@nestjs/common';
import { UrlService } from './url.service';
import { CreateUrlDto } from './dto/create-url.dto';

@Controller()
export class UrlController {
  constructor(private readonly urlService: UrlService) {}

  @Post('urls')
  @HttpCode(201)
  shorten(@Body() dto: CreateUrlDto) {
    return this.urlService.shorten(dto);
  }

  @Get(':code')
  @Redirect()
  async redirect(@Param('code') code: string) {
    const url = await this.urlService.getOriginalUrl(code);
    return { url, statusCode: 301 };
  }
}
