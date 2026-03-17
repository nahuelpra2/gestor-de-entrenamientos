import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Exercise } from './exercise.entity';
import { Coach } from '../users/coach.entity';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { SearchExercisesDto } from './dto/search-exercises.dto';
import { buildPaginatedResponse, decodeCursor } from '../common/utils/cursor.util';

@Injectable()
export class ExercisesService {
  constructor(
    @InjectRepository(Exercise)
    private readonly exerciseRepo: Repository<Exercise>,
    @InjectRepository(Coach)
    private readonly coachRepo: Repository<Coach>,
  ) {}

  // ─── Búsqueda / listado ───────────────────────────────────────────────────

  async search(dto: SearchExercisesDto, userId: string) {
    const ownerId = await this.resolveExerciseOwnerId(userId);
    const limit = dto.limit ?? 20;

    const qb = this.exerciseRepo
      .createQueryBuilder('e')
      // Mostrar: ejercicios globales (created_by IS NULL) + propios del coach
      .where('(e.created_by IS NULL OR e.created_by = :ownerId)', { ownerId })
      .orderBy('e.name', 'ASC')
      .addOrderBy('e.id', 'ASC');

    if (dto.search) {
      // Full text search en nombre
      qb.andWhere(
        `to_tsvector('spanish', e.name) @@ plainto_tsquery('spanish', :search)`,
        { search: dto.search },
      );
    }

    if (dto.category) {
      qb.andWhere('e.category = :category', { category: dto.category });
    }

    if (dto.muscle_group) {
      qb.andWhere(':muscleGroup = ANY(e.muscle_groups)', {
        muscleGroup: dto.muscle_group,
      });
    }

    if (dto.cursor) {
      const decoded = decodeCursor(dto.cursor);
      if (decoded) {
        qb.andWhere('(e.name, e.id) > (:name, :id)', {
          name: decoded['name'],
          id: decoded['id'],
        });
      }
    }

    const items = await qb.take(limit + 1).getMany();

    return buildPaginatedResponse(items, limit, (item) => ({
      id: item.id,
      name: item.name,
    }));
  }

  // ─── Detalle ──────────────────────────────────────────────────────────────

  async findOne(id: string, userId: string): Promise<Exercise> {
    const ownerId = await this.resolveExerciseOwnerId(userId);
    const exercise = await this.exerciseRepo.findOne({ where: { id } });

    if (!exercise) {
      throw new NotFoundException({ error: 'NOT_FOUND', message: 'Ejercicio no encontrado' });
    }

    // Solo puede ver globales o los suyos
    if (exercise.createdBy !== null && exercise.createdBy !== ownerId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'No tenés acceso a este ejercicio',
      });
    }

    return exercise;
  }

  // ─── Crear ────────────────────────────────────────────────────────────────

  async create(dto: CreateExerciseDto, userId: string): Promise<Exercise> {
    const coachId = await this.resolveCoachId(userId);
    const exercise = this.exerciseRepo.create({
      name: dto.name,
      category: dto.category,
      muscleGroups: dto.muscle_groups ?? [],
      videoUrl: dto.video_url ?? null,
      instructions: dto.instructions ?? null,
      createdBy: coachId, // siempre asociado al coach que lo crea
    });

    return this.exerciseRepo.save(exercise);
  }

  // ─── Actualizar ───────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateExerciseDto, userId: string): Promise<Exercise> {
    const coachId = await this.resolveCoachId(userId);
    const exercise = await this.findOne(id, userId);

    // Solo el creador puede editar ejercicios custom
    if (exercise.createdBy !== coachId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Solo podés editar ejercicios que creaste vos',
      });
    }

    if (dto.name !== undefined) exercise.name = dto.name;
    if (dto.category !== undefined) exercise.category = dto.category;
    if (dto.muscle_groups !== undefined) exercise.muscleGroups = dto.muscle_groups;
    if (dto.video_url !== undefined) exercise.videoUrl = dto.video_url ?? null;
    if (dto.instructions !== undefined) exercise.instructions = dto.instructions ?? null;

    return this.exerciseRepo.save(exercise);
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

  private async resolveExerciseOwnerId(userId: string): Promise<string> {
    const coach = await this.coachRepo.findOne({ where: { userId } });
    return coach?.id ?? userId;
  }
}
