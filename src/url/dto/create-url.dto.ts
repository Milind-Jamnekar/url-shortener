import { IsInt, IsOptional, IsPositive, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsUrl } from 'class-validator';

export class CreateUrlDto {
  @IsUrl({ require_protocol: true }, { message: 'url must be a valid URL including http:// or https://' })
  url: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'slug must be at least 3 characters' })
  @MaxLength(50, { message: 'slug must be at most 50 characters' })
  @Matches(/^[a-zA-Z0-9-]+$/, { message: 'slug may only contain letters, numbers, and hyphens' })
  slug?: string;

  // How long the link should live, in seconds.
  // Common values: 3600 = 1 hour, 86400 = 1 day, 604800 = 1 week, 2592000 = 30 days
  @IsOptional()
  @IsInt({ message: 'expiresInSeconds must be an integer' })
  @IsPositive({ message: 'expiresInSeconds must be a positive number' })
  expiresInSeconds?: number;
}
