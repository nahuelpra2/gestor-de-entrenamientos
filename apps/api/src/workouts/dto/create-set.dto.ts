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
import { ApiProperty } from '@nestjs/swagger';

export class CreateSetDto {
  @ApiProperty({ description: 'Número de set (1, 2, 3...)' })
  @IsInt()
  @IsPositive()
  setNumber: number;

  @ApiProperty({ required: false, description: 'Peso en kg' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weightKg?: number;

  @ApiProperty({ required: false, description: 'Repeticiones' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reps?: number;

  @ApiProperty({ required: false, description: 'Duración en segundos' })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @ApiProperty({ required: false, description: 'Distancia en metros' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  distanceMeters?: number;

  @ApiProperty({ required: false, description: 'RPE 1–10' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(10)
  rpe?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isWarmup?: boolean;

  @ApiProperty({ required: false, default: false, description: 'Set hasta el fallo' })
  @IsOptional()
  @IsBoolean()
  isFailure?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
