import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateSessionDto } from './create-session.dto';

describe('CreateSessionDto contract', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateSessionDto,
    data: '',
  };

  it('accepts camelCase session payload fields', async () => {
    const transformed = await pipe.transform(
      {
        planAssignmentId: '2e529a75-7166-4e30-af9f-25bf1268ef2c',
        trainingDayId: '5bbf2fc1-07e5-452a-bf7b-52613e56388d',
        startedAt: '2026-03-31T12:00:00.000Z',
      },
      metadata,
    );

    expect(transformed).toBeInstanceOf(CreateSessionDto);
    expect(transformed).toMatchObject({
      planAssignmentId: '2e529a75-7166-4e30-af9f-25bf1268ef2c',
      trainingDayId: '5bbf2fc1-07e5-452a-bf7b-52613e56388d',
      startedAt: '2026-03-31T12:00:00.000Z',
    });
  });

  it('rejects snake_case session payload fields', async () => {
    await expect(
      pipe.transform(
        {
          plan_assignment_id: '2e529a75-7166-4e30-af9f-25bf1268ef2c',
          training_day_id: '5bbf2fc1-07e5-452a-bf7b-52613e56388d',
          started_at: '2026-03-31T12:00:00.000Z',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
