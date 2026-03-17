import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, UpdateDateColumn } from 'typeorm';
import { WorkoutSession } from './workout-session.entity';
import { WorkoutSet } from './workout-set.entity';
import { Athlete } from '../../users/athlete.entity';
import { TrainingDay } from '../../plans/entities/training-day.entity';

@Entity('workout_logs')
export class WorkoutLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workout_session_id', type: 'uuid' })
  workoutSessionId: string;

  @ManyToOne(() => WorkoutSession, (session) => session.logs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workout_session_id' })
  session: WorkoutSession;

  @Column({ name: 'athlete_id', type: 'uuid' })
  athleteId: string;

  @ManyToOne(() => Athlete)
  @JoinColumn({ name: 'athlete_id' })
  athlete: Athlete;

  @Column({ name: 'exercise_id', type: 'uuid' })
  exerciseId: string;

  @Column({ name: 'training_day_id', type: 'uuid', nullable: true })
  trainingDayId: string | null;

  @ManyToOne(() => TrainingDay, { nullable: true })
  @JoinColumn({ name: 'training_day_id' })
  trainingDay: TrainingDay | null;

  @Column({ name: 'logged_at', type: 'timestamptz' })
  loggedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => WorkoutSet, (set) => set.workoutLog, {
    cascade: true,
    eager: false,
  })
  sets: WorkoutSet[];

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
