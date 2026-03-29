import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';

/**
 * Interceptor de idempotencia para operaciones offline.
 *
 * Garantiza que una operación con el mismo Idempotency-Key se ejecute
 * exactamente una vez, sin importar cuántas veces el cliente la reintente.
 *
 * Diseño para prevenir race condition (TOCTOU):
 * En lugar de CHECK→EXECUTE→INSERT, usamos INSERT primero con ON CONFLICT.
 * Si el INSERT falla (ya existe), devolvemos la respuesta cacheada.
 * Si el INSERT tiene éxito, ejecutamos la operación y actualizamos la respuesta.
 *
 * Uso: @UseInterceptors(IdempotencyInterceptor) en controllers de escritura offline.
 * El cliente debe enviar el header `Idempotency-Key: <uuid>`.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const endpoint = `${request.method} ${request.path}`;

    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Falta el header Idempotency-Key',
      });
    }

    if (idempotencyKey.length > 128) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Idempotency-Key inválido',
      });
    }

    const userId = (request as any).user?.id as string | undefined;
    if (!userId) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'No se pudo resolver el usuario autenticado para idempotencia',
      });
    }

    const requestHash = this.hashRequestBody(request.body);

    // PASO 1: Intentar reservar el key (INSERT con ON CONFLICT DO NOTHING)
    // Insertamos con response_body vacío; lo actualizaremos después de ejecutar.
    // Si ya existe → otro proceso ya procesó este key.
    const placeholder = JSON.stringify({
      __pending: true,
      __request_hash: requestHash,
    });
    const inserted = await this.dataSource.query<{ rowcount: number }[]>(
      `INSERT INTO idempotency_keys (key, user_id, endpoint, response_status, response_body)
        VALUES ($1, $2, $3, 0, $4::jsonb)
        ON CONFLICT (key) DO NOTHING
        RETURNING 1 AS rowcount`,
      [idempotencyKey, userId, endpoint, placeholder],
    );

    if (inserted.length === 0) {
      // El key ya existía → buscar la respuesta cacheada
      const existing = await this.dataSource.query<
        { user_id: string; endpoint: string; response_status: number; response_body: unknown }[]
      >(
        `SELECT user_id, endpoint, response_status, response_body FROM idempotency_keys
         WHERE key = $1`,
        [idempotencyKey],
      );

      if (existing.length > 0) {
        const { user_id, endpoint: storedEndpoint, response_status, response_body } = existing[0];
        const storedRequestHash = this.extractStoredRequestHash(response_body);

        if (user_id !== userId || storedEndpoint !== endpoint || storedRequestHash !== requestHash) {
          throw new ConflictException({
            error: 'IDEMPOTENCY_CONFLICT',
            message: 'La misma Idempotency-Key fue usada con otro usuario, endpoint o payload',
          });
        }

        // Si aún está pendiente (otro proceso está en medio de la operación), esperar
        if ((response_body as any)?.__pending) {
          // La request original está en curso — no es el caso habitual pero puede ocurrir
          // en deploys multi-instancia. Devolvemos 202 para que el cliente reintente.
          response.status(202).setHeader('Idempotency-Key-Status', 'processing');
          return of({ message: 'Operación en curso, reintentá en unos segundos' });
        }

        response.status(response_status).setHeader('Idempotency-Key-Status', 'hit');
        return of(this.extractStoredResponseBody(response_body));
      }

      throw new ConflictException({
        error: 'IDEMPOTENCY_CONFLICT',
        message: 'La Idempotency-Key ya existe con otra identidad de operación',
      });
    }

    // PASO 2: El INSERT tuvo éxito — somos los dueños de esta operación
    return next.handle().pipe(
      tap(async (data) => {
        const statusCode = response.statusCode;
        // Actualizar la fila con la respuesta real
        const storedResponse = JSON.stringify({
          __request_hash: requestHash,
          __response: data,
        });
        await this.dataSource.query(
          `UPDATE idempotency_keys
           SET response_status = $1, response_body = $2::jsonb
           WHERE key = $3 AND user_id = $4`,
          [statusCode, storedResponse, idempotencyKey, userId],
        );
        response.setHeader('Idempotency-Key-Status', 'miss');
      }),
    );
  }

  private hashRequestBody(body: unknown): string {
    const normalized = this.normalizeValue(body);
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private normalizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = this.normalizeValue((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }

    return value;
  }

  private extractStoredRequestHash(responseBody: unknown): string | null {
    if (responseBody && typeof responseBody === 'object' && '__request_hash' in responseBody) {
      return String((responseBody as Record<string, unknown>).__request_hash);
    }

    return null;
  }

  private extractStoredResponseBody(responseBody: unknown): unknown {
    if (responseBody && typeof responseBody === 'object' && '__response' in responseBody) {
      return (responseBody as Record<string, unknown>).__response;
    }

    return responseBody;
  }
}
