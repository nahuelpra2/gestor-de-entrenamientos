import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, ValueTransformer } from 'typeorm';
import { WorkoutLog } from './workout-log.entity';

const nullableDecimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity('workout_sets')
export class WorkoutSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workout_log_id', type: 'uuid' })
  workoutLogId: string;

  @ManyToOne(() => WorkoutLog, (log) => log.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workout_log_id' })
  workoutLog: WorkoutLog;

  @Column({ name: 'set_number' })
  setNumber: number;

  @Column({ name: 'weight_kg', type: 'decimal', precision: 6, scale: 2, nullable: true, transformer: nullableDecimalTransformer })
  weightKg: number | null;

  @Column({ type: 'int', nullable: true })
  reps: number | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ name: 'distance_meters', type: 'decimal', precision: 8, scale: 2, nullable: true, transformer: nullableDecimalTransformer })
  distanceMeters: number | null;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true, transformer: nullableDecimalTransformer })
  rpe: number | null; // Rate of Perceived Exertion 1–10

  @Column({ name: 'is_warmup', default: false })
  isWarmup: boolean;

  @Column({ name: 'is_failure', default: false })
  isFailure: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

}
