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
    "training_day": {
      "id": "uuid",
      "week_number": 3,
      "day_of_week": 1,
      "name": "Piernas",
      "exercises": [
        {
          "id": "uuid",
          "order_index": 1,
          "sets_target": 4,
          "reps_target": "8-10",
          "weight_target": "70% 1RM",
          "rest_seconds": 180,
          "exercise": {
            "id": "uuid",
            "name": "Sentadilla",
            "category": "strength",
            "muscle_groups": ["quadriceps", "glutes"],
            "video_url": "https://...",
            "instructions": "..."
          }
        }
      ]
    },
    "session": null
  }
}

// Response 200 — sin plan
{ "data": { "status": "no_plan" } }

// Response 200 — día de descanso
{
  "data": {
    "status": "rest_day",
    "next_training_day": {
      "id": "uuid",
      "name": "Empuje",
      "days_away": 2
    }
  }
}

// Response 200 — ya entrenó hoy
{
  "data": {
    "status": "already_done",
    "session": {
      "id": "uuid",
      "started_at": "2026-03-14T09:00:00Z",
      "completed_at": "2026-03-14T10:15:00Z",
      "perceived_effort": 8
    }
  }
}

// Response 200 — en progreso
{
  "data": {
    "status": "in_progress",
    "training_day": { ... },
    "session": {
      "id": "uuid",
      "started_at": "2026-03-14T09:00:00Z"
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
  "logged_at": "2026-03-14T09:30:00Z",
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
// Request
{
  "measured_at": "2026-03-14T08:00:00Z",
  "weight_kg": 82.5,
  "body_fat_pct": 18.2,
  "notes": "En ayunas"
}

// Response 201
{ "data": { "id": "uuid", "measured_at": "...", "weight_kg": 82.5, ... } }
```

### GET /athletes/me/measurements
```
Query params:
  from    ISO8601
  to      ISO8601
  cursor  string
  limit   int

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "measured_at": "2026-03-14T08:00:00Z",
      "weight_kg": 82.5,
      "body_fat_pct": 18.2
    }
  ],
  "pagination": { ... }
}
```
