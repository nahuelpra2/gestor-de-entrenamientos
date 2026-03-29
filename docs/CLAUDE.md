# CLAUDE.md — Trainr: Gestor de Entrenamiento

Este archivo es el briefing del proyecto. Léelo completo antes de cada sesión.
Contiene todas las decisiones de arquitectura ya tomadas — no las discutas, implementalas.

---

## Qué es este proyecto

**Trainr** es una app móvil (iOS + Android) para entrenadores de gym.
El entrenador crea planes de entrenamiento, los asigna a atletas con fecha de inicio,
y los atletas registran sus sesiones desde el móvil con soporte offline completo.

---

## Stack tecnológico

### Frontend — `apps/mobile/`
- **React Native** con **Expo SDK 51+**
- **Expo Router v3** para navegación file-based (tabs + stacks)
- **TanStack Query v5** para server state (fetching, caché, sincronización)
- **Zustand v4** para client state con persistencia selectiva
- **TypeScript** estricto (`strict: true`) en todo el proyecto
- **Expo SecureStore** para tokens JWT
- **AsyncStorage** para caché de datos no sensibles

### Backend — `apps/api/`
- **NestJS v10** con arquitectura modular
- **PostgreSQL 16** + **TimescaleDB** (hypertables para series temporales)
- **TypeORM** para migraciones y entidades
- **JWT** con refresh token rotation (access 15m, refresh 30d)
- **S3-compatible** (MinIO en dev) para fotos de ejercicios
- **Redis** para idempotency keys y rate limiting

### Shared — `packages/shared-types/`
- Tipos TypeScript compartidos entre apps
- Contratos de request/response de la API

---

## Estructura del monorepo

```
gestor-de-entrenamiento/
├── apps/
│   ├── mobile/          # Expo + React Native
│   └── api/             # NestJS backend
├── packages/
│   └── shared-types/    # Tipos compartidos
├── docs/                # Documentación de arquitectura
├── docker/              # Docker Compose + configs
└── package.json         # Workspace root
```

Ver estructura completa de carpetas en [SCHEMA.md](./SCHEMA.md).

---

## Schema de base de datos

### users
```sql
id uuid PK, email varchar UNIQUE, password_hash varchar,
role enum('coach','athlete'), created_at timestamptz
```

### coaches
```sql
id uuid PK, user_id FK users, name varchar, bio text, avatar_url varchar
```

### athletes
```sql
id uuid PK, user_id FK users, coach_id FK coaches,
name varchar, birthdate date, avatar_url varchar
-- NO tiene body_weight (usar body_measurements)
```

### exercises
```sql
id uuid PK, name varchar, category varchar, muscle_groups text[],
video_url varchar, instructions text,
created_by FK coaches NULLABLE  -- null = ejercicio global del sistema
```

### training_plans
```sql
id uuid PK, coach_id FK coaches, name varchar, description text,
total_weeks int, cycle_weeks int NULLABLE,
auto_cycle boolean DEFAULT false
-- cycle_weeks: cuántas semanas forman un ciclo que se repite
```

### training_days
```sql
id uuid PK, plan_id FK training_plans,
week_number int CHECK(>= 1),       -- semana 1, 2, 3... dentro del plan
day_of_week int CHECK(1-7),        -- ISO: 1=lunes, 7=domingo
name varchar(100) NULLABLE,        -- "Piernas", "Empuje"
order_index int,
is_rest_day boolean DEFAULT false,
UNIQUE(plan_id, week_number, day_of_week)
```

### plan_day_exercises
```sql
id uuid PK, training_day_id FK, exercise_id FK, order_index int,
sets_target int, reps_target varchar(20),  -- "8-12", "hasta el fallo", "30s"
weight_target varchar(50) NULLABLE,        -- "70% 1RM", "60kg"
rest_seconds int NULLABLE, notes text
```

### plan_assignments  ← NUEVO (resuelve el problema de asignación)
```sql
id uuid PK, plan_id FK training_plans, athlete_id FK athletes,
assigned_by FK coaches, start_date date NOT NULL,
end_date date NULLABLE, status enum('active','paused','completed','cancelled'),
created_at timestamptz,
UNIQUE(athlete_id, plan_id, start_date)
```

### workout_sessions  ← NUEVO (agrupa logs de una sesión)
```sql
id uuid PK, athlete_id FK, plan_assignment_id FK NULLABLE,
training_day_id FK NULLABLE, started_at timestamptz NOT NULL,
completed_at timestamptz NULLABLE, notes text,
perceived_effort int CHECK(1-10) NULLABLE,
status enum('in_progress','completed','abandoned')
```

