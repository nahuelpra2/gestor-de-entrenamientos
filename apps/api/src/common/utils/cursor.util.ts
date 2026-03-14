/**
 * Utilidad de cursor-based pagination.
 *
 * El cursor es base64(JSON({ campo_de_orden, id })).
 * Es opaco para el cliente — nunca debe parsearlo directamente.
 * Ver docs/DECISIONS.md ADR-001.
 */

export interface CursorPayload {
  id: string;
  [key: string]: string | number;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(decoded) as CursorPayload;
  } catch {
    return null;
  }
}

/**
 * Construye la respuesta paginada estándar.
 * Pide `limit + 1` registros para saber si hay página siguiente.
 */
export function buildPaginatedResponse<T extends { id: string }>(
  items: T[],
  limit: number,
  getCursorPayload: (item: T) => CursorPayload,
): { data: T[]; pagination: { cursor: string | null; has_more: boolean; count: number } } {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const lastItem = data[data.length - 1];

  return {
    data,
    pagination: {
      cursor: hasMore && lastItem ? encodeCursor(getCursorPayload(lastItem)) : null,
      has_more: hasMore,
      count: data.length,
    },
  };
}
