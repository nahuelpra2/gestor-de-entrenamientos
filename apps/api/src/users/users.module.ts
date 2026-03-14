import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Coach } from './coach.entity';
import { Athlete } from './athlete.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Coach, Athlete])],
  exports: [TypeOrmModule],
})
export class UsersModule {}
