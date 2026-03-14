import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AthletesService } from './athletes.service';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('athletes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('athletes')
export class AthletesController {
  constructor(private readonly athletesService: AthletesService) {}

  // ─── Endpoints del atleta autenticado (/athletes/me/*) ───────────────────
  // IMPORTANTE: estas rutas deben ir ANTES de /:id para que Express no las confunda

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles('athlete')
  @ApiOperation({ summary: 'Perfil propio del atleta' })
  async getMyProfile(@CurrentUser('id') userId: string) {
    const data = await this.athletesService.getMyProfile(userId);
    return { data };
  }

  @Patch('me')
  @UseGuards(RolesGuard)
  @Roles('athlete')
  @ApiOperation({ summary: 'Actualizar perfil propio' })
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateAthleteDto,
  ) {
    const data = await this.athletesService.updateMyProfile(userId, dto);
    return { data };
  }

  // ─── Endpoints del coach (gestión de atletas) ─────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles('coach')
  @ApiOperation({ summary: 'Listar atletas del coach autenticado' })
  async findAll(@CurrentUser('id') coachId: string) {
    const data = await this.athletesService.findAllByCoach(coachId);
    return { data };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('coach')
  @ApiOperation({ summary: 'Crear nuevo atleta' })
  async create(
    @Body() dto: CreateAthleteDto,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.athletesService.create(dto, coachId);
    return { data };
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('coach')
  @ApiOperation({ summary: 'Detalle de un atleta' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.athletesService.findOne(id, coachId);
    return { data };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('coach')
  @ApiOperation({ summary: 'Actualizar datos de un atleta' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAthleteDto,
    @CurrentUser('id') coachId: string,
  ) {
    const data = await this.athletesService.update(id, dto, coachId);
    return { data };
  }
}
