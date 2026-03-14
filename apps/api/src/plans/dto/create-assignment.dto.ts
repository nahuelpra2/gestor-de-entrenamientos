import { IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssignmentDto {
  @ApiProperty()
  @IsUUID()
  athlete_id: string;

  @ApiProperty({ example: '2026-03-17', description: 'Fecha de inicio del plan YYYY-MM-DD' })
  @IsDateString()
  start_date: string;
}
