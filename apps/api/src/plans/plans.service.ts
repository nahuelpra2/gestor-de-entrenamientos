import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TrainingPlan } from './entities/training-plan.entity';
import { TrainingDay } from './entities/training-day.entity';
import { PlanDayExercise } from './entities/plan-day-exercise.entity';
import { PlanAssignment } from './entities/plan-assignment.entity';
import { Athlete } from '../users/athlete.entity';
import { Coach } from '../users/coach.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateTrainingDayDto } from './dto/create-training-day.dto';
import { CreatePlanExerciseDto } from './dto/create-plan-exercise.dto';
import { UpdatePlanExerciseDto } from './dto/update-plan-exercise.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { assertOwnership } from '../common/utils/ownership.util';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(TrainingPlan)
    private readonly planRepo: Repository<TrainingPlan>,
    @InjectRepository(TrainingDay)
    private readonly dayRepo: Repository<TrainingDay>,
    @InjectRepository(PlanDayExercise)
    private readonly exerciseRepo: Repository<PlanDayExercise>,
    @InjectRepository(PlanAssignment)
    private readonly assignmentRepo: Repository<PlanAssignment>,
    @InjectRepository(Athlete)
    private readonly athleteRepo: Repository<Athlete>,
    @InjectRepository(Coach)
    private readonly coachRepo: Repository<Coach>,
    private readonly dataSource: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // PLANES
  // ══════════════════════════════════════════════════════════════

  async findAllPlans(coachId: string) {
    const plans = await this.planRepo.find({
      where: { coachId },
      order: { createdAt: 'DESC' },
    });
    return plans;
  }

  async findOnePlan(planId: string, coachId: string): Promise<TrainingPlan> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException({ error: 'NOT_FOUND', message: 'Plan no encontrado' });
    assertOwnership(plan.coachId, coachId, 'FORBIDDEN');
    return plan;
  }

  async createPlan(dto: CreatePlanDto, coachId: string): Promise<TrainingPlan> {
    if (dto.cycle_weeks && dto.total_weeks && dto.cycle_weeks > dto.total_weeks) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'cycle_weeks no puede ser mayor que total_weeks',
      });
    }

    const plan = this.planRepo.create({
      coachId,
      name: dto.name,
      description: dto.description ?? null,
      totalWeeks: dto.total_weeks ?? null,
      cycleWeeks: dto.cycle_weeks ?? null,
      autoCycle: dto.auto_cycle ?? false,
    });

    return this.planRepo.save(plan);
  }

  async updatePlan(planId: string, dto: UpdatePlanDto, coachId: string): Promise<TrainingPlan> {
    const plan = await this.findOnePlan(planId, coachId);

    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.description !== undefined) plan.description = dto.description ?? null;
    if (dto.total_weeks !== undefined) plan.totalWeeks = dto.total_weeks ?? null;
    if (dto.cycle_weeks !== undefined) plan.cycleWeeks = dto.cycle_weeks ?? null;
    if (dto.auto_cycle !== undefined) plan.autoCycle = dto.auto_cycle;

    return this.planRepo.save(plan);
  }

  async deletePlan(planId: string, coachId: string): Promise<void> {
    const plan = await this.findOnePlan(planId, coachId);

    const activeAssignment = await this.assignmentRepo.findOne({
      where: { planId: plan.id, status: 'active' },
    });

    if (activeAssignment) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: 'No podés eliminar un plan que tiene asignaciones activas',
      });
    }

    await this.planRepo.remove(plan);
  }

  async duplicatePlan(planId: string, coachId: string): Promise<TrainingPlan> {
    const original = await this.findOnePlan(planId, coachId);
    const days = await this.dayRepo.find({ where: { planId } });

    return this.dataSource.transaction(async (manager) => {
      const newPlan = manager.create(TrainingPlan, {
        coachId,
        name: `${original.name} (copia)`,
        description: original.description,
        totalWeeks: original.totalWeeks,
        cycleWeeks: original.cycleWeeks,
        autoCycle: original.autoCycle,
      });
      await manager.save(newPlan);

      for (const day of days) {
        const newDay = manager.create(TrainingDay, {
          planId: newPlan.id,
          weekNumber: day.weekNumber,
          dayOfWeek: day.dayOfWeek,
          name: day.name,
          orderIndex: day.orderIndex,
          isRestDay: day.isRestDay,
        });
        await manager.save(newDay);

        const exercises = await this.exerciseRepo.find({
          where: { trainingDayId: day.id },
        });

        for (const ex of exercises) {
          const newEx = manager.create(PlanDayExercise, {
            trainingDayId: newDay.id,
            exerciseId: ex.exerciseId,
            orderIndex: ex.orderIndex,
            setsTarget: ex.setsTarget,
            repsTarget: ex.repsTarget,
            weightTarget: ex.weightTarget,
            restSeconds: ex.restSeconds,
            notes: ex.notes,
          });
          await manager.save(newEx);
        }
      }

      return newPlan;
    });
  }

  // ══════════════════════════════════════════════════════════════
  // TRAINING DAYS
  // ══════════════════════════════════════════════════════════════

  async findDays(planId: string, coachId: string) {
    await this.findOnePlan(planId, coachId); // valida ownership
    const days = await this.dayRepo.find({
      where: { planId },
      order: { weekNumber: 'ASC', dayOfWeek: 'ASC' },
    });
    return days;
  }

  async addDay(planId: string, dto: CreateTrainingDayDto, coachId: string): Promise<TrainingDay> {
    await this.findOnePlan(planId, coachId);

    // Verificar que no exista ya ese día en esa semana
    const existing = await this.dayRepo.findOne({
      where: { planId, weekNumber: dto.week_number, dayOfWeek: dto.day_of_week },
    });

    if (existing) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: `La semana ${dto.week_number} ya tiene un día asignado para ese día de la semana`,
      });
    }

    const day = this.dayRepo.create({
      planId,
      weekNumber: dto.week_number,
      dayOfWeek: dto.day_of_week,
      name: dto.name ?? null,
      isRestDay: dto.is_rest_day ?? false,
    });

    return this.dayRepo.save(day);
  }

  async updateDay(
    planId: string,
    dayId: string,
    dto: Partial<CreateTrainingDayDto>,
    coachId: string,
  ): Promise<TrainingDay> {
    await this.findOnePlan(planId, coachId);
    const day = await this.dayRepo.findOne({ where: { id: dayId, planId } });
    if (!day) throw new NotFoundException({ error: 'NOT_FOUND', message: 'Día no encontrado' });

    if (dto.name !== undefined) day.name = dto.name ?? null;
    if (dto.is_rest_day !== undefined) day.isRestDay = dto.is_rest_day;

    return this.dayRepo.save(day);
  }

  async deleteDay(planId: string, dayId: string, coachId: string): Promise<void> {
    await this.findOnePlan(planId, coachId);
    const day = await this.dayRepo.findOne({ where: { id: dayId, planId } });
    if (!day) throw new NotFoundException({ error: 'NOT_FOUND', message: 'Día no encontrado' });
    await this.dayRepo.remove(day);
  }

  // ══════════════════════════════════════════════════════════════
  // EJERCICIOS DEL DÍA
  // ══════════════════════════════════════════════════════════════

  async findDayExercises(planId: string, dayId: string, coachId: string) {
    await this.findOnePlan(planId, coachId);
    return this.exerciseRepo.find({
      where: { trainingDayId: dayId },
      relations: ['exercise'],
      order: { orderIndex: 'ASC' },
    });
  }

  async addExerciseToDay(
    planId: string,
    dayId: string,
    dto: CreatePlanExerciseDto,
    coachId: string,
  ): Promise<PlanDayExercise> {
    await this.findOnePlan(planId, coachId);
    const day = await this.dayRepo.findOne({ where: { id: dayId, planId } });
    if (!day) throw new NotFoundException({ error: 'NOT_FOUND', message: 'Día no encontrado' });

    // Auto-asignar order_index si no se provee
    let orderIndex = dto.order_index;
    if (orderIndex === undefined) {
      const lastEx = await this.exerciseRepo
        .createQueryBuilder('e')
        .where('e.training_day_id = :dayId', { dayId })
        .orderBy('e.order_index', 'DESC')
        .getOne();
      orderIndex = lastEx ? lastEx.orderIndex + 1 : 0;
    }

    const exercise = this.exerciseRepo.create({
      trainingDayId: dayId,
      exerciseId: dto.exercise_id,
      orderIndex,
      setsTarget: dto.sets_target,
      repsTarget: dto.reps_target,
      weightTarget: dto.weight_target ?? null,
      restSeconds: dto.rest_seconds ?? null,
      notes: dto.notes ?? null,
    });

    return this.exerciseRepo.save(exercise);
  }

  async updateDayExercise(
    planId: string,
    dayId: string,
    exId: string,
    dto: UpdatePlanExerciseDto,
    coachId: string,
  ): Promise<PlanDayExercise> {
    await this.findOnePlan(planId, coachId);
    const ex = await this.exerciseRepo.findOne({
      where: { id: exId, trainingDayId: dayId },
      relations: ['exercise'],
    });
    if (!ex) throw new NotFoundException({ error: 'NOT_FOUND', message: 'Ejercicio no encontrado en el día' });

    if (dto.order_index !== undefined) ex.orderIndex = dto.order_index;
    if (dto.sets_target !== undefined) ex.setsTarget = dto.sets_target;
    if (dto.reps_target !== undefined) ex.repsTarget = dto.reps_target;
    if (dto.weight_target !== undefined) ex.weightTarget = dto.weight_target ?? null;
    if (dto.rest_seconds !== undefined) ex.restSeconds = dto.rest_seconds ?? null;
    if (dto.notes !== undefined) ex.notes = dto.notes ?? null;

    return this.exerciseRepo.save(ex);
  }

  async removeDayExercise(
    planId: string,
    dayId: string,
    exId: string,
    coachId: string,
  ): Promise<void> {
    await this.findOnePlan(planId, coachId);
    const ex = await this.exerciseRepo.findOne({
      where: { id: exId, trainingDayId: dayId },
    });
    if (!ex) throw new NotFoundException({ error: 'NOT_FOUND', message: 'Ejercicio no encontrado' });
    await this.exerciseRepo.remove(ex);
  }

  // ══════════════════════════════════════════════════════════════
  // ASIGNACIONES
  // ══════════════════════════════════════════════════════════════

  async findAssignments(planId: string, coachId: string) {
    await this.findOnePlan(planId, coachId);
    return this.assignmentRepo.find({
      where: { planId },
      relations: ['athlete'],
      order: { createdAt: 'DESC' },
    });
  }

  async createAssignment(
    planId: string,
    dto: CreateAssignmentDto,
    coachId: string,
  ): Promise<PlanAssignment> {
    const plan = await this.findOnePlan(planId, coachId);

    // Verificar que el atleta pertenece a este coach
    const athlete = await this.athleteRepo.findOne({
      where: { id: dto.athlete_id, coachId },
    });
    if (!athlete) {
      throw new NotFoundException({
        error: 'ATHLETE_NOT_YOURS',
        message: 'Atleta no encontrado o no pertenece a tu cuenta',
      });
    }

    // Un atleta solo puede tener UN plan activo a la vez
    const activeAssignment = await this.assignmentRepo.findOne({
      where: { athleteId: dto.athlete_id, status: 'active' },
    });

    if (activeAssignment) {
      throw new ConflictException({
        error: 'PLAN_ALREADY_ACTIVE',
        message: 'El atleta ya tiene un plan activo. Finalizalo antes de asignar uno nuevo.',
      });
    }

    const assignment = this.assignmentRepo.create({
      planId,
      athleteId: dto.athlete_id,
      assignedBy: coachId,
      startDate: dto.start_date,
      status: 'active',
    });

    return this.assignmentRepo.save(assignment);
  }

  async updateAssignment(
    planId: string,
    assignmentId: string,
    dto: { status?: 'active' | 'paused' | 'completed' | 'cancelled'; end_date?: string },
    coachId: string,
  ): Promise<PlanAssignment> {
    await this.findOnePlan(planId, coachId);
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId, planId },
    });
    if (!assignment) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Asignación no encontrada' });
    }

    if (dto.status !== undefined) assignment.status = dto.status;
    if (dto.end_date !== undefined) assignment.endDate = dto.end_date;

    return this.assignmentRepo.save(assignment);
  }

  async deleteAssignment(
    planId: string,
    assignmentId: string,
    coachId: string,
  ): Promise<void> {
    await this.findOnePlan(planId, coachId);
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId, planId },
    });
    if (!assignment) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Asignación no encontrada' });
    }

    assignment.status = 'cancelled';
    await this.assignmentRepo.save(assignment);
  }
}
