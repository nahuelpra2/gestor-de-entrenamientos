# OFFLINE.md — Protocolo de Soporte Offline

Trainr soporta registro de entrenamiento sin conexión. Este documento define el
protocolo completo: qué operaciones son queueables, cómo se sincronizan, y cómo
se manejan los conflictos.

---

## Principio de diseño

El atleta debe poder registrar su entrenamiento completo sin conexión a internet.
La sincronización ocurre en segundo plano cuando la conexión se restablece.
El usuario nunca debe perder datos de entrenamiento por problemas de red.

---

## Operaciones queueables (offline)

| Operación | Endpoint | Idempotente | Notas |
|-----------|----------|-------------|-------|
| Iniciar sesión | `POST /sessions` | Sí (idempotency key) | |
| Completar sesión | `PATCH /sessions/:id/complete` | Sí (idempotente por naturaleza) | |
| Registrar ejercicio | `POST /logs` | Sí (idempotency key obligatorio) | |
| Editar log | `PATCH /logs/:id` | Sí (client_updated_at para conflictos) | |
| Registrar medición | `POST /athletes/me/measurements` | Sí (clave natural: athlete_id + measured_at) | |

## Operaciones que requieren conexión

| Operación | Por qué no es queueable |
|-----------|------------------------|
| Login / Registro | Necesita respuesta del servidor para obtener tokens |
| Refresh token | Necesita respuesta del servidor |
| Cargar plan del día | Datos deben estar frescos del servidor |
| Ver historial | Consulta a DB, no se puede ejecutar offline |
| Buscar ejercicios | Requiere el catálogo del servidor |

---

## Arquitectura de la cola offline

### Schema del store (Zustand + AsyncStorage)

```typescript
interface OfflineOperation {
  id: string                    // UUID local de la operación
  type: 'CREATE' | 'UPDATE' | 'DELETE'
  entity: 'session' | 'workout_log' | 'measurement'
  endpoint: string              // ej: '/logs'
  method: 'POST' | 'PATCH' | 'DELETE'
  payload: Record<string, unknown>
  idempotencyKey: string        // UUID generado cuando el usuario confirma la acción
  clientTimestamp: string       // ISO8601 - momento de la acción
  retryCount: number            // comienza en 0
  maxRetries: number            // default 5
  nextRetryAt: string | null    // ISO8601
  status: 'pending' | 'failed'
  lastError: string | null
  createdAt: string             // ISO8601
}
```

### Política de persistencia

La cola se persiste en `AsyncStorage` bajo la key `offline_queue`.
Se carga al inicializar la app. Si hay operaciones pendientes, se muestra un
indicador en la UI y se inicia el proceso de sync.

---

## Flujo completo de una operación offline

```
1. Usuario registra un set (sin conexión)
   ↓
2. App genera idempotencyKey = uuid()
   App genera clientTimestamp = now().toISO()
   ↓
3. App guarda la operación en offlineQueueStore con status: 'pending'
   App actualiza el estado local (todayWorkoutStore) inmediatamente
   → El usuario ve el set registrado aunque no haya conexión
   ↓
4. App detecta reconexión (NetInfo)
   ↓
5. processQueue() itera por las operaciones pendientes ordenadas por createdAt
   ↓
6a. Éxito → remover de la cola
    Invalidar TanStack Query cache para refrescar datos del servidor
   ↓
6b. Error recuperable (500, timeout) → aplicar backoff, actualizar nextRetryAt
   ↓
6c. Error de conflicto (409) → marcar como 'failed', notificar al usuario
   ↓
6d. Error permanente (403, 422) → marcar como 'failed', notificar al usuario
```

---

## Idempotency Keys

### Generación

```typescript
// src/lib/idempotency.ts
import * as Crypto from 'expo-crypto'

export function generateIdempotencyKey(): string {
  return Crypto.randomUUID()
}
```

El key se genera **una sola vez** cuando el usuario confirma la acción (toca "Guardar set").
Se reutiliza el mismo key en todos los reintentos del mismo request.
Si el usuario crea un nuevo log (acción diferente), se genera un nuevo key.

### Reglas

- El key viaja en el header `Idempotency-Key: <uuid>`
- TTL en el servidor: 7 días
- Si el mismo key llega con payload diferente: el servidor retorna `409 IDEMPOTENCY_CONFLICT` (bug en el cliente)
- Si el mismo key llega con payload idéntico: el servidor retorna la respuesta original con `Idempotency-Key-Status: hit`

---

## Manejo de conflictos por tipo de operación

### CREATE (POST)
- Idempotente via `Idempotency-Key`
- **Conflicto imposible** si el cliente usa el mismo key para el mismo intento

### UPDATE (PATCH)
- Incluir `client_updated_at` en el body
- Si el servidor retorna `409 CONFLICT`: mostrar UI de resolución
- El usuario elige: "Conservar la mía" o "Usar la del servidor"
- **Estrategia default**: last-write-wins (si el usuario no resuelve en 24h)

### DELETE
- Soft delete: `deleted_at` en el servidor
- Si llega un DELETE de algo ya eliminado: `200 OK` (no-op, idempotente)

### Mediciones corporales
- Clave natural: `(athlete_id, measured_at)` con precisión de segundos
- Si llega una medición con el mismo timestamp: actualizar silenciosamente (no crear duplicado)

---

## UI/UX de estados offline

### Indicadores en la app

| Estado | Indicador visual |
|--------|-----------------|
| Sin conexión | Banner rojo en la parte superior: "Sin conexión — tus datos se guardarán" |
| Operaciones pendientes | Ícono de sync con contador en la barra de navegación |
| Sincronizando | Spinner en el ícono de sync |
| Operación fallida | Notificación: "No se pudo sincronizar X operación. [Ver detalle]" |

### Pantalla de cola offline (accesible desde el ícono de sync)

```
Pendientes de sync (3)
──────────────────────
✓ Set de Sentadilla — pendiente (intento 1 de 5)
  Siguiente intento en 2 minutos

✓ Set de Press Banca — pendiente (intento 0)
  Enviando...

⚠ Medición de peso — fallido
  "Conflicto: dato modificado en otro dispositivo"
  [Resolver] [Descartar]
```

### Estrategia "optimistic update"

El cliente actualiza el estado local **inmediatamente** al registrar una operación,
sin esperar la confirmación del servidor. Si la sincronización falla definitivamente
(después de 5 reintentos), se muestra una alerta y se revierte el estado local.

---

## Caché de datos para operación offline

El atleta puede operar offline porque los datos del plan se cachean al abrir la app:

```typescript
// useTodayWorkout hook — TanStack Query
useQuery({
  queryKey: ['today-workout'],
  queryFn: fetchTodayWorkout,
  staleTime: 5 * 60 * 1000,    // 5 minutos
  gcTime: 24 * 60 * 60 * 1000, // 24 horas en caché
  networkMode: 'offlineFirst',   // usar caché aunque esté desactualizado
})
```

Si el atleta abre la app sin conexión y sin caché previo: mostrar pantalla de
"Necesitas conexión para cargar tu plan por primera vez".

---

## Pruebas del sistema offline

Escenarios que deben funcionar:
1. Registrar sets completos de una sesión sin conexión → sync exitoso al reconectarse
2. Reconectarse a mitad de una sesión offline → operaciones parciales se sincronizan en orden
3. El mismo set registrado dos veces (bug del cliente) → solo un registro en el servidor
4. Coach edita el plan mientras atleta entrena offline → no afecta la sesión en curso
5. Token expirado durante el offline → al reconectarse, refresh automático antes de sync
6. 5 reintentos fallidos → operación marcada como fallida, usuario notificado
