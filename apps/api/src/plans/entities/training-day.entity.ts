import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { TrainingPlan } from './training-plan.entity';

@Entity('training_days')
export class TrainingDay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @ManyToOne(() => TrainingPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: TrainingPlan;

  @Column({ name: 'week_number' })
  weekNumber: number;

  @Column({ name: 'day_of_week' })
  dayOfWeek: number; // ISO: 1=lunes, 7=domingo

  @Column({ length: 100, nullable: true })
  name: string | null;

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @Column({ name: 'is_rest_day', default: false })
  isRestDay: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
