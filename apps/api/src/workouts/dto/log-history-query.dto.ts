import { IsOptional, IsUUID, IsDateString, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogHistoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  exercise_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  session_id?: string;

  @ApiPropertyOptional({ description: 'Desde (ISO8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta (ISO8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Cursor opaco de paginación' })
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ default: false, description: 'Incluir sets en la respuesta' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_sets?: boolean = false;
}
