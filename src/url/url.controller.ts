import { Body, Controller, Get, Header, HttpCode, Param, Post, Redirect, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UrlService } from './url.service';
import { CreateUrlDto } from './dto/create-url.dto';

@ApiTags('urls')
@Controller()
export class UrlController {
  constructor(private readonly urlService: UrlService) {}

  @Post('urls')
  @HttpCode(201)
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // stricter: 10 requests per minute
  @ApiOperation({ summary: 'Shorten a URL' })
  @ApiResponse({ status: 201, description: 'Returns the short code and short URL' })
  @ApiResponse({ status: 409, description: 'Slug is already taken' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  shorten(@Body() dto: CreateUrlDto) {
    return this.urlService.shorten(dto);
  }

  @Get('urls/:code/qr')
  @ApiOperation({ summary: 'Get QR code for a short URL' })
  @ApiParam({ name: 'code', example: 'abc1234' })
  @ApiResponse({ status: 200, description: 'Returns a PNG QR code image' })
  @ApiResponse({ status: 404, description: 'Short URL not found' })
  async getQrCode(@Param('code') code: string, @Res() res: Response) {
    const buffer = await this.urlService.getQrCode(code);
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  }

  @Get('urls/:code/stats')
  @ApiOperation({ summary: 'Get click stats for a short URL' })
  @ApiParam({ name: 'code', example: 'abc1234' })
  @ApiResponse({ status: 200, description: 'Returns click count and metadata' })
  @ApiResponse({ status: 404, description: 'Short URL not found' })
  getStats(@Param('code') code: string) {
    return this.urlService.getStats(code);
  }

  @Get(':code')
  @Redirect()
  @ApiOperation({ summary: 'Redirect to original URL' })
  @ApiParam({ name: 'code', example: 'abc1234' })
  @ApiResponse({ status: 301, description: 'Redirects to the original URL' })
  @ApiResponse({ status: 404, description: 'Short URL not found' })
  @ApiResponse({ status: 410, description: 'Short URL has expired' })
  async redirect(@Param('code') code: string) {
    const url = await this.urlService.getOriginalUrl(code);
    return { url, statusCode: 301 };
  }
}
