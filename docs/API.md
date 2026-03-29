# API.md — Contratos de API

Base URL: `http://localhost:3000/v1` (dev) | `https://api.trainr.app/v1` (prod)
Documentación interactiva: `GET /api/docs` (Swagger UI)

---

## Convenciones globales

### Autenticación
Todos los endpoints protegidos requieren el header:
```
Authorization: Bearer <access_token>
```

### Formato de respuesta exitosa
```json
{ "data": { ... } }
```

### Formato de respuesta paginada
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

### Formato de error
```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Email ya registrado",
  "details": { "field": "email", "issue": "duplicate" }
}
```

---

## Auth

### POST /auth/login
```json
// Request
{
  "email": "coach@gym.com",
  "password": "secreto123"
}

// Response 200
{
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "opaque-token-string",
    "expires_in": 900,
    "user": {
      "id": "uuid",
      "email": "coach@gym.com",
      "role": "coach"
    }
  }
}
```

### POST /auth/refresh
```json
// Request
{ "refresh_token": "opaque-token-string" }

// Response 200
{
  "data": {
    "access_token": "eyJ... (nuevo)",
    "refresh_token": "nuevo-opaque-token"
  }
}

// Error 401 — token inválido, expirado o revocado
// Error 401 TOKEN_REUSE — reuso detectado, sesión invalidada
```

### POST /auth/logout
```json
// Request
{ "refresh_token": "opaque-token-string" }
// Response 204 No Content
```

### GET /auth/me
```json
// Response 200
{
  "data": {
    "id": "uuid",
    "email": "coach@gym.com",
    "role": "coach",
    "profile": {
      "id": "uuid",
      "name": "Juan García",
      "avatar_url": "https://..."
    }
  }
}
```

---

## Athletes (como atleta autenticado)

### GET /athletes/me/today
```json
// Response 200 — pendiente
{
  "data": {
    "status": "pending",
    "trainingDay": {
      "id": "uuid",
      "planId": "uuid",
      "weekNumber": 3,
      "dayOfWeek": 1,
      "name": "Piernas",
      "orderIndex": 0,
      "isRestDay": false,
      "createdAt": "2026-03-14T09:00:00Z",
      "exercises": [
        {
          "id": "uuid",
          "trainingDayId": "uuid",
          "exerciseId": "uuid",
          "orderIndex": 1,
          "setsTarget": 4,
          "repsTarget": "8-10",
          "weightTarget": "70% 1RM",
          "restSeconds": 180,
          "notes": null,
          "createdAt": "2026-03-14T09:00:00Z",
          "updatedAt": "2026-03-14T09:00:00Z",
          "exercise": {
            "id": "uuid",
            "name": "Sentadilla",
            "category": "strength",
            "muscleGroups": ["quadriceps", "glutes"],
            "videoUrl": "https://...",
            "instructions": "...",
            "createdBy": null,
            "createdAt": "2026-03-14T09:00:00Z",
            "updatedAt": "2026-03-14T09:00:00Z"
          }
        }
      ]
    },
    "session": null
  }
}

// Response 200 — sin plan
{ "data": { "status": "no_plan", "startsAt": "2026-03-20" } }

// Response 200 — día de descanso
{
  "data": {
    "status": "rest_day",
    "nextTrainingDay": {
      "id": "uuid",
      "planId": "uuid",
      "weekNumber": 3,
      "dayOfWeek": 3,
      "name": "Empuje",
      "orderIndex": 0,
      "isRestDay": false,
      "createdAt": "2026-03-14T09:00:00Z"
    }
  }
}

// Response 200 — ya entrenó hoy
{
  "data": {
    "status": "already_done",
    "session": {
      "id": "uuid",
      "athleteId": "uuid",
      "planAssignmentId": "uuid",
      "trainingDayId": "uuid",
      "startedAt": "2026-03-14T09:00:00Z",
      "completedAt": "2026-03-14T10:15:00Z",
      "notes": null,
      "status": "completed",
      "perceivedEffort": 8
    }
  }
}

// Response 200 — en progreso
{
  "data": {
    "status": "in_progress",
    "trainingDay": { ... },
    "session": {
      "id": "uuid",
      "athleteId": "uuid",
      "planAssignmentId": "uuid",
      "trainingDayId": "uuid",
      "startedAt": "2026-03-14T09:00:00Z",
      "completedAt": null,
      "notes": null,
      "status": "in_progress",
      "perceivedEffort": null
    }
  }
}
```

---

## Plans

### POST /plans
```json
// Request
{
  "name": "Hipertrofia 12 semanas",
  "description": "Plan de volumen para atletas intermedios",
  "total_weeks": 12,
  "cycle_weeks": 4,
  "auto_cycle": false
}

// Response 201
{ "data": { "id": "uuid", "name": "...", ... } }
```

