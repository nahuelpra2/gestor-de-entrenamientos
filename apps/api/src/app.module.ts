import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExercisesModule } from './exercises/exercises.module';
import { AthletesModule } from './athletes/athletes.module';
import { PlansModule } from './plans/plans.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { MeasurementsModule } from './measurements/measurements.module';

@Module({
  imports: [
    // Config global — disponible en toda la app
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
      envFilePath: '.env',
    }),

    // Rate limiting global
    // Límites por defecto: 60 req / 60s por IP.
    // Se pueden sobreescribir endpoint por endpoint con @Throttle({ default: { limit, ttl } })
    // Los endpoints de auth tienen límites más restrictivos (ver auth.controller.ts).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,   // ventana de 60 segundos
        limit: 60,     // 60 requests por ventana
      },
    ]),

    // TypeORM con PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...config.get('database'),
      }),
    }),

    // Módulos de la app
    UsersModule,
    AuthModule,
    ExercisesModule,
    AthletesModule,
    MeasurementsModule,
    PlansModule,
    WorkoutsModule,
  ],
  providers: [
    // Aplicar ThrottlerGuard globalmente a todos los endpoints
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
