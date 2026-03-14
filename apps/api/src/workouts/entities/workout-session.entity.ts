import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Athlete } from '../../users/athlete.entity';
import { PlanAssignment } from '../../plans/entities/plan-assignment.entity';
import { TrainingDay } from '../../plans/entities/training-day.entity';
import { WorkoutLog } from './workout-log.entity';

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

@Entity('workout_sessions')
export class WorkoutSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'athlete_id' })
  athleteId: string;

  @ManyToOne(() => Athlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athlete_id' })
  athlete: Athlete;

  @Column({ name: 'plan_assignment_id', nullable: true })
  planAssignmentId: string | null;

  @ManyToOne(() => PlanAssignment, { nullable: true })
  @JoinColumn({ name: 'plan_assignment_id' })
  planAssignment: PlanAssignment | null;

  @Column({ name: 'training_day_id', nullable: true })
  trainingDayId: string | null;

  @ManyToOne(() => TrainingDay, { nullable: true })
  @JoinColumn({ name: 'training_day_id' })
  trainingDay: TrainingDay | null;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'perceived_effort', type: 'int', nullable: true })
  perceivedEffort: number | null; // 1–10

  @Column({
    type: 'enum',
    enum: ['in_progress', 'completed', 'abandoned'],
    default: 'in_progress',
  })
  status: SessionStatus;

  @OneToMany(() => WorkoutLog, (log) => log.session)
  logs: WorkoutLog[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
