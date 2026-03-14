import {
  IsEmail,
  IsString,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAthleteDto {
  @ApiProperty({ example: 'María López' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'atleta@gmail.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ example: '1995-06-15', description: 'Fecha de nacimiento YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @ApiPropertyOptional({ example: 'America/Argentina/Buenos_Aires' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}
