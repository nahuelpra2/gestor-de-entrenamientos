import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty({ example: 'Hipertrofia 12 semanas' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(104) // 2 años máximo
  total_weeks?: number;

  @ApiPropertyOptional({ example: 4, description: 'Semanas del ciclo que se repite' })
  @IsOptional()
  @IsInt()
  @Min(1)
  // cycle_weeks debe ser <= total_weeks
  @ValidateIf((o) => o.total_weeks !== undefined)
  @Max(104)
  cycle_weeks?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  auto_cycle?: boolean;
}
