import {
  IsInt,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsString,
  Min,
  Max,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSetDto {
  @ApiProperty({ description: 'Número de set (1, 2, 3...)' })
  @IsInt()
  @IsPositive()
  set_number: number;

  @ApiPropertyOptional({ description: 'Peso en kg' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weight_kg?: number;

  @ApiPropertyOptional({ description: 'Repeticiones' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reps?: number;

  @ApiPropertyOptional({ description: 'Duración en segundos' })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration_seconds?: number;

  @ApiPropertyOptional({ description: 'Distancia en metros' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  distance_meters?: number;

  @ApiPropertyOptional({ description: 'RPE 1–10' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(10)
  rpe?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_warmup?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Set hasta el fallo' })
  @IsOptional()
  @IsBoolean()
  is_failure?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
