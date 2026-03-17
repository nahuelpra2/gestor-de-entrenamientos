import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../users/user.entity';
import { Coach } from '../users/coach.entity';
import { Athlete } from '../users/athlete.entity';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { assertOwnership } from '../common/utils/ownership.util';

@Injectable()
export class AthletesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Coach)
    private readonly coachRepo: Repository<Coach>,
    @InjectRepository(Athlete)
    private readonly athleteRepo: Repository<Athlete>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Coach: listar sus atletas ───────────────────────────────────────────

  async findAllByCoach(userId: string) {
    const coachId = await this.resolveCoachId(userId);
    const athletes = await this.athleteRepo.find({
      where: { coachId },
      relations: ['user'],
      order: { name: 'ASC' },
    });

    return athletes.map((a) => this.toDto(a));
  }

  // ─── Coach: detalle de un atleta ─────────────────────────────────────────

  async findOne(athleteId: string, userId: string) {
    const coachId = await this.resolveCoachId(userId);
    const athlete = await this.athleteRepo.findOne({
      where: { id: athleteId },
      relations: ['user'],
    });

    if (!athlete) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Atleta no encontrado' });
    }

    assertOwnership(athlete.coachId, coachId, 'ATHLETE_NOT_YOURS');

    return this.toDto(athlete);
  }

  // ─── Coach: crear atleta ──────────────────────────────────────────────────
  // Crea user + athlete en una transacción.
  // Genera una contraseña temporal segura y la retorna una sola vez.
  // En producción, esto debe disparar un email de bienvenida con la temp password.

  async create(dto: CreateAthleteDto, userId: string) {
    const coachId = await this.resolveCoachId(userId);
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: 'Ya existe una cuenta con ese email',
        details: { field: 'email' },
      });
    }

    // Verificar que el coach existe
    const coach = await this.coachRepo.findOne({ where: { id: coachId } });
    if (!coach) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Coach no encontrado' });
    }

    // Generar contraseña temporal segura (12 chars alfanumérico)
    const tempPassword = crypto.randomBytes(9).toString('base64url').slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email: dto.email,
        passwordHash,
        role: 'athlete',
      });
      await manager.save(user);

      const athlete = manager.create(Athlete, {
        userId: user.id,
        coachId,
        name: dto.name,
        birthdate: dto.birthdate ?? null,
        timezone: dto.timezone ?? 'America/Argentina/Buenos_Aires',
      });
      await manager.save(athlete);

      const athleteWithUser = await manager.findOne(Athlete, {
        where: { id: athlete.id },
        relations: ['user'],
      });

      return {
        athlete: this.toDto(athleteWithUser ?? athlete),
        // Devolver temp_password UNA SOLA VEZ.
        // El atleta debe cambiarla en su primer login.
        // TODO: enviar por email en lugar de retornar en la respuesta.
        temp_password: tempPassword,
      };
    });
  }

  // ─── Coach: actualizar atleta ─────────────────────────────────────────────

  async update(athleteId: string, dto: UpdateAthleteDto, userId: string) {
    const coachId = await this.resolveCoachId(userId);
    const athlete = await this.athleteRepo.findOne({
      where: { id: athleteId },
      relations: ['user'],
    });

    if (!athlete) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Atleta no encontrado' });
    }

    assertOwnership(athlete.coachId, coachId, 'ATHLETE_NOT_YOURS');

    if (dto.name !== undefined) athlete.name = dto.name;
    if (dto.birthdate !== undefined) athlete.birthdate = dto.birthdate;
    if (dto.timezone !== undefined) athlete.timezone = dto.timezone;

    await this.athleteRepo.save(athlete);
    return this.toDto(athlete);
  }

  // ─── Atleta: obtener su propio perfil ────────────────────────────────────

  async getMyProfile(userId: string) {
    const athlete = await this.athleteRepo.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!athlete) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Perfil de atleta no encontrado' });
    }

    return this.toDto(athlete);
  }

  // ─── Atleta: actualizar su propio perfil ─────────────────────────────────

  async updateMyProfile(userId: string, dto: UpdateAthleteDto) {
    const athlete = await this.athleteRepo.findOne({ where: { userId } });

    if (!athlete) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Perfil no encontrado' });
    }

    if (dto.name !== undefined) athlete.name = dto.name;
    if (dto.birthdate !== undefined) athlete.birthdate = dto.birthdate;
    if (dto.timezone !== undefined) athlete.timezone = dto.timezone;

    await this.athleteRepo.save(athlete);
    return this.getMyProfile(userId);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // Buscar un atleta por su userId (para endpoints del atleta autenticado)
  async findByUserId(userId: string): Promise<Athlete> {
    const athlete = await this.athleteRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!athlete) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Atleta no encontrado' });
    }
    return athlete;
  }

  private async resolveCoachId(userId: string): Promise<string> {
    const coach = await this.coachRepo.findOne({ where: { userId } });

    if (!coach) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Perfil de coach no encontrado',
      });
    }

    return coach.id;
  }

  private toDto(athlete: Athlete) {
    return {
      id: athlete.id,
      name: athlete.name,
      email: athlete.user?.email,
      birthdate: athlete.birthdate,
      timezone: athlete.timezone,
      avatarUrl: athlete.avatarUrl,
      coachId: athlete.coachId,
    };
  }
}
