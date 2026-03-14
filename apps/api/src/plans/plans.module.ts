import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { TrainingPlan } from './entities/training-plan.entity';
import { TrainingDay } from './entities/training-day.entity';
import { PlanDayExercise } from './entities/plan-day-exercise.entity';
import { PlanAssignment } from './entities/plan-assignment.entity';
import { Athlete } from '../users/athlete.entity';
import { Coach } from '../users/coach.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TrainingPlan,
      TrainingDay,
      PlanDayExercise,
      PlanAssignment,
      Athlete,
      Coach,
    ]),
  ],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
