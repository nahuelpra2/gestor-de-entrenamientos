# ALGORITHMS.md — Algoritmos Críticos

Documentación de los algoritmos no triviales que deben implementarse de forma
consistente entre backend y frontend.

---

## 1. Algoritmo "Día de Hoy" (GET /athletes/me/today)

### Objetivo
Determinar qué día de entrenamiento le corresponde al atleta en el día actual,
teniendo en cuenta el plan asignado, la fecha de inicio, semanas del plan, y si
ya completó el entrenamiento hoy.

### Pseudocódigo completo

```
FUNCIÓN calcular_dia_hoy(athlete_id, hoy = now().date()):

1. OBTENER ASSIGNMENT ACTIVO
   ──────────────────────────
   assignment = SELECT * FROM plan_assignments
     WHERE athlete_id = $1
       AND status = 'active'
     ORDER BY start_date DESC
     LIMIT 1

   SI assignment IS NULL:
     RETORNAR { status: 'no_plan' }

2. CALCULAR SEMANA ACTUAL
   ──────────────────────
   dias_desde_inicio = (hoy - assignment.start_date).days

   SI dias_desde_inicio < 0:
     -- El plan comienza en el futuro
     RETORNAR { status: 'no_plan', starts_at: assignment.start_date }

   week_number = FLOOR(dias_desde_inicio / 7) + 1

3. APLICAR CICLO SI CORRESPONDE
   ──────────────────────────────
   plan = SELECT * FROM training_plans WHERE id = assignment.plan_id

   SI plan.total_weeks IS NOT NULL AND week_number > plan.total_weeks:
     SI plan.auto_cycle = true:
       week_number = ((week_number - 1) % plan.cycle_weeks) + 1
     SINO:
       -- Plan completado
       RETORNAR {
         status: 'plan_completed',
         summary: calcular_resumen_plan(assignment)
       }

4. CALCULAR DÍA DE LA SEMANA
   ───────────────────────────
   day_of_week = ISO_WEEKDAY(hoy)  -- 1=lunes, 2=martes, ..., 7=domingo

5. BUSCAR TRAINING DAY
   ─────────────────────
   training_day = SELECT * FROM training_days
     WHERE plan_id = assignment.plan_id
       AND week_number = $week_number
       AND day_of_week = $day_of_week

   SI training_day IS NULL OR training_day.is_rest_day = true:
     -- No hay entrenamiento programado hoy
     next = calcular_proximo_dia(plan, week_number, day_of_week)
     RETORNAR { status: 'rest_day', next_training_day: next }

6. VERIFICAR SESIÓN EXISTENTE
   ────────────────────────────
   session = SELECT * FROM workout_sessions
     WHERE training_day_id = training_day.id
       AND athlete_id = $athlete_id
       AND DATE(started_at AT TIME ZONE athlete_timezone) = hoy
     ORDER BY started_at DESC
     LIMIT 1

   SI session IS NOT NULL:
     SI session.status = 'completed':
       RETORNAR { status: 'already_done', session: session }
     SI session.status = 'in_progress':
       training_day_with_exercises = cargar_ejercicios(training_day)
       RETORNAR {
         status: 'in_progress',
         training_day: training_day_with_exercises,
         session: session
       }
     -- Si 'abandoned', lo tratamos como si no existe

7. RETORNAR DÍA PENDIENTE
   ──────────────────────
   training_day_with_exercises = cargar_ejercicios(training_day)
   RETORNAR {
     status: 'pending',
     training_day: training_day_with_exercises,
     session: null
   }
```

### Función auxiliar: calcular_proximo_dia

```
FUNCIÓN calcular_proximo_dia(plan, current_week, current_day_of_week):
  -- Busca el próximo training_day en el plan (no rest_day)
  -- Empieza desde mañana

  PARA offset = 1 HASTA 14:
    next_day_of_week = ((current_day_of_week - 1 + offset) % 7) + 1
    next_week = current_week + FLOOR((current_day_of_week - 1 + offset) / 7)

    SI plan.auto_cycle:
      next_week = ((next_week - 1) % plan.cycle_weeks) + 1

    day = SELECT * FROM training_days
      WHERE plan_id = plan.id
        AND week_number = next_week
        AND day_of_week = next_day_of_week
        AND is_rest_day = false

    SI day IS NOT NULL:
      RETORNAR { day: day, days_away: offset }

  RETORNAR null  -- plan solo tiene rest days (caso inválido)
```

