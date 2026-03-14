import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TrainingPlan } from './training-plan.entity';
import { Athlete } from '../../users/athlete.entity';
import { Coach } from '../../users/coach.entity';

export type AssignmentStatus = 'active' | 'paused' | 'completed' | 'cancelled';

@Entity('plan_assignments')
export class PlanAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @ManyToOne(() => TrainingPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: TrainingPlan;

  @Column({ name: 'athlete_id' })
  athleteId: string;

  @ManyToOne(() => Athlete)
  @JoinColumn({ name: 'athlete_id' })
  athlete: Athlete;

  @Column({ name: 'assigned_by' })
  assignedBy: string;

  @ManyToOne(() => Coach)
  @JoinColumn({ name: 'assigned_by' })
  coach: Coach;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({
    type: 'enum',
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active',
  })
  status: AssignmentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
