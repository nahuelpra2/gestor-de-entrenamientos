import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request, Response } from 'express';

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

    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey || idempotencyKey.length > 128) {
      // Sin key: dejar pasar sin idempotencia
      // Key muy larga: ignorar (no error, para no romper clientes)
      return next.handle();
    }

    // user_id viene del JWT (coaches y atletas usan el mismo mecanismo)
    const userId = (request as any).user?.id as string | undefined;
    if (!userId) {
      return next.handle();
    }

    // PASO 1: Intentar reservar el key (INSERT con ON CONFLICT DO NOTHING)
    // Insertamos con response_body vacío; lo actualizaremos después de ejecutar.
    // Si ya existe → otro proceso ya procesó este key.
    const placeholder = '{"__pending":true}';
    const inserted = await this.dataSource.query<{ rowcount: number }[]>(
      `INSERT INTO idempotency_keys (key, user_id, endpoint, response_status, response_body)
       VALUES ($1, $2, $3, 0, $4::jsonb)
       ON CONFLICT (key) DO NOTHING
       RETURNING 1 AS rowcount`,
      [idempotencyKey, userId, request.path, placeholder],
    );

    if (inserted.length === 0) {
      // El key ya existía → buscar la respuesta cacheada
      const existing = await this.dataSource.query<
        { response_status: number; response_body: unknown }[]
      >(
        `SELECT response_status, response_body FROM idempotency_keys
         WHERE key = $1 AND user_id = $2`,
        [idempotencyKey, userId],
      );

      if (existing.length > 0) {
        const { response_status, response_body } = existing[0];

        // Si aún está pendiente (otro proceso está en medio de la operación), esperar
        if ((response_body as any)?.__pending) {
          // La request original está en curso — no es el caso habitual pero puede ocurrir
          // en deploys multi-instancia. Devolvemos 202 para que el cliente reintente.
          response.status(202).setHeader('Idempotency-Key-Status', 'processing');
          return of({ message: 'Operación en curso, reintentá en unos segundos' });
        }

        response.status(response_status).setHeader('Idempotency-Key-Status', 'hit');
        return of(response_body);
      }
    }

    // PASO 2: El INSERT tuvo éxito — somos los dueños de esta operación
    return next.handle().pipe(
      tap(async (data) => {
        const statusCode = response.statusCode;
        // Actualizar la fila con la respuesta real
        await this.dataSource.query(
          `UPDATE idempotency_keys
           SET response_status = $1, response_body = $2::jsonb
           WHERE key = $3 AND user_id = $4`,
          [statusCode, JSON.stringify(data), idempotencyKey, userId],
        );
        response.setHeader('Idempotency-Key-Status', 'miss');
      }),
    );
  }
}
