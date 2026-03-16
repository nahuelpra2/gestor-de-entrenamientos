import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TrainingDay } from './training-day.entity';
import { Exercise } from '../../exercises/exercise.entity';

@Entity('plan_day_exercises')
export class PlanDayExercise {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'training_day_id', type: 'uuid' })
  trainingDayId: string;

  @ManyToOne(() => TrainingDay, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'training_day_id' })
  trainingDay: TrainingDay;

  @Column({ name: 'exercise_id', type: 'uuid' })
  exerciseId: string;

  @ManyToOne(() => Exercise)
  @JoinColumn({ name: 'exercise_id' })
  exercise: Exercise;

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @Column({ name: 'sets_target' })
  setsTarget: number;

  @Column({ name: 'reps_target', length: 20 })
  repsTarget: string; // "8-12", "max", "30s"

  @Column({ name: 'weight_target', type: 'varchar', length: 50, nullable: true })
  weightTarget: string | null; // "70% 1RM", "60kg"

  @Column({ name: 'rest_seconds', type: 'int', nullable: true })
  restSeconds: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
