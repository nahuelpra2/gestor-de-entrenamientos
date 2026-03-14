import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Coach } from '../users/coach.entity';
import { Athlete } from '../users/athlete.entity';
import { AthletesService } from './athletes.service';
import { AthletesController } from './athletes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Coach, Athlete])],
  controllers: [AthletesController],
  providers: [AthletesService],
  exports: [AthletesService],
})
export class AthletesModule {}
