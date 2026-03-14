import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateTrainingDayDto } from './dto/create-training-day.dto';
import { CreatePlanExerciseDto } from './dto/create-plan-exercise.dto';
import { UpdatePlanExerciseDto } from './dto/update-plan-exercise.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('coach')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // ─── Planes ───────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar planes del coach' })
  async findAll(@CurrentUser('id') coachId: string) {
    const data = await this.plansService.findAllPlans(coachId);
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Crear plan' })
  async create(@Body() dto: CreatePlanDto, @CurrentUser('id') coachId: string) {
    const data = await this.plansService.createPlan(dto, coachId);
    return { data };
  }

  @Get(':planId')
  @ApiOperation({ summary: 'Detalle del plan con días y ejercicios' })
  async findOne(
    @Param('planId', ParseUUIDPipe) planId: string,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.findOnePlan(planId, coachId);
    return { data };
  }

  @Patch(':planId')
  @ApiOperation({ summary: 'Actualizar plan' })
  async update(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.updatePlan(planId, dto, coachId);
    return { data };
  }

  @Delete(':planId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar plan (si no tiene asignaciones activas)' })
  async delete(
    @Param('planId', ParseUUIDPipe) planId: string,
    @CurrentUser('id') coachId: string,
  ) {
    await this.plansService.deletePlan(planId, coachId);
  }

  @Post(':planId/duplicate')
  @ApiOperation({ summary: 'Duplicar plan (crea copia con todos sus días y ejercicios)' })
  async duplicate(
    @Param('planId', ParseUUIDPipe) planId: string,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.duplicatePlan(planId, coachId);
    return { data };
  }

  // ─── Training Days ────────────────────────────────────────────────────────

  @Get(':planId/days')
  @ApiOperation({ summary: 'Listar días del plan' })
  async findDays(
    @Param('planId', ParseUUIDPipe) planId: string,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.findDays(planId, coachId);
    return { data };
  }

  @Post(':planId/days')
  @ApiOperation({ summary: 'Agregar día al plan' })
  async addDay(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: CreateTrainingDayDto,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.addDay(planId, dto, coachId);
    return { data };
  }

  @Patch(':planId/days/:dayId')
  @ApiOperation({ summary: 'Actualizar día' })
  async updateDay(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @Body() dto: CreateTrainingDayDto,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.updateDay(planId, dayId, dto, coachId);
    return { data };
  }

  @Delete(':planId/days/:dayId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar día (y todos sus ejercicios)' })
  async deleteDay(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @CurrentUser('id') coachId: string,
  ) {
    await this.plansService.deleteDay(planId, dayId, coachId);
  }

  // ─── Ejercicios del día ───────────────────────────────────────────────────

  @Get(':planId/days/:dayId/exercises')
  @ApiOperation({ summary: 'Listar ejercicios de un día' })
  async findDayExercises(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.findDayExercises(planId, dayId, coachId);
    return { data };
  }

  @Post(':planId/days/:dayId/exercises')
  @ApiOperation({ summary: 'Agregar ejercicio a un día' })
  async addExercise(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @Body() dto: CreatePlanExerciseDto,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.addExerciseToDay(planId, dayId, dto, coachId);
    return { data };
  }

  @Patch(':planId/days/:dayId/exercises/:exId')
  @ApiOperation({ summary: 'Actualizar prescripción de un ejercicio' })
  async updateExercise(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @Param('exId', ParseUUIDPipe) exId: string,
    @Body() dto: UpdatePlanExerciseDto,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.updateDayExercise(planId, dayId, exId, dto, coachId);
    return { data };
  }

  @Delete(':planId/days/:dayId/exercises/:exId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar ejercicio de un día' })
  async removeExercise(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @Param('exId', ParseUUIDPipe) exId: string,
    @CurrentUser('id') coachId: string,
  ) {
    await this.plansService.removeDayExercise(planId, dayId, exId, coachId);
  }

  // ─── Asignaciones ─────────────────────────────────────────────────────────

  @Get(':planId/assignments')
  @ApiOperation({ summary: 'Ver asignaciones del plan' })
  async findAssignments(
    @Param('planId', ParseUUIDPipe) planId: string,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.findAssignments(planId, coachId);
    return { data };
  }

  @Post(':planId/assignments')
  @ApiOperation({ summary: 'Asignar plan a un atleta' })
  async createAssignment(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: CreateAssignmentDto,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.createAssignment(planId, dto, coachId);
    return { data };
  }

  @Patch(':planId/assignments/:assignId')
  @ApiOperation({ summary: 'Actualizar estado de asignación (pausar, completar, cancelar)' })
  async updateAssignment(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('assignId', ParseUUIDPipe) assignId: string,
    @Body() dto: { status?: 'active' | 'paused' | 'completed' | 'cancelled'; end_date?: string },
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.plansService.updateAssignment(planId, assignId, dto, coachId);
    return { data };
  }

  @Delete(':planId/assignments/:assignId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar asignación' })
  async deleteAssignment(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('assignId', ParseUUIDPipe) assignId: string,
    @CurrentUser('id') coachId: string,
  ) {
    await this.plansService.deleteAssignment(planId, assignId, coachId);
  }
}
