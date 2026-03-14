import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { SearchExercisesDto } from './dto/search-exercises.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('exercises')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar ejercicios (globales + del coach)' })
  async search(
    @Query() dto: SearchExercisesDto,
    @CurrentUser('id') userId: string,
  ) {
    // coaches y athletes pueden buscar ejercicios
    // el coachId se usa para filtrar los custom del coach
    // para atletas: TODO en Fase 3 obtener su coachId
    return this.exercisesService.search(dto, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un ejercicio' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    const data = await this.exercisesService.findOne(id, userId);
    return { data };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('coach')
  @ApiOperation({ summary: 'Crear ejercicio personalizado (solo coaches)' })
  async create(
    @Body() dto: CreateExerciseDto,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.exercisesService.create(dto, coachId);
    return { data };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('coach')
  @ApiOperation({ summary: 'Actualizar ejercicio (solo el coach creador)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExerciseDto,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.exercisesService.update(id, dto, coachId);
    return { data };
  }
}
