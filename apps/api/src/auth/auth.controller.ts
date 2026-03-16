import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterCoachDto } from './dto/register-coach.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  // Límite estricto: 5 registros por hora por IP.
  // Previene creación masiva de cuentas falsas.
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Registro de nuevo entrenador' })
  @ApiResponse({ status: 201, description: 'Coach registrado exitosamente' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async register(@Body() dto: RegisterCoachDto, @Req() req: Request) {
    const data = await this.authService.registerCoach(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return { data };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Límite estricto: 10 intentos cada 15 minutos por IP.
  // Previene fuerza bruta sobre contraseñas.
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Login de coach o atleta' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const data = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return { data };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  // Límite moderado: 30 refreshes por hora por IP.
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Rotar refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens renovados' })
  @ApiResponse({ status: 401, description: 'Token inválido, expirado o reusado' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const data = await this.authService.refresh(dto.refresh_token, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return { data };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revocar refresh token actual' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refresh_token);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revocar todas las sesiones del usuario' })
  async logoutAll(@CurrentUser('id') userId: string) {
    await this.authService.logoutAll(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  async me(@CurrentUser('id') userId: string) {
    const data = await this.authService.getMe(userId);
    return { data };
  }
}
