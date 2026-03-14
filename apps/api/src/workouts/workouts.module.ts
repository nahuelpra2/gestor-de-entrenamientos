import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkoutsService } from './workouts.service';
import { WorkoutsController } from './workouts.controller';
import { WorkoutSession } from './entities/workout-session.entity';
import { WorkoutLog } from './entities/workout-log.entity';
import { WorkoutSet } from './entities/workout-set.entity';
import { Athlete } from '../users/athlete.entity';
import { PlanAssignment } from '../plans/entities/plan-assignment.entity';
import { TrainingDay } from '../plans/entities/training-day.entity';
import { TrainingPlan } from '../plans/entities/training-plan.entity';
import { PlanDayExercise } from '../plans/entities/plan-day-exercise.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkoutSession,
      WorkoutLog,
      WorkoutSet,
      Athlete,
      PlanAssignment,
      TrainingDay,
      TrainingPlan,
      PlanDayExercise,
    ]),
  ],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
