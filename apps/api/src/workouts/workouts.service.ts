import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { WorkoutSession } from './entities/workout-session.entity';
import { WorkoutLog } from './entities/workout-log.entity';
import { WorkoutSet } from './entities/workout-set.entity';
import { Athlete } from '../users/athlete.entity';
import { Exercise } from '../exercises/exercise.entity';
import { PlanAssignment } from '../plans/entities/plan-assignment.entity';
import { TrainingDay } from '../plans/entities/training-day.entity';
import { TrainingPlan } from '../plans/entities/training-plan.entity';
import { PlanDayExercise } from '../plans/entities/plan-day-exercise.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { CompleteSessionDto } from './dto/complete-session.dto';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { LogHistoryQueryDto } from './dto/log-history-query.dto';
import { assertOwnership } from '../common/utils/ownership.util';
import { buildPaginatedResponse, decodeCursor } from '../common/utils/cursor.util';

// ─── Tipos de respuesta del algoritmo "Día de Hoy" ───────────────────────────

export type TodayResponse =
  | { status: 'no_plan'; startsAt?: string }
  | { status: 'rest_day'; nextTrainingDay: TrainingDay | null }
  | { status: 'plan_completed'; assignmentId: string }
  | { status: 'already_done'; session: WorkoutSession }
  | {
      status: 'pending';
      trainingDay: TrainingDay & { exercises: PlanDayExercise[] };
      session: null;
    }
  | {
      status: 'in_progress';
      trainingDay: TrainingDay & { exercises: PlanDayExercise[] };
      session: WorkoutSession;
    };

