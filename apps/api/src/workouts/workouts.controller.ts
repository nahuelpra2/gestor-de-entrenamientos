import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { WorkoutsService } from './workouts.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { CompleteSessionDto } from './dto/complete-session.dto';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { LogHistoryQueryDto } from './dto/log-history-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

/** Shape de request.user inyectado por JwtStrategy.validate() */
interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('Workouts — Sesiones y Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  // ─── Atleta: día de hoy ──────────────────────────────────────────────────

  @Get('athletes/me/today')
  @Roles('athlete')
  @ApiOperation({
    summary: 'Obtener el día de entrenamiento de hoy',
    description:
      'Calcula el training_day correspondiente al atleta según su plan activo y fecha de inicio.',
  })
  async getToday(@CurrentUser() user: AuthUser) {
    const data = await this.workoutsService.getToday(user.id);
    return { data };
  }

  // ─── Sesiones ────────────────────────────────────────────────────────────

  @Post('sessions')
  @Roles('athlete')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID requerido — garantiza creación única y reintentos offline seguros',
    required: true,
  })
  @ApiOperation({ summary: 'Iniciar una sesión de entrenamiento' })
  async createSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSessionDto,
  ) {
    const data = await this.workoutsService.createSession(user.id, dto);
    return { data };
  }

  @Get('sessions/:id')
  @Roles('athlete')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Obtener detalle de una sesión con sus logs' })
  async getSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.workoutsService.getSession(id, user.id);
    return { data };
  }

  @Patch('sessions/:id/complete')
  @Roles('athlete')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Completar una sesión de entrenamiento' })
  async completeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CompleteSessionDto,
  ) {
    const data = await this.workoutsService.completeSession(id, user.id, dto);
    return { data };
  }

  @Patch('sessions/:id/abandon')
  @Roles('athlete')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Abandonar una sesión de entrenamiento' })
  async abandonSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.workoutsService.abandonSession(id, user.id);
    return { data };
  }

  // ─── Logs ────────────────────────────────────────────────────────────────

  @Post('logs')
  @Roles('athlete')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID requerido — garantiza registro exactamente una vez (soporte offline)',
    required: true,
  })
  @ApiOperation({
    summary: 'Registrar un ejercicio con sus sets',
    description: 'Requiere header Idempotency-Key. Safe para reintentos offline.',
  })
  async createLog(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLogDto,
  ) {
    const data = await this.workoutsService.createLog(user.id, dto);
    return { data };
  }

  @Get('logs/history')
  @Roles('athlete')
  @ApiOperation({
    summary: 'Historial de ejercicios con cursor pagination',
    description: 'Soporta filtros por ejercicio, sesión, día, rango de fechas.',
  })
  async getLogHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: LogHistoryQueryDto,
  ) {
    return this.workoutsService.getLogHistory(user.id, query);
  }

  @Get('logs/:id')
  @Roles('athlete')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Obtener un log específico con sus sets' })
  async getLog(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.workoutsService.getLog(id, user.id);
    return { data };
  }

  @Patch('logs/:id')
  @Roles('athlete')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({
    summary: 'Editar un log',
    description:
      'Requiere `client_updated_at` para conflict detection. ' +
      'Retorna 409 si el servidor tiene una versión más nueva.',
  })
  async updateLog(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateLogDto,
  ) {
    const data = await this.workoutsService.updateLog(id, user.id, dto);
    return { data };
  }

  @Delete('logs/:id')
  @Roles('athlete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Soft-delete de un log de ejercicio' })
  async deleteLog(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.workoutsService.deleteLog(id, user.id);
  }
}