### POST /plans/:id/assignments
```json
// Request
{
  "athlete_id": "uuid",
  "start_date": "2026-03-17"
}

// Response 201
{
  "data": {
    "id": "uuid",
    "plan_id": "uuid",
    "athlete_id": "uuid",
    "start_date": "2026-03-17",
    "status": "active"
  }
}

// Error 409 PLAN_ALREADY_ACTIVE — atleta ya tiene un plan activo
```

---

## Sessions

### POST /sessions
```json
// Request
// Header: Idempotency-Key: <uuid>
{
  "training_day_id": "uuid",
  "plan_assignment_id": "uuid"
}

// Response 201
{
  "data": {
    "id": "uuid",
    "started_at": "2026-03-14T09:00:00Z",
    "status": "in_progress"
  }
}
```

### PATCH /sessions/:id/complete
```json
// Request
{
  "perceived_effort": 8,
  "notes": "Buena sesión, subí 5kg en sentadilla"
}

// Response 200
{
  "data": {
    "id": "uuid",
    "completed_at": "2026-03-14T10:15:00Z",
    "status": "completed"
  }
}
```

---

## Logs

### POST /logs
```json
// Header: Idempotency-Key: <uuid>
// Request
{
  "session_id": "uuid",
  "exercise_id": "uuid",
  "logged_at": "2026-03-14T09:30:00Z", // optional, default: now
  "notes": "Último set llegué al fallo",
  "sets": [
    { "set_number": 1, "weight_kg": 80, "reps": 10, "rpe": 7, "is_warmup": false },
    { "set_number": 2, "weight_kg": 80, "reps": 9, "rpe": 8, "is_warmup": false },
    { "set_number": 3, "weight_kg": 80, "reps": 8, "rpe": 9, "is_warmup": false },
    { "set_number": 4, "weight_kg": 80, "reps": 7, "rpe": 10, "is_warmup": false, "is_failure": true }
  ]
}

// Response 201
{
  "data": {
    "id": "uuid",
    "session_id": "uuid",
    "exercise_id": "uuid",
    "logged_at": "2026-03-14T09:30:00Z",
    "total_volume": 2720,
    "sets": [ ... ]
  }
}
```

### GET /logs/history
```
Query params:
  exercise_id     uuid     — filtrar por ejercicio
  session_id      uuid     — filtrar por sesión
  from            ISO8601  — desde fecha
  to              ISO8601  — hasta fecha
  cursor          string   — cursor opaco para siguiente página
  limit           int      — default 20, max 100
  include_sets    boolean  — incluir detalle de sets (default false)

`include_sets=true` agrega `sets` en cada item del historial.

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "exercise": { "id": "uuid", "name": "Sentadilla" },
      "logged_at": "2026-03-14T09:30:00Z",
      "total_volume": 2720,
      "sets_count": 4
    }
  ],
  "pagination": {
    "cursor": "eyJsb2dnZWRfYXQiOi4uLn0=",
    "has_more": true,
    "count": 20
  }
}
```

### PATCH /logs/:id
```json
// Request
{
  "client_updated_at": "2026-03-14T09:30:00Z",
  "notes": "Actualizado",
  "sets": [ ... ]
}

// Response 200 — éxito
// Response 409 CONFLICT — otro dispositivo/coach modificó el log después
{
  "statusCode": 409,
  "error": "CONFLICT",
  "message": "El log fue modificado después de que lo cargaste",
  "details": {
    "server_version": { ... },
    "client_version": { ... }
  }
}
```

---

## Exercises

### GET /exercises
```
Query params:
  search       string   — búsqueda por nombre (full text)
  category     string   — 'strength' | 'cardio' | 'flexibility'
  muscle_group string   — filtrar por grupo muscular
  cursor       string
  limit        int      — default 20

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "name": "Sentadilla",
      "category": "strength",
      "muscle_groups": ["quadriceps", "glutes", "core"],
      "video_url": "https://...",
      "created_by": null  -- null = ejercicio global
    }
  ],
  "pagination": { ... }
}
```

---

## Measurements

### POST /athletes/me/measurements
```json
// Header: Idempotency-Key: <uuid>
// Request
{
  "measured_at": "2026-03-14T08:00:00Z",
  "weight_kg": 82.5,
  "body_fat_pct": 18.2,
  "muscle_mass_kg": 39.6,
  "notes": "En ayunas"
}

// Response 201
{ "data": { "id": "uuid", "measured_at": "...", "weight_kg": 82.5, "body_fat_pct": 18.2, "muscle_mass_kg": 39.6, "notes": "En ayunas", "source": "manual" } }
```

### GET /athletes/me/measurements
```
Response 200:
{
  "data": [
    {
      "id": "uuid",
      "measured_at": "2026-03-14T08:00:00Z",
      "weight_kg": 82.5,
      "body_fat_pct": 18.2,
      "muscle_mass_kg": 39.6,
      "notes": "En ayunas",
      "source": "manual"
    }
  ]
}
```