### workout_logs
```sql
id uuid PK,
workout_session_id FK workout_sessions NOT NULL,  -- NUEVO
athlete_id FK (denormalizado),
exercise_id FK,
training_day_id FK NULLABLE (denormalizado),      -- NUEVO
logged_at timestamptz NOT NULL, notes text, deleted_at timestamptz
-- TimescaleDB hypertable en logged_at
```

### workout_sets  ← NUEVO (sets normalizados, antes era jsonb)
```sql
id uuid PK, workout_log_id FK workout_logs NOT NULL,
set_number int, weight_kg decimal(6,2), reps int,
duration_seconds int, distance_meters decimal(8,2),
rpe decimal(3,1), is_warmup boolean DEFAULT false,
is_failure boolean DEFAULT false, notes text,
UNIQUE(workout_log_id, set_number)
```

### body_measurements  ← NUEVO (reemplaza body_weight en athletes)
```sql
id uuid, athlete_id FK NOT NULL, measured_at timestamptz NOT NULL,
weight_kg decimal(5,2), body_fat_pct decimal(4,1), muscle_mass_kg decimal(5,2),
notes text, source enum('manual','scale_sync','coach_entered'),
PRIMARY KEY (id, measured_at)
-- TimescaleDB hypertable en measured_at
```

### refresh_tokens
```sql
id uuid PK, user_id FK, token_hash varchar(64) UNIQUE,
family_id uuid, issued_at timestamptz, expires_at timestamptz,
revoked_at timestamptz NULLABLE, replaced_by FK refresh_tokens NULLABLE,
user_agent text, ip_address inet
```

### idempotency_keys
```sql
key varchar(128) PK, athlete_id uuid NOT NULL, endpoint varchar(50),
response_status int, response_body jsonb,
created_at timestamptz, expires_at timestamptz  -- TTL: 7 días
```

---

## API — Base URL: `/v1`

Documentación interactiva disponible en `GET /api/docs` (Swagger UI).

### Auth
| Método | Endpoint | Rol | Descripción |
|--------|----------|-----|-------------|
| POST | /auth/login | público | Login coach y atleta |
| POST | /auth/refresh | público | Rotar refresh token |
| POST | /auth/logout | JWT | Revocar refresh token actual |
| POST | /auth/logout-all | JWT | Revocar toda la familia de tokens |
| GET | /auth/me | JWT | Perfil del usuario autenticado |

### Atletas (como atleta)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /athletes/me | Perfil propio |
| PATCH | /athletes/me | Actualizar perfil |
| GET | /athletes/me/today | Día de entrenamiento de hoy |
| GET | /athletes/me/assignments | Historial de planes asignados |
| GET | /athletes/me/measurements | Historial de mediciones |
| POST | /athletes/me/measurements | Registrar nueva medición |

### Atletas (como coach)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /athletes | Lista de atletas del coach |
| POST | /athletes | Crear atleta |
| GET | /athletes/:id | Perfil de atleta |
| PATCH | /athletes/:id | Actualizar atleta |
| GET | /athletes/:id/measurements | Historial de mediciones del atleta |
| POST | /athletes/:id/measurements | Registrar medición para atleta |

### Planes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /plans | Planes del coach |
| POST | /plans | Crear plan |
| GET | /plans/:id | Detalle con training_days |
| PATCH | /plans/:id | Actualizar |
| DELETE | /plans/:id | Eliminar (si no tiene assignments activos) |
| POST | /plans/:id/duplicate | Duplicar plan |
| POST | /plans/:id/days | Agregar día |
| PATCH | /plans/:id/days/:dayId | Actualizar día |
| DELETE | /plans/:id/days/:dayId | Eliminar día |
| POST | /plans/:id/days/:dayId/exercises | Agregar ejercicio al día |
| PATCH | /plans/:id/days/:dayId/exercises/:exId | Actualizar ejercicio |
| DELETE | /plans/:id/days/:dayId/exercises/:exId | Eliminar ejercicio |
| POST | /plans/:id/assignments | Asignar plan a atleta |
| GET | /plans/:id/assignments | Ver asignaciones |
| PATCH | /plans/:id/assignments/:assignId | Cambiar status/fechas |
| DELETE | /plans/:id/assignments/:assignId | Desasignar |

### Sesiones de Entrenamiento
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /sessions | Iniciar sesión |
| GET | /sessions/:id | Detalle de sesión |
| PATCH | /sessions/:id/complete | Completar sesión |
| PATCH | /sessions/:id/abandon | Abandonar sesión |

