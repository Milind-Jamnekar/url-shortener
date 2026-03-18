import { IsUrl } from 'class-validator';

export class CreateUrlDto {
  @IsUrl({ require_protocol: true }, { message: 'url must be a valid URL including http:// or https://' })
  url: string;
}