@Injectable()
export class WorkoutsService {
  constructor(
    @InjectRepository(WorkoutSession)
    private readonly sessionRepo: Repository<WorkoutSession>,
    @InjectRepository(WorkoutLog)
    private readonly logRepo: Repository<WorkoutLog>,
    @InjectRepository(Athlete)
    private readonly athleteRepo: Repository<Athlete>,
    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,
    @InjectRepository(PlanAssignment)
    private readonly assignmentRepo: Repository<PlanAssignment>,
    @InjectRepository(TrainingDay)
    private readonly dayRepo: Repository<TrainingDay>,
    @InjectRepository(PlanDayExercise)
    private readonly dayExerciseRepo: Repository<PlanDayExercise>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Helper: resolver userId (JWT) → athlete.id ──────────────────────────

  private async resolveAthlete(userId: string): Promise<Athlete> {
    const athlete = await this.athleteRepo.findOne({ where: { userId } });
    if (!athlete) throw new NotFoundException('Atleta no encontrado');
    return athlete;
  }

  // ─── Algoritmo: Día de Hoy ────────────────────────────────────────────────

  /**
   * userId = users.id del JWT.
   * Internamente resuelve a athletes.id para queries.
   */
  async getToday(userId: string): Promise<TodayResponse> {
    const athlete = await this.resolveAthlete(userId);
    const athleteId = athlete.id;
    const timezone = athlete.timezone;

    const today = this.getLocalDate(timezone);
    const dayOfWeek = this.getISODayOfWeek(today); // 1=lunes, 7=domingo

    // 1. Buscar assignment activo
    const assignment = await this.assignmentRepo.findOne({
      where: { athleteId, status: 'active' },
      relations: ['plan'],
      order: { startDate: 'DESC' },
    });

    if (!assignment) {
      return { status: 'no_plan' };
    }

    // 2. Calcular semana actual
    const startDate = new Date(assignment.startDate);
    const daysSinceStart = this.getDaysDiff(startDate, today);

    if (daysSinceStart < 0) {
      return { status: 'no_plan', startsAt: assignment.startDate };
    }

    let weekNumber = Math.floor(daysSinceStart / 7) + 1;

    // 3. Aplicar ciclo si corresponde
    const plan: TrainingPlan = assignment.plan;

    if (plan.totalWeeks !== null && weekNumber > plan.totalWeeks) {
      if (plan.autoCycle && plan.cycleWeeks) {
        weekNumber = ((weekNumber - 1) % plan.cycleWeeks) + 1;
      } else {
        return { status: 'plan_completed', assignmentId: assignment.id };
      }
    }

    // 4. Buscar training_day de hoy
    const trainingDay = await this.dayRepo.findOne({
      where: { planId: plan.id, weekNumber, dayOfWeek },
    });

    if (!trainingDay || trainingDay.isRestDay) {
      const next = await this.findNextTrainingDay(plan, weekNumber, dayOfWeek);
      return { status: 'rest_day', nextTrainingDay: next };
    }

    // 5. Verificar sesión existente hoy
    const session = await this.findTodaySession(athleteId, trainingDay.id, today);

    if (session) {
      if (session.status === 'completed') {
        return { status: 'already_done', session };
      }
      if (session.status === 'in_progress') {
        const dayWithExercises = await this.loadDayWithExercises(trainingDay);
        return { status: 'in_progress', trainingDay: dayWithExercises, session };
      }
      // Si es 'abandoned', continuar como si no existiera
    }

    // 6. Día pendiente
    const dayWithExercises = await this.loadDayWithExercises(trainingDay);
    return { status: 'pending', trainingDay: dayWithExercises, session: null };
  }

  // ─── Sesiones ─────────────────────────────────────────────────────────────

  async createSession(userId: string, dto: CreateSessionDto): Promise<WorkoutSession> {
    const athlete = await this.resolveAthlete(userId);
    let assignment: PlanAssignment | null = null;

    if (dto.planAssignmentId) {
      assignment = await this.assignmentRepo.findOne({
        where: { id: dto.planAssignmentId },
      });
      if (!assignment) throw new NotFoundException('Asignación no encontrada');
      assertOwnership(assignment.athleteId, athlete.id);
      if (assignment.status !== 'active') {
        throw new BadRequestException('Solo se puede iniciar una sesión con una asignación activa');
      }
    }

    if (dto.trainingDayId) {
      if (!assignment) {
        throw new BadRequestException('trainingDayId requiere una asignación de plan válida');
      }

      const trainingDay = await this.dayRepo.findOne({
        where: { id: dto.trainingDayId, planId: assignment.planId },
      });

      // ADDED: validate trainingDay belongs to assignment plan
      if (!trainingDay) {
        throw new BadRequestException('El día de entrenamiento no pertenece al plan asignado');
      }
    }

    const session = this.sessionRepo.create({
      athleteId: athlete.id,
      planAssignmentId: dto.planAssignmentId ?? null,
      trainingDayId: dto.trainingDayId ?? null,
      startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
      notes: dto.notes ?? null,
      status: 'in_progress',
    });

    return this.sessionRepo.save(session);
  }

  async getSession(sessionId: string, userId: string): Promise<WorkoutSession> {
    const athlete = await this.resolveAthlete(userId);
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['trainingDay', 'logs', 'logs.sets'],
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    assertOwnership(session.athleteId, athlete.id);
    return session;
  }

  async completeSession(
    sessionId: string,
    userId: string,
    dto: CompleteSessionDto,
  ): Promise<WorkoutSession> {
    const athlete = await this.resolveAthlete(userId);
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    assertOwnership(session.athleteId, athlete.id);

    if (session.status !== 'in_progress') {
      throw new BadRequestException('Solo se puede completar una sesión en progreso');
    }

    session.status = 'completed';
    session.completedAt = dto.completedAt ? new Date(dto.completedAt) : new Date();
    if (dto.perceivedEffort !== undefined) session.perceivedEffort = dto.perceivedEffort;
    if (dto.notes !== undefined) session.notes = dto.notes;

    return this.sessionRepo.save(session);
  }

  async abandonSession(sessionId: string, userId: string): Promise<WorkoutSession> {
    const athlete = await this.resolveAthlete(userId);
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    assertOwnership(session.athleteId, athlete.id);

    if (session.status !== 'in_progress') {
      throw new BadRequestException('Solo se puede abandonar una sesión en progreso');
    }

    session.status = 'abandoned';
    return this.sessionRepo.save(session);
  }

  // ─── Logs ─────────────────────────────────────────────────────────────────

  async createLog(userId: string, dto: CreateLogDto): Promise<WorkoutLog> {
    const athlete = await this.resolveAthlete(userId);

    const session = await this.sessionRepo.findOne({ where: { id: dto.workoutSessionId } });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    assertOwnership(session.athleteId, athlete.id);

    const exercise = await this.exerciseRepo.findOne({ where: { id: dto.exerciseId } });
    if (!exercise) throw new NotFoundException('Ejercicio no encontrado');

    if (exercise.createdBy !== null && exercise.createdBy !== athlete.coachId) {
      throw new ForbiddenException('No tenés acceso a este ejercicio');
    }

    if (session.status !== 'in_progress') {
      throw new BadRequestException('Solo se puede registrar ejercicios en una sesión activa');
    }

    if (dto.trainingDayId && dto.trainingDayId !== session.trainingDayId) {
      throw new BadRequestException('El trainingDay del log no coincide con el de la sesión');
    }

    if (session.trainingDayId) {
      const prescribedExercise = await this.dayExerciseRepo.findOne({
        where: { trainingDayId: session.trainingDayId, exerciseId: dto.exerciseId },
      });

      if (!prescribedExercise) {
        throw new BadRequestException('El ejercicio no pertenece al día de la sesión');
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const log = manager.create(WorkoutLog, {
        workoutSessionId: dto.workoutSessionId,
        athleteId: athlete.id,
        exerciseId: dto.exerciseId,
        trainingDayId: dto.trainingDayId ?? null,
        loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : new Date(),
        notes: dto.notes ?? null,
      });

      const savedLog = await manager.save(WorkoutLog, log);

      const sets = dto.sets.map((s) =>
        manager.create(WorkoutSet, {
          workoutLogId: savedLog.id,
          setNumber: s.setNumber,
          weightKg: s.weightKg ?? null,
          reps: s.reps ?? null,
          durationSeconds: s.durationSeconds ?? null,
          distanceMeters: s.distanceMeters ?? null,
          rpe: s.rpe ?? null,
          isWarmup: s.isWarmup ?? false,
          isFailure: s.isFailure ?? false,
          notes: s.notes ?? null,
        }),
      );

      await manager.save(WorkoutSet, sets);

      return manager.findOneOrFail(WorkoutLog, {
        where: { id: savedLog.id },
        relations: ['sets'],
      });
    });
  }

  async getLog(logId: string, userId: string): Promise<WorkoutLog> {
    const athlete = await this.resolveAthlete(userId);
    const log = await this.logRepo.findOne({
      where: { id: logId, deletedAt: IsNull() },
      relations: ['sets'],
    });
    if (!log) throw new NotFoundException('Log no encontrado');
    assertOwnership(log.athleteId, athlete.id);
    return log;
  }

  async updateLog(logId: string, userId: string, dto: UpdateLogDto): Promise<WorkoutLog> {
    const athlete = await this.resolveAthlete(userId);
    const log = await this.logRepo.findOne({
      where: { id: logId, deletedAt: IsNull() },
      relations: ['sets'],
    });
    if (!log) throw new NotFoundException('Log no encontrado');
    assertOwnership(log.athleteId, athlete.id);

    // Conflict detection con optimistic concurrency
    const clientUpdatedAt = new Date(dto.clientUpdatedAt);
    if (log.updatedAt > clientUpdatedAt) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: 'El log fue modificado por otro dispositivo',
        serverVersion: log,
        clientUpdatedAt: dto.clientUpdatedAt,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.notes !== undefined) log.notes = dto.notes;

      if (dto.sets !== undefined) {
        await manager.delete(WorkoutSet, { workoutLogId: log.id });

        const newSets = dto.sets.map((s) =>
          manager.create(WorkoutSet, {
            workoutLogId: log.id,
            setNumber: s.setNumber,
            weightKg: s.weightKg ?? null,
            reps: s.reps ?? null,
            durationSeconds: s.durationSeconds ?? null,
            distanceMeters: s.distanceMeters ?? null,
            rpe: s.rpe ?? null,
            isWarmup: s.isWarmup ?? false,
            isFailure: s.isFailure ?? false,
            notes: s.notes ?? null,
          }),
        );
        await manager.save(WorkoutSet, newSets);
      }

      await manager.save(WorkoutLog, log);

      return manager.findOneOrFail(WorkoutLog, {
        where: { id: log.id },
        relations: ['sets'],
      });
    });
  }

  async deleteLog(logId: string, userId: string): Promise<void> {
    const athlete = await this.resolveAthlete(userId);
    const log = await this.logRepo.findOne({
      where: { id: logId, deletedAt: IsNull() },
    });
    if (!log) throw new NotFoundException('Log no encontrado');
    assertOwnership(log.athleteId, athlete.id);

    log.deletedAt = new Date();
    await this.logRepo.save(log);
  }

  async getLogHistory(userId: string, query: LogHistoryQueryDto) {
    const athlete = await this.resolveAthlete(userId);
    const limit = query.limit ?? 20;

    const qb = this.logRepo
      .createQueryBuilder('log')
      .where('log.athlete_id = :athleteId', { athleteId: athlete.id })
      .andWhere('log.deleted_at IS NULL')
      .orderBy('log.logged_at', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .take(limit + 1);

    if (query.exerciseId) {
      qb.andWhere('log.exercise_id = :exerciseId', { exerciseId: query.exerciseId });
    }
    if (query.sessionId) {
      qb.andWhere('log.workout_session_id = :sessionId', { sessionId: query.sessionId });
    }
    if (query.trainingDayId) {
      qb.andWhere('log.training_day_id = :trainingDayId', {
        trainingDayId: query.trainingDayId,
      });
    }
    if (query.from) {
      qb.andWhere('log.logged_at >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('log.logged_at <= :to', { to: query.to });
    }
    if (query.includeSets) {
      qb.leftJoinAndSelect('log.sets', 'set');
    }

    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        qb.andWhere(
          '(log.logged_at < :cursorDate OR (log.logged_at = :cursorDate AND log.id < :cursorId))',
          { cursorDate: decoded.loggedAt, cursorId: decoded.id },
        );
      }
    }

    const items = await qb.getMany();

    return buildPaginatedResponse(items, limit, (log) => ({
      loggedAt: log.loggedAt.toISOString(),
      id: log.id,
    }));
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  /** Retorna la fecha local del atleta como medianoche UTC (para comparar rangos) */
  private getLocalDate(timezone: string): Date {
    const now = new Date();
    const localStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // "YYYY-MM-DD"
    return new Date(`${localStr}T00:00:00Z`);
  }

  /** Diferencia en días entre dos fechas (ambas a medianoche UTC) */
  private getDaysDiff(from: Date, to: Date): number {
    return Math.round((to.getTime() - from.getTime()) / 86_400_000);
  }

  /** ISO weekday: 1=lunes, 7=domingo */
  private getISODayOfWeek(date: Date): number {
    const day = date.getUTCDay(); // 0=dom, 1=lun, ..., 6=sab
    return day === 0 ? 7 : day;
  }

  private async loadDayWithExercises(
    trainingDay: TrainingDay,
  ): Promise<TrainingDay & { exercises: PlanDayExercise[] }> {
    const exercises = await this.dayExerciseRepo.find({
      where: { trainingDayId: trainingDay.id },
      relations: ['exercise'],
      order: { orderIndex: 'ASC' },
    });
    return Object.assign(trainingDay, { exercises });
  }

  private async findTodaySession(
    athleteId: string,
    trainingDayId: string,
    today: Date,
  ): Promise<WorkoutSession | null> {
    const start = today;
    const end = new Date(today.getTime() + 86_400_000);

    return this.sessionRepo
      .createQueryBuilder('s')
      .where('s.athlete_id = :athleteId', { athleteId })
      .andWhere('s.training_day_id = :trainingDayId', { trainingDayId })
      .andWhere('s.started_at >= :start', { start: start.toISOString() })
      .andWhere('s.started_at < :end', { end: end.toISOString() })
      .orderBy('s.started_at', 'DESC')
      .getOne();
  }

  /** Busca el próximo training_day no-rest en los próximos 14 días */
  private async findNextTrainingDay(
    plan: TrainingPlan,
    currentWeek: number,
    currentDayOfWeek: number,
  ): Promise<TrainingDay | null> {
    for (let offset = 1; offset <= 14; offset++) {
      const totalDayOffset = currentDayOfWeek - 1 + offset;
      const nextDayOfWeek = (totalDayOffset % 7) + 1;
      let nextWeek = currentWeek + Math.floor(totalDayOffset / 7);

      if (plan.autoCycle && plan.cycleWeeks) {
        nextWeek = ((nextWeek - 1) % plan.cycleWeeks) + 1;
      } else if (plan.totalWeeks !== null && nextWeek > plan.totalWeeks) {
        break;
      }

      const day = await this.dayRepo.findOne({
        where: {
          planId: plan.id,
          weekNumber: nextWeek,
          dayOfWeek: nextDayOfWeek,
          isRestDay: false,
        },
      });

      if (day) return day;
    }

    return null;
  }
}
