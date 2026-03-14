import {
  IsUUID,
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanExerciseDto {
  @ApiProperty()
  @IsUUID()
  exercise_id: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order_index?: number;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  @Max(20)
  sets_target: number;

  @ApiProperty({ example: '8-12', description: '"8-12", "max", "30s"' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  reps_target: string;

  @ApiPropertyOptional({ example: '70% 1RM' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  weight_target?: string;

  @ApiPropertyOptional({ example: 180, description: 'Descanso en segundos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  rest_seconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
