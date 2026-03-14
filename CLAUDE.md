# CLAUDE.md — Raíz del Monorepo

El briefing completo del proyecto está en [docs/CLAUDE.md](./docs/CLAUDE.md).
Léelo antes de cada sesión.

## Estructura rápida

```
apps/api/      → Backend NestJS (Node.js v20, NestJS v11)
apps/mobile/   → Frontend React Native + Expo
packages/shared-types/ → Tipos TypeScript compartidos
docs/          → Documentación de arquitectura (LEER PRIMERO)
docker/        → Docker Compose para infra local
```

## Comandos esenciales

```bash
# Levantar infra (PostgreSQL + Redis + MinIO)
npm run db:up

# Aplicar migraciones de DB
npm run db:migrate

# Backend
npm run dev:api

# Frontend
npm run dev:mobile
```

## Documentación

- [docs/CLAUDE.md](./docs/CLAUDE.md) — Briefing completo, stack, convenciones
- [docs/API.md](./docs/API.md) — Contratos de endpoints
- [docs/SCHEMA.md](./docs/SCHEMA.md) — DDL de la base de datos
- [docs/DECISIONS.md](./docs/DECISIONS.md) — Por qué se tomaron las decisiones de arquitectura
- [docs/ALGORITHMS.md](./docs/ALGORITHMS.md) — Algoritmos críticos (día de hoy, 1RM, offline)
- [docs/OFFLINE.md](./docs/OFFLINE.md) — Protocolo completo de soporte offline
