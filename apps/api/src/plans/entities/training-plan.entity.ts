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

  @Column({ name: 'coach_id' })
  coachId: string;

  @ManyToOne(() => Coach, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coach_id' })
  coach: Coach;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'total_weeks', nullable: true })
  totalWeeks: number | null;

  @Column({ name: 'cycle_weeks', nullable: true })
  cycleWeeks: number | null;

  @Column({ name: 'auto_cycle', default: false })
  autoCycle: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
