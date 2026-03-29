import {
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

export class UpdateLogDto {
  @ApiProperty({
    description: 'Timestamp de cuándo el cliente cargó el log (para conflict detection)',
  })
  @IsDateString()
  client_updated_at: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    required: false,
    type: [CreateSetDto],
    description: 'Reemplaza todos los sets del log',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSetDto)
  sets?: CreateSetDto[];
}
