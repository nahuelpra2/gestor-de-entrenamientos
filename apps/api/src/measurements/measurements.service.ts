import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { Athlete } from '../users/athlete.entity';
import { BodyMeasurement } from './body-measurement.entity';
import { CreateMeasurementDto } from './dto/create-measurement.dto';

@Injectable()
export class MeasurementsService {
  constructor(
    @InjectRepository(Athlete)
    private readonly athleteRepo: Repository<Athlete>,
    @InjectRepository(BodyMeasurement)
    private readonly measurementRepo: Repository<BodyMeasurement>,
  ) {}

  async findMyMeasurements(userId: string) {
    const athlete = await this.findAthleteByUserId(userId);
    const measurements = await this.measurementRepo.find({
      where: { athleteId: athlete.id },
      order: { measuredAt: 'DESC' },
    });

    return measurements.map((measurement) => this.toDto(measurement));
  }

  async createMyMeasurement(userId: string, dto: CreateMeasurementDto) {
    if (
      dto.weight_kg === undefined &&
      dto.body_fat_pct === undefined &&
      dto.muscle_mass_kg === undefined
    ) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Debes enviar al menos una medición',
        details: { fields: ['weight_kg', 'body_fat_pct', 'muscle_mass_kg'] },
      });
    }

    const athlete = await this.findAthleteByUserId(userId);
    const measurement = this.measurementRepo.create({
      id: randomUUID(),
      athleteId: athlete.id,
      measuredAt: dto.measured_at ? new Date(dto.measured_at) : new Date(),
      weightKg: dto.weight_kg !== undefined ? dto.weight_kg.toString() : null,
      bodyFatPct: dto.body_fat_pct !== undefined ? dto.body_fat_pct.toString() : null,
      muscleMassKg: dto.muscle_mass_kg !== undefined ? dto.muscle_mass_kg.toString() : null,
      notes: dto.notes ?? null,
      source: 'manual',
    });

    await this.measurementRepo.save(measurement);
    return this.toDto(measurement);
  }

  private async findAthleteByUserId(userId: string) {
    const athlete = await this.athleteRepo.findOne({ where: { userId } });

    if (!athlete) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Perfil de atleta no encontrado',
      });
    }

    return athlete;
  }

  private toDto(measurement: BodyMeasurement) {
    return {
      id: measurement.id,
      measured_at: measurement.measuredAt.toISOString(),
      weight_kg: measurement.weightKg !== null ? Number(measurement.weightKg) : null,
      body_fat_pct: measurement.bodyFatPct !== null ? Number(measurement.bodyFatPct) : null,
      muscle_mass_kg:
        measurement.muscleMassKg !== null ? Number(measurement.muscleMassKg) : null,
      notes: measurement.notes,
      source: measurement.source,
    };
  }
}
