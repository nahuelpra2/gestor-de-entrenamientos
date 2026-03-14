import { IsOptional, IsString, IsInt, Min, Max, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteSessionDto {
  @ApiProperty({ required: false, description: 'Esfuerzo percibido 1–10' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  perceivedEffort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, description: 'Timestamp de finalización. Default: ahora' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
