import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateMeasurementDto {
  @ApiPropertyOptional({
    example: '2026-03-14T08:00:00Z',
    description: 'Default: now',
  })
  @IsOptional()
  @IsDateString()
  measured_at?: string;

  @ApiPropertyOptional({ example: 82.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  weight_kg?: number;

  @ApiPropertyOptional({ example: 18.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  body_fat_pct?: number;

  @ApiPropertyOptional({ example: 39.6 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  muscle_mass_kg?: number;

  @ApiPropertyOptional({ example: 'En ayunas' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
