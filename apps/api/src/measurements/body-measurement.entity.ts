import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Athlete } from '../users/athlete.entity';

export type MeasurementSource = 'manual' | 'scale_sync' | 'coach_entered';

@Entity('body_measurements')
export class BodyMeasurement {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @PrimaryColumn({ name: 'measured_at', type: 'timestamptz' })
  measuredAt: Date;

  @Column({ name: 'athlete_id', type: 'uuid' })
  athleteId: string;

  @ManyToOne(() => Athlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athlete_id' })
  athlete: Athlete;

  @Column({ name: 'weight_kg', type: 'decimal', precision: 5, scale: 2, nullable: true })
  weightKg: string | null;

  @Column({ name: 'body_fat_pct', type: 'decimal', precision: 4, scale: 1, nullable: true })
  bodyFatPct: string | null;

  @Column({ name: 'muscle_mass_kg', type: 'decimal', precision: 5, scale: 2, nullable: true })
  muscleMassKg: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: ['manual', 'scale_sync', 'coach_entered'],
    enumName: 'measurement_source',
    default: 'manual',
  })
  source: MeasurementSource;
}