### Logs
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /logs | Registrar ejercicio (requiere `Idempotency-Key` header) |
| GET | /logs/history | Historial con cursor pagination |
| GET | /logs/:id | Log específico con sets |
| PATCH | /logs/:id | Editar (con `client_updated_at` para conflict detection) |
| DELETE | /logs/:id | Soft delete |

**Query params de `/logs/history`**:
```
exercise_id, session_id, training_day_id, from, to, cursor, limit (max 100), include_sets
```

### Ejercicios
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /exercises | Catálogo (globales + del coach) |
| POST | /exercises | Crear ejercicio personalizado |
| GET | /exercises/:id | Detalle |
| PATCH | /exercises/:id | Actualizar (solo ejercicios del coach) |

### Mediciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /measurements | Historial con filtros |
| POST | /measurements | Registrar medición |

---

## Algoritmos críticos

### Día de hoy (GET /athletes/me/today)

Ver [ALGORITHMS.md](./ALGORITHMS.md) para pseudocódigo completo.

```typescript
type TodayResponse =
  | { status: 'no_plan'; startsAt?: string }
  | { status: 'rest_day'; nextTrainingDay: TrainingDay | null }
  | { status: 'plan_completed'; assignmentId: string }
  | { status: 'already_done'; session: WorkoutSession }
  | { status: 'pending'; trainingDay: TrainingDayWithExercises; session: null }
  | { status: 'in_progress'; trainingDay: TrainingDayWithExercises; session: WorkoutSession }
```

Pasos:
1. Buscar `plan_assignment` activo del atleta
2. `week_number = floor((hoy - start_date).días / 7) + 1`
3. Si `cycle_weeks`: `week_number = ((week_number-1) % cycle_weeks) + 1`
4. Buscar `training_day WHERE week_number = calc AND day_of_week = isoweekday(hoy)`
5. Verificar si hay `workout_session` completada hoy para ese `training_day`
6. Retornar status correspondiente

---

## Formato de respuestas

### Respuesta exitosa
```json
{ "data": { ... } }
```

### Respuesta exitosa paginada
```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJsb2dnZWRfYXQiOi4uLn0=",
    "has_more": true,
    "count": 20
  }
}
```
`cursor: null` indica última página. Ver [DECISIONS.md](./DECISIONS.md) ADR-001.

### Error
```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Descripción legible",
  "details": {}
}
```

### Códigos de error de negocio
| HTTP | error | Cuándo |
|------|-------|--------|
| 400 | VALIDATION_ERROR | Campos inválidos o faltantes |
| 401 | UNAUTHORIZED | Sin token o expirado |
| 401 | TOKEN_REUSE | Refresh token reusado (posible robo) |
| 403 | FORBIDDEN | Sin permiso para el recurso |
| 403 | ATHLETE_NOT_YOURS | Coach accede a atleta de otro coach |
| 404 | NOT_FOUND | Recurso inexistente |
| 409 | CONFLICT | UPDATE con `client_updated_at` desactualizado |
| 409 | PLAN_ALREADY_ACTIVE | Atleta ya tiene plan activo |
| 409 | IDEMPOTENCY_CONFLICT | Mismo key con payload diferente |
| 500 | INTERNAL_ERROR | Error inesperado del servidor |

---

## Manejo de estado (Zustand)

| Store | Persiste | Storage | Contenido |
|-------|----------|---------|-----------|
| `authStore` | SI | SecureStore | `access_token`, `refresh_token`, `userId`, `userRole` |
| `offlineQueueStore` | SI | AsyncStorage | Array de operaciones pendientes |
| `athleteProfileStore` | SI (TTL 24h) | AsyncStorage | Caché del perfil |
| `todayWorkoutStore` | NO | Memoria | Estado del workout en curso |
| `uiStore` | NO | Memoria | Modales, loading, tema |
| `syncStatusStore` | NO | Memoria | Estado del proceso de sync |

**IMPORTANTE**: Los tokens van en SecureStore (encriptado), nunca en AsyncStorage.

---

## Soporte offline

Ver [OFFLINE.md](./OFFLINE.md) para el protocolo completo.

### Operaciones queueables
- `POST /sessions` (iniciar sesión)
- `PATCH /sessions/:id/complete`
- `POST /logs` (requiere `Idempotency-Key` header)
- `PATCH /logs/:id` (requiere `client_updated_at`)
- `POST /athletes/me/measurements`

### Operaciones que requieren conexión
- Login / Refresh token
- Leer planes y training_days
- Ver historial

