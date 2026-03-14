import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Coach } from '../users/coach.entity';

@Entity('exercises')
export class Exercise {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 100 })
  category: string;

  @Column('text', { array: true, name: 'muscle_groups', default: '{}' })
  muscleGroups: string[];

  @Column({ name: 'video_url', length: 500, nullable: true })
  videoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => Coach, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: Coach | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
