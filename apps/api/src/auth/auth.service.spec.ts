import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-family-id'),
}));

import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/user.entity';

type RefreshTokenState = {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  revokedAt: Date | null;
  replacedBy: string | null;
  expiresAt: Date;
  user: User;
};

describe('AuthService.refresh', () => {
  const jwtService = {
    sign: jest.fn().mockReturnValue('access-token'),
  } as unknown as JwtService;

  const configService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'jwt.secret':
          return 'test-secret';
        case 'jwt.expiresInSeconds':
          return 900;
        case 'jwt.issuer':
          return 'trainr-api';
        case 'jwt.audience':
          return 'trainr-app';
        case 'jwt.refreshExpiresInDays':
          return 30;
        default:
          return undefined;
      }
    }),
  } as unknown as ConfigService;

  const userRepo = { findOne: jest.fn() };
  const coachRepo = { findOne: jest.fn() };
  const refreshTokenRepo = { findOne: jest.fn(), update: jest.fn() };

  let service: AuthService;
  let dataSource: { transaction: jest.Mock };
  let tokenState: RefreshTokenState;
  let generatedTokens: string[];
  let createdTokenCount: number;
  let transactionQueue: Promise<unknown>;
  let lockSpy: jest.Mock;

  const createManager = () => {
    const tokenRepo = {
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        setLock: lockSpy,
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => ({ ...tokenState })),
      })),
    };

    return {
      getRepository: jest.fn(() => tokenRepo),
      create: jest.fn((_: unknown, entity: Partial<RefreshToken>) => ({
        id: `new-token-${++createdTokenCount}`,
        revokedAt: null,
        replacedBy: null,
        ...entity,
      })),
      save: jest.fn(async (entity: RefreshToken) => entity),
      update: jest.fn(async (_entity: unknown, id: string, patch: Partial<RefreshToken>) => {
        if (id === tokenState.id) {
          tokenState = { ...tokenState, ...patch };
        }
      }),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(async () => {
          if (tokenState.familyId) {
            tokenState = { ...tokenState, revokedAt: tokenState.revokedAt ?? new Date() };
          }
        }),
      })),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    tokenState = {
      id: 'refresh-token-id',
      userId: 'user-1',
      familyId: 'family-1',
      tokenHash: '',
      revokedAt: null,
      replacedBy: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'coach@test.com',
        passwordHash: 'hash',
        role: 'coach',
        createdAt: new Date(),
      } as User,
    };

    generatedTokens = ['rotated-refresh-token-1', 'rotated-refresh-token-2'];
    createdTokenCount = 0;
    transactionQueue = Promise.resolve();
    lockSpy = jest.fn().mockReturnThis();

    dataSource = {
      transaction: jest.fn((callback) => {
        const run = transactionQueue.then(() => callback(createManager()));
        transactionQueue = run.catch(() => undefined);
        return run;
      }),
    };

    service = new AuthService(
      userRepo as never,
      coachRepo as never,
      refreshTokenRepo as never,
      jwtService,
      configService,
      dataSource as never,
    );

    jest.spyOn<any, any>(service, 'generateOpaqueToken').mockImplementation(() => {
      const next = generatedTokens.shift();
      if (!next) throw new Error('No more refresh tokens available for test');
      return next;
    });

    tokenState.tokenHash = (service as any).hashToken('original-refresh-token');
  });

  it('rotates a valid refresh token under transaction lock', async () => {
    const result = await service.refresh('original-refresh-token');

    expect(lockSpy).toHaveBeenCalledWith('pessimistic_write');
    expect(result).toEqual({
      access_token: 'access-token',
      refresh_token: 'rotated-refresh-token-1',
    });
    expect(tokenState.revokedAt).toBeInstanceOf(Date);
    expect(tokenState.replacedBy).toBe('new-token-1');
  });

  it('does not issue two valid child tokens for concurrent refresh requests', async () => {
    const [first, second] = await Promise.allSettled([
      service.refresh('original-refresh-token'),
      service.refresh('original-refresh-token'),
    ]);

    const fulfilled = [first, second].filter(
      (result): result is PromiseFulfilledResult<{ access_token: string; refresh_token: string }> =>
        result.status === 'fulfilled',
    );
    const rejected = [first, second].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0].value.refresh_token).toBe('rotated-refresh-token-1');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(UnauthorizedException);
    expect(rejected[0].reason.getResponse()).toMatchObject({
      error: 'TOKEN_REUSE',
    });
    expect(lockSpy).toHaveBeenCalledTimes(2);
  });
});
