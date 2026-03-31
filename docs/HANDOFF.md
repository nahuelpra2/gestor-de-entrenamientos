# HANDOFF — estado actual del proyecto

> **Project key oficial en Engram:** `gestor-de-entrenamientos`

Este documento deja un handoff compartible por Git para que cualquier colaborador pueda leer el estado real del proyecto aunque Engram no esté apuntando al mismo backend o workspace.

## Resumen ejecutivo

- El repo es un monorepo con `apps/api`, `apps/mobile` y `packages/shared-types`.
- El backend está más avanzado que el mobile.
- El backend real ya tiene módulos funcionales para `auth`, `athletes`, `exercises`, `plans`, `workouts` y `measurements`.
- El backend runtime usa **NestJS 11**.
- La idempotencia offline real se apoya en base de datos mediante `IdempotencyInterceptor`.
- Los commits recientes están enfocados en hardening, integridad y alineación de contratos.
- El mobile existe, pero sigue en un estado más mínimo que la arquitectura objetivo documentada.
- Hay drift entre documentación y runtime; para continuidad, priorizar código y commits recientes cuando haya conflicto.

## Estado actual

### Backend

Rutas y piezas importantes:

- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/common/interceptors/idempotency.interceptor.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/workouts/workouts.service.ts`
- `apps/api/src/measurements/`

Estado resumido:

- Autenticación con JWT + refresh rotation.
- Gestión de atletas, ejercicios y planes ya implementada en backend.
- Lógica de `today`, sesiones, logs y mediciones ya presente.
- Soporte offline backend endurecido con idempotencia persistida.

### Mobile

Rutas importantes:

- `apps/mobile/App.tsx`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/stores/auth.store.ts`
- `apps/mobile/src/stores/offline-queue.store.ts`
- `apps/mobile/src/lib/offline-queue.ts`

Estado resumido:

- Hay login, persistencia de auth y piezas base para offline queue.
- El mobile no refleja todavía toda la arquitectura objetivo descrita en la documentación.
- El backend va más adelantado que la experiencia móvil end-to-end.

## Riesgos / advertencias

- Hay drift entre `docs/CLAUDE.md` y el runtime real en algunos puntos.
- Algunas descripciones documentales cubren más alcance del que hoy está implementado en runtime.
- El mobile sigue más verde que el backend.
- Si se usa Engram, la key de proyecto debe ser siempre `gestor-de-entrenamientos`.

## Archivos para revisar primero

- `docs/CLAUDE.md`
- `docs/API.md`
- `docs/DECISIONS.md`
- `docs/OFFLINE.md`
- `apps/api/src/app.module.ts`
- `apps/api/src/common/interceptors/idempotency.interceptor.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/workouts/workouts.service.ts`
- `apps/mobile/App.tsx`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/lib/offline-queue.ts`

## Recomendación para colaboradores

1. Tomar este archivo como handoff base compartido.
2. Si usan Engram, consultar o guardar siempre con el proyecto `gestor-de-entrenamientos`.
3. Cuando haya diferencias entre documentación y runtime, priorizar el código actual y los commits recientes.

## Próximos pasos sugeridos

- Normalizar documentación vs runtime.
- Seguir con mobile real e integración offline end-to-end.
- Mantener una convención única para Engram y handoffs del proyecto.
