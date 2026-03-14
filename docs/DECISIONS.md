# DECISIONS.md — Architecture Decision Records (ADRs)

Cada decisión de arquitectura relevante se documenta acá con su contexto, decisión y consecuencias.
No cambiar una decisión sin agregar un nuevo ADR que la reemplace.

---

## ADR-001: Cursor-based pagination en lugar de limit/offset

**Status**: Accepted
**Fecha**: 2026-03-14

### Contexto
El historial de entrenamiento de un atleta activo puede crecer indefinidamente (20 sets/día ≈ 7.300 sets/año). La paginación `OFFSET N` en PostgreSQL escanea y descarta las N filas anteriores, lo que degrada linealmente con el tamaño del historial.

### Decisión
Usar **key set pagination** (cursor-based) en todos los endpoints de listas que pueden ser largas:
- `GET /logs/history`
- `GET /athletes/me/measurements`

El cursor es `base64(JSON({ campo_orden, id }))` y se usa en la cláusula `WHERE`:
```sql
-- En lugar de OFFSET N:
WHERE (logged_at, id) < ($cursor_logged_at, $cursor_id)
ORDER BY logged_at DESC, id DESC
LIMIT 21  -- pedir 21 para detectar has_more
```

Los endpoints de listas cortas (plans, athletes del coach) pueden usar `limit/offset` sin problema.

### Consecuencias
- **Positivo**: Performance constante independiente del tamaño del historial.
- **Positivo**: No hay problema de "moving window" cuando se insertan nuevos registros.
- **Negativo**: No se puede saltar a una página arbitraria ("ir a página 5").
- **Negativo**: El cliente no sabe el total de registros (no se puede mostrar "página 3 de 47").
- **Mitigación**: Para infinite scroll en mobile, el total no es necesario. Suficiente con `has_more`.

---

## ADR-002: Sets normalizados en tabla `workout_sets` (no jsonb)

**Status**: Accepted
**Fecha**: 2026-03-14

### Contexto
El diseño original guardaba los sets como `jsonb` en `workout_logs`. Esto es flexible pero impide hacer queries a nivel de set individual, como "todos los sets de squat con más de 100kg" o calcular el 1RM estimado histórico.

### Decisión
Crear la tabla `workout_sets` con una fila por set:
```sql
workout_sets(id, workout_log_id, set_number, weight_kg, reps, rpe, is_warmup, ...)
```

### Consecuencias
- **Positivo**: Queries SQL eficientes a nivel de set.
- **Positivo**: Cálculos de volumen y 1RM se pueden hacer en DB.
- **Positivo**: Se pueden agregar campos por set sin migrar jsonb.
- **Negativo**: Más filas en DB (aceptable con TimescaleDB y particionado por tiempo).
- **Negativo**: La API de escritura es ligeramente más compleja (enviar array de sets en el body).

---

## ADR-003: `plan_assignments` como tabla de unión

**Status**: Accepted
**Fecha**: 2026-03-14

### Contexto
El diseño original tenía `athlete_id` directamente en `training_plans`. Esto impide:
- Reutilizar un plan para múltiples atletas.
- Registrar la fecha de inicio de la asignación (necesaria para el algoritmo "día de hoy").
- Llevar historial de qué planes tuvo un atleta.
- Pausar y reanudar un plan.

### Decisión
Crear la tabla `plan_assignments`:
```sql
plan_assignments(id, plan_id, athlete_id, assigned_by, start_date, end_date, status)
```

Un atleta solo puede tener un assignment con `status = 'active'` a la vez. El backend valida esto en la transacción al crear una nueva asignación.

### Consecuencias
- **Positivo**: Un plan puede ser plantilla reutilizable para múltiples atletas.
- **Positivo**: `start_date` permite calcular la semana actual del plan.
- **Positivo**: Historial completo de planes del atleta.
- **Negativo**: Una query adicional para obtener el assignment activo antes de calcular "día de hoy".

---

