import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsArray,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExerciseDto {
  @ApiProperty({ example: 'Sentadilla con barra' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'strength', description: 'strength | cardio | flexibility' })
  @IsString()
  @MaxLength(100)
  category: string;

  @ApiPropertyOptional({ example: ['quadriceps', 'glutes'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  muscle_groups?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  video_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;
}