### Consideraciones de implementación

- **Timezone**: usar la timezone del atleta o del coach para calcular "hoy". Guardar en `athletes.timezone` (pendiente agregar al schema).
- **Sesiones abandonadas**: una sesión con `status = 'abandoned'` se ignora en este cálculo; el atleta puede empezar una nueva sesión para el mismo día.
- **Race condition**: si dos dispositivos del mismo atleta consultan simultáneamente, pueden ver `status: 'pending'` y crear dos sesiones. El backend debe validar con `UNIQUE(athlete_id, training_day_id, DATE(started_at))` o usar un lock optimista.

---

## 2. Cálculo de 1RM Estimado (Fórmula Epley)

### Objetivo
Estimar el peso máximo que un atleta podría levantar en 1 repetición, a partir de
un set de múltiples reps.

### Fórmula

```
1RM_estimado = weight_kg × (1 + reps / 30)
```

Esta es la fórmula de Epley, la más usada en la industria. Es una aproximación;
la más precisa se obtiene con reps entre 3 y 10.

### Pseudocódigo

```sql
-- Mejor 1RM estimado histórico para un ejercicio y atleta
SELECT
  wl.logged_at::date AS date,
  MAX(ws.weight_kg * (1 + ws.reps::decimal / 30)) AS estimated_1rm,
  ws.weight_kg AS actual_weight,
  ws.reps AS actual_reps
FROM workout_logs wl
JOIN workout_sets ws ON ws.workout_log_id = wl.id
WHERE wl.athlete_id = $athlete_id
  AND wl.exercise_id = $exercise_id
  AND ws.is_warmup = false
  AND ws.reps > 0
  AND ws.weight_kg > 0
  AND wl.deleted_at IS NULL
GROUP BY wl.logged_at::date
ORDER BY wl.logged_at::date DESC;
```

### Consideraciones
- Excluir warmup sets (`is_warmup = false`).
- Solo calcular si `reps > 0` y `weight_kg > 0` (excluir bodyweight o sets de tiempo).
- Para ejercicios de peso corporal, el 1RM no aplica.

---

## 3. Cálculo de Volumen de Entrenamiento

### Volumen total = weight_kg × reps (por set)
### Volumen de sesión = SUM de todos los sets de la sesión
### Volumen semanal por grupo muscular

```sql
-- Volumen semanal por grupo muscular
SELECT
  DATE_TRUNC('week', wl.logged_at) AS week_start,
  e.muscle_groups,
  SUM(ws.weight_kg * ws.reps) AS total_volume_kg,
  COUNT(DISTINCT wl.id) AS exercises_count,
  COUNT(ws.id) AS total_sets
FROM workout_logs wl
JOIN workout_sets ws ON ws.workout_log_id = wl.id
JOIN exercises e ON e.id = wl.exercise_id
WHERE wl.athlete_id = $athlete_id
  AND wl.logged_at >= $from
  AND wl.logged_at <= $to
  AND wl.deleted_at IS NULL
  AND ws.is_warmup = false
GROUP BY DATE_TRUNC('week', wl.logged_at), e.muscle_groups
ORDER BY week_start DESC;
```

---

## 4. Algoritmo de Reintentos con Backoff Exponencial (Offline Queue)

### Objetivo
Reintentar operaciones fallidas de la cola offline con intervalos crecientes,
sin saturar al servidor ni bloquear al usuario indefinidamente.

### Fórmula

```
delay_ms = MIN(BASE_DELAY_MS × 2^retry_count, MAX_DELAY_MS)
```

