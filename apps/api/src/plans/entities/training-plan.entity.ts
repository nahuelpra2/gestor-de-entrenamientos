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
import { Coach } from '../../users/coach.entity';

@Entity('training_plans')
export class TrainingPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'coach_id', type: 'uuid' })
  coachId: string;

  @ManyToOne(() => Coach, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coach_id' })
  coach: Coach;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'total_weeks', type: 'int', nullable: true })
  totalWeeks: number | null;

  @Column({ name: 'cycle_weeks', type: 'int', nullable: true })
  cycleWeeks: number | null;

  @Column({ name: 'auto_cycle', default: false })
  autoCycle: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
