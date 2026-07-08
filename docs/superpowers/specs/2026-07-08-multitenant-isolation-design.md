# Refuerzo de aislamiento multi-tenant — DataShield Ley 21.719

## Contexto

DataShield es un SaaS donde cada empresa sube documentos confidenciales. Actualmente
la app corre 100% en el navegador con estado en memoria (React), sin backend real.
La retroalimentación académica pide evidencia técnica concreta de que el aislamiento
por empresa (`company_id`) se aplica de forma sistemática — no solo mencionada — en:
consultas de datos, una capa de control de acceso (middleware/guard), pruebas
negativas de acceso cruzado, y auditoría de intentos no autorizados.

Como no hay backend real, el aislamiento se implementa **simulando el comportamiento
de un backend multi-tenant real**: una capa de lógica pura (sin React) que representa
cómo se filtrarían las consultas y se validaría el acceso en un servidor, cableada
dentro del estado de React existente (`useAppState`), y verificable con pruebas
automatizadas independientes de la UI.

## Objetivo

1. Ningún componente puede leer o escribir un recurso (documento, resultado,
   evento de auditoría) que no pertenezca al `companyId` de la sesión activa.
2. El `companyId` se deriva siempre del RUT autenticado en el login — nunca de un
   parámetro que un llamador pueda inventar libremente.
3. Existe una función central de control de acceso que toda operación debe atravesar.
4. Los intentos de acceso cruzado quedan registrados (auditoría de seguridad).
5. Hay pruebas automatizadas que demuestran el rechazo de acceso cruzado.
6. La UI muestra explícitamente a qué empresa pertenece la sesión.

## Arquitectura

### `lib/tenant/context.ts`
- `TenantContext { companyId: string; companyName: string; role: UserRole; usuario: string }`
- `buildCompanyId(rut: string): string` — normaliza el RUT (sin puntos/guion/espacios,
  mayúsculas) para obtener un identificador estable de empresa.
- `createTenantContext(rut, role, usuario): TenantContext` — único punto de
  construcción de un contexto de tenant; se usa en login y en modo demo.

### `lib/tenant/guard.ts`
- `class TenantAccessError extends Error`
- `assertTenantAccess(ctx: TenantContext, resourceCompanyId: string, detalle?: string): void`
  — compara `ctx.companyId` con el dueño del recurso. Si no coinciden: registra el
  intento en el log de seguridad global (`logSecurityEvent`) y lanza `TenantAccessError`.
- `filterByTenant<T extends { companyId: string }>(ctx, records: T[]): T[]` — filtro
  central reutilizable para cualquier colección que pudiera mezclar datos de varias
  empresas.
- `getSecurityAuditLog()` / `resetSecurityAuditLog()` (uso en tests) — log
  módulo-nivel, independiente del `auditLog` de sesión, para que un intento de
  acceso cruzado quede registrado aunque la sesión atacante cierre sesión después.

### `lib/tenant/repository.ts`
- Simula el almacén de backend multi-tenant: `Map<companyId, { documents }>`.
- `saveDocument(ctx, reqId, doc)` — guarda etiquetado con `companyId` del contexto.
- `getDocument(ctx, ownerCompanyId, reqId)` — patrón equivalente a
  `GET /companies/:companyId/documents/:id`: llama a `assertTenantAccess` antes de
  devolver cualquier dato.
- `listDocuments(ctx)` — solo documentos del propio tenant.
- `resetRepository()` (uso en tests).

### Integración en `hooks/useAppState.ts`
- Nuevo estado `companyId`, calculado con `buildCompanyId(rut)` en `login`/`demo`,
  limpiado en `logout`.
- `uploadDoc` guarda también en el repositorio (`repository.saveDocument`) usando el
  `TenantContext` de la sesión activa.
- Nueva acción de auditoría `'intento de acceso no autorizado (multi-tenant)'` en
  `AuditEvent`. Si el guard deniega un acceso durante la sesión, se registra tanto en
  el log de seguridad global como en el `auditLog` visible en la pestaña Registro.

### UI
- `AppShell`: el badge de empresa en el header muestra `companyName` + `companyId`
  (monoespaciado) para dejar visible la segregación.
- `DiagnosticoView`: nota "🔒 Sus documentos están aislados y cifrados. Ninguna otra
  empresa puede acceder a ellos."
- `RegistroView`: los eventos de acceso cruzado se muestran con ícono de escudo y
  estilo de advertencia (rojo), distinguibles del resto de acciones.

### Pruebas — `__tests__/multitenancy.test.ts` (Vitest)
Casos cubiertos:
1. Empresa A guarda un documento y puede leerlo con su propio contexto.
2. Empresa B intenta leer el documento de Empresa A (pasando el `companyId` de A como
   dueño del recurso) → `assertTenantAccess`/`repository.getDocument` lanza
   `TenantAccessError`.
3. El intento anterior queda registrado en `getSecurityAuditLog()` con
   `companyIdSolicitante = B` y `companyIdRecurso = A`.
4. `filterByTenant` nunca deja pasar registros de otra empresa aunque estén mezclados
   en una misma colección (simulación de fuga de datos si no se filtrara).
5. `buildCompanyId` es determinístico e insensible al formato del RUT
   (`12.345.678-9` y `123456789` producen el mismo `companyId`), evidenciando que no
   se puede falsificar con texto libre distinto.

### Dependencias
- Se agrega `vitest` como devDependency y script `"test": "vitest run"` (no existía
  ningún framework de pruebas en el proyecto).

## Fuera de alcance
- No se modifica `analyzer.ts` ni la lógica de detección de criterios.
- No se toca el flujo de login/validación de RUT/contraseña ya existente.
- No se usa `localStorage`; todo el estado sigue viviendo en memoria/React.
- No se generan páginas de documentación adicionales más allá de esta spec.

## Riesgos / decisiones abiertas
Ninguna — diseño aprobado por el usuario el 2026-07-08.
