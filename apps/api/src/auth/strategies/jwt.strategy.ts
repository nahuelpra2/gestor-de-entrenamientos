import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';

export interface JwtPayload {
  sub: string;       // user id
  role: string;
  iss: string;       // issuer
  aud: string[];     // audience
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    const secret = configService.get<string>('jwt.secret');
    const issuer = configService.get<string>('jwt.issuer') ?? 'trainr-api';
    const audience = configService.get<string>('jwt.audience') ?? 'trainr-app';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret!,
      // Validar issuer y audience en cada token
      // Previene que JWTs de otros servicios firmados con el mismo secreto sean aceptados
      issuer,
      audience,
    });

    this.logger.debug(
      `constructor() jwt config loaded: secret=${secret ? 'present' : 'missing'} issuer=${issuer} audience=${audience}`,
    );
  }

  async validate(payload: JwtPayload) {
    this.logger.debug(
      `validate() payload received: sub=${payload.sub} role=${payload.role} iss=${payload.iss} aud=${Array.isArray(payload.aud) ? payload.aud.join(',') : payload.aud}`,
    );

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      this.logger.warn(`validate() user not found for sub=${payload.sub}`);
      throw new UnauthorizedException('Usuario no encontrado');
    }

    this.logger.debug(`validate() success for userId=${user.id} role=${user.role}`);

    // Este objeto queda disponible como request.user en los controllers
    return { id: user.id, email: user.email, role: user.role };
  }
}
