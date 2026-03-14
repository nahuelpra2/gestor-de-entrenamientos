import { apiClient } from '../api/client';
import { useOfflineQueueStore, OfflineOperation } from '../stores/offline-queue.store';

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 3_600_000;

/**
 * Calcula el tiempo de espera antes del siguiente reintento.
 * Backoff exponencial: 30s, 60s, 120s, 240s, 480s
 */
export function getNextRetryDelay(retryCount: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS);
}

// Errores que NO deben reintentarse automáticamente
const NON_RETRIABLE_STATUS_CODES = new Set([403, 409, 422]);

/**
 * Procesa todas las operaciones pendientes de la cola.
 * Llama a esto cuando se detecta conexión a internet.
 */
export async function processOfflineQueue(): Promise<void> {
  const store = useOfflineQueueStore.getState();
  const pending = store.getPendingOperations();

  // Ordenar por createdAt para mantener el orden de las operaciones
  const ordered = [...pending].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const op of ordered) {
    await processOperation(op);
  }
}

async function processOperation(op: OfflineOperation): Promise<void> {
  const store = useOfflineQueueStore.getState();

  try {
    await apiClient.request({
      method: op.method,
      url: op.endpoint,
      data: op.payload,
      headers: {
        'Idempotency-Key': op.idempotencyKey,
      },
    });

    store.removeOperation(op.id);
  } catch (error: any) {
    const statusCode = error.response?.status;
    const newRetryCount = op.retryCount + 1;

    // Errores que no se recuperan reintentando
    if (statusCode && NON_RETRIABLE_STATUS_CODES.has(statusCode)) {
      store.markAsFailed(
        op.id,
        `Error ${statusCode}: ${error.response?.data?.message ?? 'Error permanente'}`,
      );
      return;
    }

    if (newRetryCount > op.maxRetries) {
      store.markAsFailed(
        op.id,
        `Máximo de reintentos alcanzado. Último error: ${error.message}`,
      );
      return;
    }

    const delay = getNextRetryDelay(newRetryCount);
    store.updateOperation(op.id, {
      retryCount: newRetryCount,
      nextRetryAt: new Date(Date.now() + delay).toISOString(),
      lastError: error.message,
    });
  }
}

/**
 * Genera un idempotency key único para una operación.
 * Debe llamarse UNA SOLA VEZ cuando el usuario confirma la acción,
 * no en cada reintento.
 */
export function generateIdempotencyKey(): string {
  // En React Native, crypto.randomUUID() está disponible desde RN 0.73+
  // Para versiones anteriores, usar expo-crypto
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback simple (no criptográfico, solo para compatibilidad)
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}
