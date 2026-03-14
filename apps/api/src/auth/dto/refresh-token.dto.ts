import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  // El token opaco es 48 bytes en hex = 96 chars exactos
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  refresh_token: string;
}
