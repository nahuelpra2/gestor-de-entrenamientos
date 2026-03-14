import {
  IsInt,
  IsOptional,
  IsBoolean,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTrainingDayDto {
  @ApiProperty({ example: 1, description: 'Semana dentro del plan (1, 2, 3...)' })
  @IsInt()
  @Min(1)
  week_number: number;

  @ApiProperty({ example: 1, description: 'ISO: 1=lunes, 7=domingo' })
  @IsInt()
  @Min(1)
  @Max(7)
  day_of_week: number;

  @ApiPropertyOptional({ example: 'Piernas — Cuádriceps' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_rest_day?: boolean;
}
