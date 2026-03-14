import {
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

export class UpdateLogDto {
  @ApiProperty({
    description: 'Timestamp de cuándo el cliente cargó el log (para conflict detection)',
  })
  @IsDateString()
  clientUpdatedAt: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
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
