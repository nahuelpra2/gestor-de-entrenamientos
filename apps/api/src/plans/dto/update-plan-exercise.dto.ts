import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePlanExerciseDto } from './create-plan-exercise.dto';

// Al actualizar no se puede cambiar el exercise_id (crear uno nuevo en su lugar)
export class UpdatePlanExerciseDto extends PartialType(
  OmitType(CreatePlanExerciseDto, ['exercise_id'] as const),
) {}