## ADR-004: `workout_sessions` como entidad de primer nivel

**Status**: Accepted
**Fecha**: 2026-03-14

### Contexto
El diseño original no tenía un concepto de "sesión de entrenamiento" como entidad. Los `workout_logs` eran independientes y no había forma de saber qué ejercicios formaron parte de la misma sesión, ni cuándo empezó o terminó.

### Decisión
Crear la entidad `workout_sessions` que agrupa los logs de una sesión:
```sql
workout_sessions(id, athlete_id, plan_assignment_id, training_day_id, started_at, completed_at, status)
```

El flujo es:
1. `POST /sessions` → recibe `session_id`
2. Múltiples `POST /logs` con el `session_id`
3. `PATCH /sessions/:id/complete`

### Consecuencias
- **Positivo**: Se puede reconstruir qué hizo el atleta en cada sesión.
- **Positivo**: El algoritmo "día de hoy" puede detectar sesiones en progreso.
- **Positivo**: Permite mostrar "ya completaste el entrenamiento de hoy".
- **Negativo**: El cliente debe manejar el ciclo de vida de la sesión (crear → completar).
- **Mitigación**: Si el cliente falla sin completar la sesión, un cron job la marca como `abandoned` tras 24 horas.

---

## ADR-005: `body_measurements` como hypertable TimescaleDB

**Status**: Accepted
**Fecha**: 2026-03-14

### Contexto
El diseño original guardaba `body_weight` como un campo float en la tabla `athletes`. Esto sobreescribe el valor anterior y pierde el historial, que es fundamental para mostrar progreso al atleta.

### Decisión
Eliminar `body_weight` de `athletes`. Crear la tabla `body_measurements` como hypertable de TimescaleDB, particionada por `measured_at`. Agregar una vista o función que retorne la última medición para cada atleta (para no hacer N+1 al listar atletas).

### Consecuencias
- **Positivo**: Historial completo de peso y composición corporal.
- **Positivo**: TimescaleDB optimiza queries de series temporales (rangos, agregados por semana).
- **Positivo**: Se pueden agregar más métricas (body_fat, muscle_mass) sin cambiar la tabla de atletas.
- **Negativo**: Para mostrar el peso actual en la lista de atletas, se necesita un JOIN o subconsulta.
- **Mitigación**: Vista materializada o trigger que mantiene `latest_weight_kg` en `athletes`.

---

## ADR-006: Idempotency keys para operaciones offline

**Status**: Accepted
**Fecha**: 2026-03-14

### Contexto
El soporte offline implica que el cliente puede enviar el mismo request múltiples veces al reconectarse (la cola de reintentos no sabe si el request anterior llegó o no al servidor). Sin idempotencia, esto crea duplicados en el historial de entrenamiento.

### Decisión
Toda operación POST de escritura de entrenamiento requiere un header `Idempotency-Key` con un UUID v4 generado en el cliente al momento de crear la operación (no al reintentarlo).

El backend:
1. Verifica si el key ya existe en la tabla `idempotency_keys`.
2. Si existe: retorna la respuesta almacenada sin ejecutar la operación.
3. Si no existe: ejecuta la operación y guarda el key con la respuesta en una transacción.

TTL de las keys: 7 días (suficiente para el peor caso de offline).

### Consecuencias
- **Positivo**: El cliente puede reintentar indefinidamente sin crear duplicados.
- **Positivo**: El comportamiento es transparente para el cliente (siempre recibe 200/201).
- **Negativo**: Overhead de storage y lookup en cada POST.
- **Negativo**: Si el mismo key se envía con payload diferente, retorna 409 `IDEMPOTENCY_CONFLICT` (esto indica un bug en el cliente).

---

## ADR-007: Refresh token rotation con detección de robo

**Status**: Accepted
**Fecha**: 2026-03-14

### Contexto
El diseño original usaba solo JWT con expiración de 7 días. Sin refresh tokens, no hay forma de revocar acceso a una cuenta comprometida sin cambiar el `JWT_SECRET` global. Con access tokens de vida larga (7 días), la ventana de exposición es grande.

