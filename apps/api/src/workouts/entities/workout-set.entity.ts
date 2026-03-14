import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { WorkoutLog } from './workout-log.entity';

@Entity('workout_sets')
export class WorkoutSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workout_log_id' })
  workoutLogId: string;

  @ManyToOne(() => WorkoutLog, (log) => log.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workout_log_id' })
  workoutLog: WorkoutLog;

  @Column({ name: 'set_number' })
  setNumber: number;

  @Column({ name: 'weight_kg', type: 'decimal', precision: 6, scale: 2, nullable: true })
  weightKg: number | null;

  @Column({ type: 'int', nullable: true })
  reps: number | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ name: 'distance_meters', type: 'decimal', precision: 8, scale: 2, nullable: true })
  distanceMeters: number | null;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  rpe: number | null; // Rate of Perceived Exertion 1–10

  @Column({ name: 'is_warmup', default: false })
  isWarmup: boolean;

  @Column({ name: 'is_failure', default: false })
  isFailure: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
