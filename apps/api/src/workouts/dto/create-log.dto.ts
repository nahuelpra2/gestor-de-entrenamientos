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
import { ApiProperty } from '@nestjs/swagger';
import { CreateSetDto } from './create-set.dto';

export class CreateLogDto {
  @ApiProperty({ description: 'ID de la sesión activa' })
  @IsUUID()
  workoutSessionId: string;

  @ApiProperty({ description: 'ID del ejercicio registrado' })
  @IsUUID()
  exerciseId: string;

  @ApiProperty({ required: false, description: 'ID del training day (denormalizado)' })
  @IsOptional()
  @IsUUID()
  trainingDayId?: string;

  @ApiProperty({ required: false, description: 'Timestamp del log. Default: ahora' })
  @IsOptional()
  @IsDateString()
  loggedAt?: string;

  @ApiProperty({ required: false })
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
