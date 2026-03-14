import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/user.entity';
import { Coach } from '../users/coach.entity';
import { Athlete } from '../users/athlete.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('jwt.secret');
        if (!secret) {
          throw new Error('JWT_SECRET no está configurado en las variables de entorno');
        }

        return {
          secret,
          signOptions: {
            // Usar número (segundos) para evitar conflictos de tipos con la librería ms
            expiresIn: config.get<number>('jwt.expiresInSeconds') ?? 900,
            issuer: config.get<string>('jwt.issuer') ?? 'trainr-api',
            audience: config.get<string>('jwt.audience') ?? 'trainr-app',
          },
        };
      },
    }),
    TypeOrmModule.forFeature([User, Coach, Athlete, RefreshToken]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
