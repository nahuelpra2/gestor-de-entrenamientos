import { ForbiddenException } from '@nestjs/common';

/**
 * Valida que un recurso pertenece al coach autenticado.
 * Si no pertenece, lanza 403 ATHLETE_NOT_YOURS (o el código indicado).
 *
 * Uso:
 *   assertOwnership(athlete.coachId, currentCoachId, 'ATHLETE_NOT_YOURS');
 */
export function assertOwnership(
  resourceOwnerId: string,
  requestingId: string,
  errorCode = 'FORBIDDEN',
): void {
  if (resourceOwnerId !== requestingId) {
    throw new ForbiddenException({
      error: errorCode,
      message: 'No tenés permiso para acceder a este recurso',
    });
  }
}
