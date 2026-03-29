import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateSetDto } from './create-set.dto';

export class CreateLogDto {
  @ApiProperty({ description: 'ID de la sesión activa' })
  @IsUUID()
  session_id: string;

  @ApiProperty({ description: 'ID del ejercicio registrado' })
  @IsUUID()
  exercise_id: string;

  @ApiPropertyOptional({ description: 'Timestamp del log. Default: ahora' })
  @IsOptional()
  @IsDateString()
  logged_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateSetDto], description: 'Sets del ejercicio' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSetDto)
  sets: CreateSetDto[];
}
