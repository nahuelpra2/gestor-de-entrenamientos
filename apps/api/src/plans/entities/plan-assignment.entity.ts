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

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @ManyToOne(() => TrainingPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: TrainingPlan;

  @Column({ name: 'athlete_id', type: 'uuid' })
  athleteId: string;

  @ManyToOne(() => Athlete)
  @JoinColumn({ name: 'athlete_id' })
  athlete: Athlete;

  @Column({ name: 'assigned_by', type: 'uuid' })
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
    enumName: 'assignment_status',
    default: 'active',
  })
  status: AssignmentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
