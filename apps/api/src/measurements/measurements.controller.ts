import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { MeasurementsService } from './measurements.service';

@ApiTags('measurements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('athlete')
@Controller('athletes/me/measurements')
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar mediciones propias' })
  async findMyMeasurements(@CurrentUser('id') userId: string) {
    const data = await this.measurementsService.findMyMeasurements(userId);
    return { data };
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID requerido — garantiza reintentos offline seguros para mediciones',
    required: true,
  })
  @ApiOperation({ summary: 'Registrar una nueva medición' })
  async createMyMeasurement(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMeasurementDto,
  ) {
    const data = await this.measurementsService.createMyMeasurement(userId, dto);
    return { data };
  }
}