### Decisión
- **Access token**: JWT, expira en 15 minutos.
- **Refresh token**: opaco, guardado hasheado (SHA-256) en DB, expira en 30 días.
- **Rotación**: cada uso del refresh token genera uno nuevo y revoca el anterior.
- **Familias**: los tokens se agrupan por `family_id`. Si se detecta reuso de un token revocado (posible robo), se revocan TODOS los tokens de esa familia.

### Consecuencias
- **Positivo**: Ventana de exposición de 15 minutos si el access token es robado.
- **Positivo**: Detección automática de robo de refresh token.
- **Positivo**: El usuario puede invalidar todas sus sesiones con `POST /auth/logout-all`.
- **Negativo**: El cliente debe manejar el flujo de refresh y almacenar dos tokens.
- **Negativo**: Una DB query adicional en cada refresh.

---

## ADR-008: SecureStore para tokens JWT en el cliente

**Status**: Accepted
**Fecha**: 2026-03-14

### Contexto
Los tokens JWT son credenciales sensibles. AsyncStorage en React Native no está encriptado y puede ser leído por otras apps o en dispositivos rooteados.

### Decisión
Usar `expo-secure-store` (que usa Keychain en iOS y EncryptedSharedPreferences en Android) para almacenar `access_token` y `refresh_token`. AsyncStorage se usa para datos de caché no sensibles (perfil, cola offline).

### Consecuencias
- **Positivo**: Los tokens están protegidos por el encriptado del sistema operativo.
- **Negativo**: SecureStore tiene límite de tamaño por item (~2KB). Los JWT deben ser lo suficientemente pequeños.
- **Mitigación**: Mantener el payload del JWT mínimo (solo `sub`, `role`, `iat`, `exp`).

---

## ADR-009: `week_number` y `day_of_week` en `training_days`

**Status**: Accepted
**Fecha**: 2026-03-14

### Contexto
El diseño original tenía solo `day_number` (un entero incremental) en `training_days`. Con un plan de 12 semanas y 4 días por semana, `day_number` no permite saber a qué semana pertenece un día ni en qué día ISO de la semana ocurre.

### Decisión
Reemplazar `day_number` con:
- `week_number int CHECK(>= 1)`: la semana dentro del plan (1, 2, 3...).
- `day_of_week int CHECK(1-7)`: el día ISO de la semana (1=lunes, 7=domingo).

Restricción `UNIQUE(plan_id, week_number, day_of_week)` para garantizar coherencia.

### Consecuencias
- **Positivo**: El algoritmo "día de hoy" puede calcular directamente qué día mostrar.
- **Positivo**: Soporte para planes con ciclos (`cycle_weeks`).
- **Positivo**: El atleta entrena siempre el mismo día de la semana (lunes piernas, jueves empuje).
- **Negativo**: Los planes no pueden tener días "flotantes" (ej: "3 días a la semana, cualquier día").
- **Mitigación**: Para planes flotantes, usar `order_index` en lugar de `day_of_week` (pendiente si surge el requerimiento).

---

## ADR-010: `reps_target` como varchar en `plan_day_exercises`

**Status**: Accepted
**Fecha**: 2026-03-14

### Contexto
Las repeticiones en entrenamiento de fuerza no siempre son un número entero. Los coaches prescriben rangos ("8-12"), AMRAP ("max"), o ejercicios basados en tiempo ("30s").

### Decisión
`reps_target varchar(20)` que acepta cualquier string. El frontend muestra el valor tal cual al atleta.

### Consecuencias
- **Positivo**: Flexibilidad total para prescripciones no estándar.
- **Negativo**: No se puede validar automáticamente que el atleta completó las reps "correctas".
- **Negativo**: No se puede comparar automáticamente prescribed vs actual para adherencia exacta.
- **Mitigación**: La comparación de adherencia usa RPE y volumen como proxy, no reps exactas.