### Reintentos con backoff exponencial
```
delay = min(30s × 2^retryCount, 1 hora)
Máximo 5 reintentos → marcar FAILED → notificar al usuario
```

---

## Seguridad y autenticación

- **Access token**: JWT, expira en **15 minutos**
- **Refresh token**: opaco, SHA-256 hasheado en DB, expira en **30 días**
- **Refresh token rotation**: cada uso genera uno nuevo y revoca el anterior
- **Detección de robo**: reuso de token revocado → revocar toda la familia
- **Roles**: `coach` y `athlete` con guards en todos los endpoints
- **Ownership**: el coach solo accede a SUS atletas (validado en servicio)

---

## Paginación

Todos los endpoints de listas largas usan **cursor-based pagination** (no `limit/offset`).
Ver [DECISIONS.md](./DECISIONS.md) ADR-001.

```
GET /logs/history?cursor=<opaque>&limit=20
```

El cursor es `base64(JSON({ campo_de_orden, id }))`. Opaco para el cliente.

---

## Convenciones de código

### Backend (NestJS)
- Un módulo por dominio: `auth`, `athletes`, `coaches`, `plans`, `workout`, `measurements`, `exercises`
- DTOs con `class-validator` para toda entrada de datos
- Guards: `JwtAuthGuard` (autenticación) + `RolesGuard` (autorización)
- Interceptors: `IdempotencyInterceptor` en endpoints de escritura offline
- Los servicios retornan tipos del dominio, no entidades de TypeORM directamente
- Todos los IDs son UUID v4
- Timestamps en UTC, formato ISO 8601

### Frontend (React Native)
- Componentes en PascalCase, hooks en camelCase con prefijo `use`
- Separar lógica de UI: hooks en `src/hooks/`, lógica de negocio en `src/lib/`
- TanStack Query para todo dato del servidor
- Zustand solo para estado local que no es del servidor
- No hacer fetch directo en componentes — siempre via `src/api/`

---

## Variables de entorno

### Backend (`apps/api/.env`)
```
DATABASE_URL=postgresql://trainr:trainr@localhost:5432/trainr_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=<mínimo 64 bytes — openssl rand -base64 64>
JWT_REFRESH_SECRET=<diferente del anterior>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=trainr-dev
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
PORT=3000
NODE_ENV=development
```

### Frontend (`apps/mobile/.env`)
```
EXPO_PUBLIC_API_URL=http://localhost:3000/v1
```

---

## Comandos de desarrollo

```bash
# Levantar infra local
docker compose up -d

# Backend
cd apps/api && npm run start:dev

# Frontend
cd apps/mobile && npx expo start

# Tests
cd apps/api && npm run test
cd apps/api && npm run test:e2e
```

---

## Decisiones de arquitectura

Ver [DECISIONS.md](./DECISIONS.md) para los ADRs completos.

| Decisión | Razón |
|----------|-------|
| `plan_assignments` como tabla de unión | Desacopla plan de atleta, permite historial y reasignación |
| `workout_sessions` como entidad | Agrupa logs de una sesión, permite "completar sesión" |
| Sets en tabla normalizada `workout_sets` | Permite queries a nivel de set (1RM, volumen real) |
| `body_measurements` como hypertable | Historial de peso con queries eficientes en TimescaleDB |
| Cursor-based pagination | Escala para historial largo; offset no escala |
| Idempotency keys en DB | Garantiza exactamente-una-vez en operaciones offline |
| SecureStore para tokens | Más seguro que AsyncStorage para credenciales |
| `week_number` en `training_days` | Habilita planes multi-semana y ciclos |
| `reps_target` es varchar | Soporta rangos ("8-12"), AMRAP ("max"), tiempo ("30s") |
| Access token 15m + Refresh 30d | Ventana pequeña de exposición sin sacrificar UX |

---

## Estado del proyecto

- [x] Arquitectura definida y documentada
- [x] Schema de DB definido
- [x] Endpoints y contratos definidos
- [x] Flujos de navegación definidos
- [x] Protocolo offline definido
- [ ] Fase 1: Setup (monorepo, Docker, NestJS skeleton, auth)
- [ ] Fase 2: Core del coach (exercises, plans, assignments)
- [ ] Fase 3: Core del atleta (today, sessions, logs)
- [ ] Fase 4: Historial y mediciones
- [ ] Fase 5: Mobile (Expo, screens, offline queue)

---

*Documento generado y revisado el 14/03/2026. Reemplaza al CLAUDE.md anterior.*