Valores concretos:
```
BASE_DELAY_MS = 30_000   (30 segundos)
MAX_DELAY_MS  = 3_600_000 (1 hora)
MAX_RETRIES   = 5

retry 0: 30s
retry 1: 60s
retry 2: 120s (2 min)
retry 3: 240s (4 min)
retry 4: 480s (8 min)
→ Tras retry 5: marcar como FAILED, no reintentar automáticamente
```

### Pseudocódigo TypeScript

```typescript
interface OfflineOperation {
  id: string
  type: 'CREATE' | 'UPDATE' | 'DELETE'
  entity: 'workout_log' | 'session' | 'measurement'
  endpoint: string
  method: 'POST' | 'PATCH' | 'DELETE'
  payload: object
  idempotencyKey: string        // UUID generado cuando el usuario hizo la acción
  clientTimestamp: string       // ISO8601 - cuándo ocurrió la acción
  retryCount: number            // comienza en 0
  maxRetries: number            // default 5
  nextRetryAt: string | null    // ISO8601 - cuándo intentar de nuevo
  status: 'pending' | 'failed'
  lastError: string | null
}

const BASE_DELAY = 30_000
const MAX_DELAY = 3_600_000

function getNextRetryDelay(retryCount: number): number {
  return Math.min(BASE_DELAY * Math.pow(2, retryCount), MAX_DELAY)
}

async function processQueue(queue: OfflineOperation[]): Promise<void> {
  const now = new Date()
  const ready = queue.filter(op =>
    op.status === 'pending' &&
    (op.nextRetryAt === null || new Date(op.nextRetryAt) <= now)
  )

  for (const op of ready) {
    try {
      await sendOperation(op)
      removeFromQueue(op.id)
    } catch (error) {
      const newRetryCount = op.retryCount + 1

      if (newRetryCount > op.maxRetries) {
        markAsFailed(op.id, error.message)
        notifyUser(`No se pudo sincronizar: ${op.entity}`)
      } else {
        const delay = getNextRetryDelay(newRetryCount)
        updateOperation(op.id, {
          retryCount: newRetryCount,
          nextRetryAt: new Date(Date.now() + delay).toISOString(),
          lastError: error.message
        })
      }
    }
  }
}
```

### Cuándo no reintentar automáticamente

No reintentar si el error es:
- `401 UNAUTHORIZED`: el token expiró → intentar refresh primero, luego reintentar.
- `403 FORBIDDEN`: el atleta no tiene permiso → marcar como FAILED directamente.
- `409 CONFLICT`: conflicto de datos → marcar como FAILED, notificar al usuario para resolución manual.
- `422 UNPROCESSABLE`: datos inválidos → marcar como FAILED (no se va a resolver reintentando).

Sí reintentar en:
- Errores de red (timeout, sin conexión).
- `500 INTERNAL_ERROR`: error transitorio del servidor.
- `429 TOO_MANY_REQUESTS`: usar el `Retry-After` header si está disponible.

---

## 5. Detección de Conflicto en UPDATE (Optimistic Concurrency)

### Objetivo
Detectar cuando el cliente intenta actualizar un recurso que fue modificado por
otra fuente (otro dispositivo, el coach) después de que el cliente lo cargó.

### Protocolo

**Cliente**:
```
PATCH /logs/:id
Headers:
  Idempotency-Key: <uuid>
Body:
  {
    client_updated_at: "2026-03-14T10:00:00Z",  // timestamp cuando el cliente hizo el cambio
    sets: [...]
  }
```

**Servidor**:
```
SI log.updated_at > client_updated_at:
  RETORNAR 409 Conflict {
    error: 'CONFLICT',
    server_version: log,         // versión actual del servidor
    client_version: { sets: [...] }  // lo que el cliente intentó aplicar
  }
SINO:
  Aplicar cambio
  RETORNAR 200 { data: log }
```

**Cliente al recibir 409**:
```
Mostrar UI: "Este ejercicio fue modificado en otro dispositivo.
¿Cuál versión querés conservar?"
[Ver diferencias] [Conservar la mía] [Usar la del servidor]
```

### Nota
Para creaciones (`POST /logs`), no hay conflicto posible si se usan idempotency keys
correctamente. El conflicto solo ocurre en actualizaciones.
