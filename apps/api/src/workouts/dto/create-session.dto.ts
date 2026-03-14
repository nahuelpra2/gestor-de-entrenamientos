import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({ required: false, description: 'ID de la asignación de plan activa' })
  @IsOptional()
  @IsUUID()
  planAssignmentId?: string;

  @ApiProperty({ required: false, description: 'ID del training day que se está ejecutando' })
  @IsOptional()
  @IsUUID()
  trainingDayId?: string;

  @ApiProperty({ required: false, description: 'Fecha/hora de inicio (ISO8601). Default: ahora' })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
