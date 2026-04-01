import { ConflictException } from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { WorkoutSession } from './entities/workout-session.entity';

type MockRepo<T = any> = {
  findOne: jest.Mock<Promise<T | null>, any>;
  create: jest.Mock<T, any>;
  save: jest.Mock<Promise<T>, any>;
  find: jest.Mock<Promise<T[]>, any>;
  createQueryBuilder: jest.Mock;
};

describe('WorkoutsService hardening', () => {
  const athlete: any = {
    id: 'athlete-1',
    userId: 'user-1',
    coachId: 'coach-1',
    user: {} as never,
    coach: {} as never,
    name: 'Athlete',
    birthdate: null,
    avatarUrl: null,
    timezone: 'America/Argentina/Buenos_Aires',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const plan: any = {
    id: 'plan-1',
    coachId: 'coach-1',
    coach: {} as never,
    name: 'Plan',
    description: null,
    totalWeeks: 4,
    cycleWeeks: null,
    autoCycle: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const assignmentA: any = {
    id: 'assignment-a',
    planId: plan.id,
    plan,
    athleteId: athlete.id,
    athlete,
    assignedBy: 'coach-1',
    coach: {} as never,
    startDate: '2026-03-30',
    endDate: null,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const assignmentB: any = {
    ...assignmentA,
    id: 'assignment-b',
  };

  const trainingDay: any = {
    id: 'day-1',
    planId: plan.id,
    plan,
    weekNumber: 1,
    dayOfWeek: 1,
    name: 'Push',
    orderIndex: 0,
    isRestDay: false,
    createdAt: new Date(),
  };

  const nextTrainingDay: any = {
    ...trainingDay,
    id: 'day-2',
    dayOfWeek: 2,
    name: 'Pull',
  };

  let sessionRepo: MockRepo<WorkoutSession>;
  let logRepo: MockRepo;
  let athleteRepo: MockRepo;
  let exerciseRepo: MockRepo;
  let assignmentRepo: MockRepo;
  let dayRepo: MockRepo;
  let dayExerciseRepo: MockRepo;
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let service: WorkoutsService;
  let sessions: WorkoutSession[];

  const createQueryBuilderRecorder = () => {
    const clauses: Array<{ sql: string; params: Record<string, unknown> }> = [];
    const qb = {
      where: jest.fn((sql: string, params: Record<string, unknown>) => {
        clauses.push({ sql, params });
        return qb;
      }),
      andWhere: jest.fn((sql: string, params: Record<string, unknown>) => {
        clauses.push({ sql, params });
        return qb;
      }),
      orderBy: jest.fn(() => qb),
      getOne: jest.fn(async () => {
        const planAssignmentFilter = clauses.find((entry) => entry.params.planAssignmentId)?.params
          .planAssignmentId as string | undefined;
        const start = clauses.find((entry) => entry.params.start)?.params.start as string | undefined;
        const end = clauses.find((entry) => entry.params.end)?.params.end as string | undefined;

        return (
          sessions.find((session) => {
            if (session.athleteId !== athlete.id || session.trainingDayId !== trainingDay.id) {
              return false;
            }

            if (planAssignmentFilter && session.planAssignmentId !== planAssignmentFilter) {
              return false;
            }

            const startedAtIso = session.startedAt.toISOString();
            return (!start || startedAtIso >= start) && (!end || startedAtIso < end);
          }) ?? null
        );
      }),
    };

    return { qb, clauses };
  };

  beforeEach(() => {
    sessions = [];

    sessionRepo = {
      findOne: jest.fn(async ({ where }) => {
        if (!where) {
          return null;
        }

        return (
          sessions.find((session) => {
            return Object.entries(where).every(([key, value]) => (session as any)[key] === value);
          }) ?? null
        );
      }),
      create: jest.fn((entity: Partial<WorkoutSession>) => ({
        id: `session-${sessions.length + 1}`,
        completedAt: null,
        perceivedEffort: null,
        logs: [],
        ...entity,
      })) as never,
      save: jest.fn(async (entity: WorkoutSession) => {
        sessions.push(entity);
        return entity;
      }),
      find: jest.fn(async () => []),
      createQueryBuilder: jest.fn(),
    };

    logRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(async () => []),
      createQueryBuilder: jest.fn(),
    } as unknown as MockRepo;

    athleteRepo = {
      findOne: jest.fn(async ({ where }) => (where.userId === athlete.userId ? athlete : null)),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(async () => []),
      createQueryBuilder: jest.fn(),
    } as unknown as MockRepo;

    exerciseRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(async () => []),
      createQueryBuilder: jest.fn(),
    } as unknown as MockRepo;

    assignmentRepo = {
      findOne: jest.fn(async ({ where, relations }) => {
        if (where.id === assignmentA.id) {
          return relations?.includes('plan') ? assignmentA : { ...assignmentA, plan: undefined as never };
        }

        if (where.id === assignmentB.id) {
          return relations?.includes('plan') ? assignmentB : { ...assignmentB, plan: undefined as never };
        }

        if (where.athleteId === athlete.id && where.status === 'active') {
          return assignmentB;
        }

        return null;
      }),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(async () => []),
      createQueryBuilder: jest.fn(),
    } as unknown as MockRepo;

    dayRepo = {
      findOne: jest.fn(async ({ where }) => {
        if (where.id === trainingDay.id && where.planId === plan.id) {
          return trainingDay;
        }

        if (where.planId === plan.id && where.weekNumber === 1 && where.dayOfWeek === 1) {
          return trainingDay;
        }

        return null;
      }),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(async () => []),
      createQueryBuilder: jest.fn(),
    } as unknown as MockRepo;

    dayExerciseRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(async () => []),
      createQueryBuilder: jest.fn(),
    } as unknown as MockRepo;

    dataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    };

    service = new WorkoutsService(
      sessionRepo as never,
      logRepo as never,
      athleteRepo as never,
      exerciseRepo as never,
      assignmentRepo as never,
      dayRepo as never,
      dayExerciseRepo as never,
      dataSource as never,
    );
  });

  it('returns 409 and keeps one active session for duplicate in_progress context', async () => {
    const dto = {
      planAssignmentId: assignmentA.id,
      trainingDayId: trainingDay.id,
      startedAt: '2026-03-31T12:00:00.000Z',
    };

    const created = await service.createSession(athlete.userId, dto);

    expect(created.status).toBe('in_progress');
    await expect(service.createSession(athlete.userId, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      athleteId: athlete.id,
      planAssignmentId: assignmentA.id,
      trainingDayId: trainingDay.id,
      status: 'in_progress',
    });
  });

  it('maps DB uniqueness races to 409 and persists one active session', async () => {
    sessionRepo.findOne.mockResolvedValue(null);
    sessionRepo.save.mockImplementation(async (entity: WorkoutSession) => {
      await Promise.resolve();

      const duplicate = sessions.find(
        (session) =>
          session.athleteId === entity.athleteId &&
          session.planAssignmentId === entity.planAssignmentId &&
          session.trainingDayId === entity.trainingDayId &&
          session.status === 'in_progress',
      );

      if (duplicate) {
        throw {
          code: '23505',
          constraint: 'uq_workout_sessions_active_today_context',
        };
      }

      sessions.push(entity);
      return entity;
    });

    const dto = {
      planAssignmentId: assignmentA.id,
      trainingDayId: trainingDay.id,
    };

    const [first, second] = await Promise.allSettled([
      service.createSession(athlete.userId, dto),
      service.createSession(athlete.userId, dto),
    ]);

    const fulfilled = [first, second].filter(
      (result): result is PromiseFulfilledResult<WorkoutSession> => result.status === 'fulfilled',
    );
    const rejected = [first, second].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    expect(sessions).toHaveLength(1);
  });

  it('does not reuse today session from assignment A when resolving assignment B', async () => {
    sessions.push({
      id: 'session-a',
      athleteId: athlete.id,
      athlete,
      planAssignmentId: assignmentA.id,
      planAssignment: assignmentA,
      trainingDayId: trainingDay.id,
      trainingDay,
      startedAt: new Date('2026-03-30T15:00:00.000Z'),
      completedAt: null,
      notes: null,
      perceivedEffort: null,
      status: 'in_progress',
      logs: [],
    });

    jest.spyOn(service as any, 'getLocalDate').mockReturnValue(new Date('2026-03-30T00:00:00.000Z'));
    const { qb, clauses } = createQueryBuilderRecorder();
    sessionRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getToday(athlete.userId);

    expect(result.status).toBe('pending');
    expect(result).toMatchObject({ assignmentId: assignmentB.id });
    expect(clauses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sql: 's.plan_assignment_id = :planAssignmentId',
          params: { planAssignmentId: assignmentB.id },
        }),
      ]),
    );
  });

  it('returns assignmentId on today statuses that need session context', async () => {
    jest.spyOn(service as any, 'getLocalDate').mockReturnValue(new Date('2026-03-30T00:00:00.000Z'));
    const { qb } = createQueryBuilderRecorder();
    sessionRepo.createQueryBuilder.mockReturnValue(qb);

    const pendingResult = await service.getToday(athlete.userId);
    expect(pendingResult).toMatchObject({
      status: 'pending',
      assignmentId: assignmentB.id,
    });

    sessions.push({
      id: 'session-in-progress',
      athleteId: athlete.id,
      athlete,
      planAssignmentId: assignmentB.id,
      planAssignment: assignmentB,
      trainingDayId: trainingDay.id,
      trainingDay,
      startedAt: new Date('2026-03-30T15:00:00.000Z'),
      completedAt: null,
      notes: null,
      perceivedEffort: null,
      status: 'in_progress',
      logs: [],
    });

    const inProgressResult = await service.getToday(athlete.userId);
    expect(inProgressResult).toMatchObject({
      status: 'in_progress',
      assignmentId: assignmentB.id,
    });

    sessions[0] = {
      ...sessions[0],
      status: 'completed',
      completedAt: new Date('2026-03-30T16:00:00.000Z'),
    };

    const completedResult = await service.getToday(athlete.userId);
    expect(completedResult).toMatchObject({
      status: 'already_done',
      assignmentId: assignmentB.id,
    });
  });

  it('returns nextTrainingDay on rest day when tomorrow has a real session', async () => {
    jest.spyOn(service as any, 'getLocalDate').mockReturnValue(new Date('2026-03-30T00:00:00.000Z'));
    dayRepo.findOne.mockImplementation(async ({ where }) => {
      if (where.planId === plan.id && where.weekNumber === 1 && where.dayOfWeek === 1) {
        return { ...trainingDay, isRestDay: true, name: 'Rest' };
      }

      if (
        where.planId === plan.id &&
        where.weekNumber === 1 &&
        where.dayOfWeek === 2 &&
        where.isRestDay === false
      ) {
        return nextTrainingDay;
      }

      return null;
    });

    const result = await service.getToday(athlete.userId);

    expect(result).toMatchObject({
      status: 'rest_day',
      nextTrainingDay: {
        id: nextTrainingDay.id,
      },
    });
  });

  it('uses local-day UTC bounds for today session lookup', async () => {
    const { qb, clauses } = createQueryBuilderRecorder();
    sessionRepo.createQueryBuilder.mockReturnValue(qb);

    await (service as any).findTodaySession(
      athlete.id,
      trainingDay.id,
      new Date('2026-03-31T00:00:00.000Z'),
      'America/Argentina/Buenos_Aires',
      assignmentA.id,
    );

    expect(clauses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sql: 's.started_at >= :start',
          params: { start: '2026-03-31T03:00:00.000Z' },
        }),
        expect.objectContaining({
          sql: 's.started_at < :end',
          params: { end: '2026-04-01T03:00:00.000Z' },
        }),
      ]),
    );
  });
});
