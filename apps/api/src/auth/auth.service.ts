import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/user.entity';
import { Coach } from '../users/coach.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterCoachDto } from './dto/register-coach.dto';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: number;
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Coach)
    private readonly coachRepo: Repository<Coach>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    // Validar al arrancar que las variables críticas están configuradas
    const secret = this.configService.get<string>('jwt.secret');
    if (!secret) {
      throw new InternalServerErrorException('JWT_SECRET no configurado');
    }
    this.jwtSecret = secret;
    this.jwtExpiresIn = this.configService.get<number>('jwt.expiresInSeconds') ?? 900;
    this.jwtIssuer = this.configService.get<string>('jwt.issuer') ?? 'trainr-api';
    this.jwtAudience = this.configService.get<string>('jwt.audience') ?? 'trainr-app';
  }

  // ─── Registro de coach ────────────────────────────────────────────────────

  async registerCoach(dto: RegisterCoachDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: 'Ya existe una cuenta con ese email',
        details: { field: 'email' },
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email: dto.email,
        passwordHash,
        role: 'coach',
      });
      await manager.save(user);

      const coach = manager.create(Coach, {
        userId: user.id,
        name: dto.name,
      });
      await manager.save(coach);

      return this.buildAuthResponse(user);
    });
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, meta: { userAgent?: string; ip?: string } = {}) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    // Comparar siempre (aunque user no exista) para prevenir timing attacks
    const passwordHash = user?.passwordHash ?? '$2b$12$invalidsaltsotimingisthesame000';
    const passwordValid = await bcrypt.compare(dto.password, passwordHash);

    if (!user || !passwordValid) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Credenciales inválidas',
      });
    }

    return this.buildAuthResponse(user, meta);
  }

  // ─── Refresh token ────────────────────────────────────────────────────────

  async refresh(
    rawToken: string,
    meta: { userAgent?: string; ip?: string } = {},
  ) {
    const tokenHash = this.hashToken(rawToken);

    const existing = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!existing) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Token inválido',
      });
    }

    // Detectar reuso de token revocado → posible robo de credenciales
    if (existing.revokedAt !== null) {
      // Revocar toda la familia de tokens como medida de seguridad
      await this.refreshTokenRepo
        .createQueryBuilder()
        .update()
        .set({ revokedAt: new Date() })
        .where('family_id = :familyId AND revoked_at IS NULL', {
          familyId: existing.familyId,
        })
        .execute();

      throw new UnauthorizedException({
        error: 'TOKEN_REUSE',
        message: 'Sesión inválida. Por seguridad, inicia sesión nuevamente.',
      });
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Token expirado',
      });
    }

    // Rotar: revocar actual y generar nuevo par
    const newRawToken = this.generateOpaqueToken();
    const newTokenHash = this.hashToken(newRawToken);
    const expiresAt = this.getRefreshExpiry();

    return this.dataSource.transaction(async (manager) => {
      const newToken = manager.create(RefreshToken, {
        userId: existing.userId,
        tokenHash: newTokenHash,
        familyId: existing.familyId,
        expiresAt,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ip ?? null,
      });
      await manager.save(newToken);

      await manager.update(RefreshToken, existing.id, {
        revokedAt: new Date(),
        replacedBy: newToken.id,
      });

      const accessToken = this.signAccessToken(existing.user);
      return { access_token: accessToken, refresh_token: newRawToken };
    });
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await this.refreshTokenRepo.update({ tokenHash }, { revokedAt: new Date() });
  }

  async logoutAll(userId: string) {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('user_id = :userId AND revoked_at IS NULL', { userId })
      .execute();
  }

  // ─── Me ───────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    let profile: Pick<Coach, 'id' | 'name' | 'avatarUrl'> | null = null;
    if (user.role === 'coach') {
      const coach = await this.coachRepo.findOne({ where: { userId } });
      if (coach) {
        profile = { id: coach.id, name: coach.name, avatarUrl: coach.avatarUrl };
      }
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      profile,
    };
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private async buildAuthResponse(
    user: User,
    meta: { userAgent?: string; ip?: string } = {},
  ) {
    const accessToken = this.signAccessToken(user);
    const rawRefreshToken = this.generateOpaqueToken();
    const tokenHash = this.hashToken(rawRefreshToken);
    const familyId = uuidv4();
    const expiresAt = this.getRefreshExpiry();

    const refreshToken = this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ip ?? null,
    });
    await this.refreshTokenRepo.save(refreshToken);

    return {
      access_token: accessToken,
      refresh_token: rawRefreshToken,
      expires_in: this.jwtExpiresIn,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  private signAccessToken(user: User): string {
    // Payload mínimo — no incluir datos sensibles en el JWT
    return this.jwtService.sign(
      { sub: user.id, role: user.role },
      {
        secret: this.jwtSecret,
        expiresIn: this.jwtExpiresIn,
        issuer: this.jwtIssuer,
        audience: this.jwtAudience,
      },
    );
  }

  private generateOpaqueToken(): string {
    // 48 bytes de entropía criptográfica → 96 hex chars
    return crypto.randomBytes(48).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getRefreshExpiry(): Date {
    const days = this.configService.get<number>('jwt.refreshExpiresInDays') ?? 30;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
}
