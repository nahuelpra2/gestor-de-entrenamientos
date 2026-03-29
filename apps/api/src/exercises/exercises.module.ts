import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercise } from './exercise.entity';
import { Coach } from '../users/coach.entity';
import { Athlete } from '../users/athlete.entity';
import { ExercisesService } from './exercises.service';
import { ExercisesController } from './exercises.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Exercise, Coach, Athlete])],
  controllers: [ExercisesController],
  providers: [ExercisesService],
  exports: [ExercisesService, TypeOrmModule],
})
export class ExercisesModule {}
