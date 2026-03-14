import { IsOptional, IsUUID, IsDateString, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LogHistoryQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  exerciseId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  trainingDayId?: string;

  @ApiProperty({ required: false, description: 'Desde (ISO8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, description: 'Hasta (ISO8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false, description: 'Cursor opaco de paginación' })
  @IsOptional()
  cursor?: string;

  @ApiProperty({ required: false, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ required: false, default: false, description: 'Incluir sets en la respuesta' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeSets?: boolean = false;
}
