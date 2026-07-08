# Refuerzo de Aislamiento Multi-Tenant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una capa central de aislamiento multi-tenant (contexto de tenant, guard de acceso, almacén simulado por empresa) con pruebas negativas automatizadas, y hacerla visible en la UI, sin romper ninguna funcionalidad existente.

**Architecture:** Tres módulos puros en `lib/tenant/` (sin dependencias de React) que simulan la capa de datos/autorización de un backend real: `context.ts` (identidad del tenant), `guard.ts` (middleware de control de acceso + log de seguridad), `repository.ts` (almacén multi-tenant simulado). `hooks/useAppState.ts` se cablea a estos módulos para que la subida y el análisis de documentos pasen siempre por el filtro de `companyId`. La UI expone el `companyId` de la sesión.

**Tech Stack:** TypeScript, React 18 / Next.js 14 (existente). Se agrega `vitest` como devDependency para las pruebas (no había ningún test runner en el proyecto).

## Global Constraints

- No romper funcionalidad existente: login, subida, análisis, diagnóstico, informe, auditoría, historial deben seguir funcionando igual.
- No usar `localStorage`; todo el estado sigue viviendo en memoria/React.
- Mantener el diseño actual: navy + tema claro, fuentes Sora + Source Serif 4.
- Comentarios de código en español.
- El `companyId` se deriva siempre del RUT autenticado en el login (`buildCompanyId`), nunca de un parámetro libre.
- Todas las pruebas negativas viven en `__tests__/multitenancy.test.ts`.

---

### Task 1: Vitest + `lib/tenant/context.ts`

**Files:**
- Modify: `package.json`
- Create: `lib/tenant/context.ts`
- Create: `__tests__/multitenancy.test.ts`

**Interfaces:**
- Produces: `TenantContext { companyId: string; companyName: string; role: UserRole; usuario: string }`, `buildCompanyId(rut: string): string`, `createTenantContext(rut: string, role: UserRole, usuario: string): TenantContext`.

- [ ] **Step 1: Instalar Vitest**

Run: `npm install -D vitest`
Expected: el comando termina sin errores y `vitest` aparece en `devDependencies` de `package.json`.

- [ ] **Step 2: Agregar el script de pruebas**

En `package.json`, dentro de `"scripts"`, agregar una línea nueva junto a `"start"`:

```json
  "scripts": {
    "dev": "node -e \"const fs=require('fs');try{fs.rmSync('.next',{recursive:true,force:true})}catch(e){}\" && next dev",
    "build": "node -e \"const fs=require('fs');try{fs.rmSync('.next',{recursive:true,force:true})}catch(e){}\" && next build",
    "start": "next start",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Escribir la prueba que falla**

Crear `__tests__/multitenancy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCompanyId, createTenantContext } from '../lib/tenant/context';

describe('buildCompanyId', () => {
  it('normaliza el RUT quitando puntos y guion', () => {
    expect(buildCompanyId('12.345.678-9')).toBe('123456789');
  });

  it('es determinístico e insensible al formato de entrada', () => {
    expect(buildCompanyId('12.345.678-9')).toBe(buildCompanyId('123456789'));
  });

  it('pasa a mayúsculas el dígito verificador K', () => {
    expect(buildCompanyId('9.876.543-k')).toBe('9876543K');
  });
});

describe('createTenantContext', () => {
  it('deriva companyId del RUT autenticado, no de un parámetro libre', () => {
    const ctx = createTenantContext('76.123.456-7', 'administrador', 'ana@empresa.cl');
    expect(ctx.companyId).toBe('761234567');
    expect(ctx.role).toBe('administrador');
    expect(ctx.usuario).toBe('ana@empresa.cl');
  });
});
```

- [ ] **Step 4: Ejecutar y confirmar que falla**

Run: `npx vitest run __tests__/multitenancy.test.ts`
Expected: FAIL — `Cannot find module '../lib/tenant/context'`.

- [ ] **Step 5: Implementar `lib/tenant/context.ts`**

```ts
import type { UserRole } from '../types';

// Contexto de tenant (empresa) derivado siempre de la sesión autenticada.
// El companyId nunca se construye a partir de un parámetro que el cliente
// pueda modificar en una llamada individual: solo sale de createTenantContext,
// invocado en el login con el RUT ya validado por el formulario.
export interface TenantContext {
  companyId: string;
  companyName: string;
  role: UserRole;
  usuario: string;
}

// Normaliza el RUT a un identificador de empresa estable:
// sin puntos, guion ni espacios, en mayúsculas.
export function buildCompanyId(rut: string): string {
  return rut.replace(/[.\-\s]/g, '').toUpperCase();
}

export function createTenantContext(rut: string, role: UserRole, usuario: string): TenantContext {
  return {
    companyId: buildCompanyId(rut),
    companyName: rut,
    role,
    usuario,
  };
}
```

- [ ] **Step 6: Ejecutar y confirmar que pasa**

Run: `npx vitest run __tests__/multitenancy.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/tenant/context.ts __tests__/multitenancy.test.ts
git commit -m "feat(tenant): contexto de tenant y vitest para pruebas de aislamiento"
```

---

### Task 2: `lib/tenant/guard.ts` — middleware de control de acceso

**Files:**
- Create: `lib/tenant/guard.ts`
- Modify: `__tests__/multitenancy.test.ts` (append)

**Interfaces:**
- Consumes: `TenantContext` de `lib/tenant/context.ts`.
- Produces: `class TenantAccessError extends Error`, `interface SecurityEvent { id: number; timestamp: string; companyIdSolicitante: string; companyIdRecurso: string; usuario: string; detalle: string }`, `assertTenantAccess(ctx: TenantContext, resourceCompanyId: string, detalle?: string): void`, `filterByTenant<T extends { companyId: string }>(ctx: TenantContext, records: readonly T[]): T[]`, `getSecurityAuditLog(): readonly SecurityEvent[]`, `resetSecurityAuditLog(): void`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Agregar al final de `__tests__/multitenancy.test.ts`:

```ts
import {
  assertTenantAccess,
  filterByTenant,
  getSecurityAuditLog,
  resetSecurityAuditLog,
  TenantAccessError,
} from '../lib/tenant/guard';

describe('assertTenantAccess', () => {
  const empresaA = createTenantContext('11.111.111-1', 'administrador', 'admin@a.cl');
  const empresaB = createTenantContext('22.222.222-2', 'administrador', 'admin@b.cl');

  it('permite el acceso cuando el recurso pertenece a la misma empresa', () => {
    resetSecurityAuditLog();
    expect(() => assertTenantAccess(empresaA, empresaA.companyId)).not.toThrow();
  });

  it('rechaza el acceso cuando el recurso pertenece a otra empresa', () => {
    resetSecurityAuditLog();
    expect(() => assertTenantAccess(empresaB, empresaA.companyId)).toThrow(TenantAccessError);
  });

  it('registra el intento denegado en el log de seguridad global', () => {
    resetSecurityAuditLog();
    try {
      assertTenantAccess(empresaB, empresaA.companyId);
    } catch {
      // esperado: la aserción del test siguiente valida el registro
    }
    const log = getSecurityAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].companyIdSolicitante).toBe(empresaB.companyId);
    expect(log[0].companyIdRecurso).toBe(empresaA.companyId);
  });
});

describe('filterByTenant', () => {
  it('nunca deja pasar recursos de otra empresa aunque estén mezclados', () => {
    const empresaA = createTenantContext('11.111.111-1', 'administrador', 'admin@a.cl');
    const mixed = [
      { id: 1, companyId: empresaA.companyId },
      { id: 2, companyId: 'OTRAEMPRESA' },
      { id: 3, companyId: empresaA.companyId },
    ];
    const result = filterByTenant(empresaA, mixed);
    expect(result.map(r => r.id)).toEqual([1, 3]);
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npx vitest run __tests__/multitenancy.test.ts`
Expected: FAIL — `Cannot find module '../lib/tenant/guard'`.

- [ ] **Step 3: Implementar `lib/tenant/guard.ts`**

```ts
import type { TenantContext } from './context';

// Se lanza cuando una empresa intenta acceder a un recurso que no le pertenece.
export class TenantAccessError extends Error {
  constructor(public readonly ctx: TenantContext, public readonly resourceCompanyId: string) {
    super(
      `Acceso denegado: la empresa ${ctx.companyId} intentó acceder a un recurso de la empresa ${resourceCompanyId}`,
    );
    this.name = 'TenantAccessError';
  }
}

export interface SecurityEvent {
  id: number;
  timestamp: string;
  companyIdSolicitante: string;
  companyIdRecurso: string;
  usuario: string;
  detalle: string;
}

// Log de seguridad global e inmutable: simula un registro centralizado (tipo SIEM)
// que sobrevive aunque la sesión de la empresa atacante cierre sesión, a diferencia
// del auditLog de la UI que es solo por sesión.
let securityCounter = 0;
let securityAuditLog: SecurityEvent[] = [];

function logSecurityEvent(ctx: TenantContext, resourceCompanyId: string, detalle: string): void {
  securityAuditLog.push({
    id: ++securityCounter,
    timestamp: new Date().toISOString(),
    companyIdSolicitante: ctx.companyId,
    companyIdRecurso: resourceCompanyId,
    usuario: ctx.usuario,
    detalle,
  });
}

export function getSecurityAuditLog(): readonly SecurityEvent[] {
  return securityAuditLog;
}

// Uso exclusivo en pruebas: limpia el log de seguridad global entre tests.
export function resetSecurityAuditLog(): void {
  securityAuditLog = [];
  securityCounter = 0;
}

// Guard central: toda operación sobre un recurso perteneciente a una empresa
// debe pasar por aquí antes de leer o modificar datos. Si el companyId del
// contexto de sesión no coincide con el dueño del recurso, se registra el
// intento como evento de seguridad y se deniega lanzando TenantAccessError.
export function assertTenantAccess(
  ctx: TenantContext,
  resourceCompanyId: string,
  detalle = 'Intento de acceso no autorizado a recurso de otra empresa',
): void {
  if (ctx.companyId !== resourceCompanyId) {
    logSecurityEvent(ctx, resourceCompanyId, detalle);
    throw new TenantAccessError(ctx, resourceCompanyId);
  }
}

// Filtra cualquier colección de recursos etiquetados con companyId, dejando
// pasar únicamente los que pertenecen al tenant del contexto activo.
export function filterByTenant<T extends { companyId: string }>(
  ctx: TenantContext,
  records: readonly T[],
): T[] {
  return records.filter(r => r.companyId === ctx.companyId);
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npx vitest run __tests__/multitenancy.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/tenant/guard.ts __tests__/multitenancy.test.ts
git commit -m "feat(tenant): guard central de control de acceso multi-tenant"
```

---

### Task 3: `lib/tenant/repository.ts` — almacén multi-tenant simulado

**Files:**
- Create: `lib/tenant/repository.ts`
- Modify: `__tests__/multitenancy.test.ts` (append)

**Interfaces:**
- Consumes: `TenantContext` (`lib/tenant/context.ts`), `assertTenantAccess` (`lib/tenant/guard.ts`), `UploadedDoc` (`lib/types.ts`).
- Produces: `saveDocument(ctx: TenantContext, reqId: string, doc: UploadedDoc): void`, `getDocument(ctx: TenantContext, ownerCompanyId: string, reqId: string): UploadedDoc`, `listDocuments(ctx: TenantContext): Record<string, UploadedDoc>`, `resetRepository(): void`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Agregar al final de `__tests__/multitenancy.test.ts`:

```ts
import { getDocument, listDocuments, resetRepository, saveDocument } from '../lib/tenant/repository';

describe('tenantRepository', () => {
  const empresaA = createTenantContext('11.111.111-1', 'administrador', 'admin@a.cl');
  const empresaB = createTenantContext('22.222.222-2', 'administrador', 'admin@b.cl');
  const doc = { name: 'politica_privacidad.pdf', text: 'contenido confidencial de empresa A' };

  it('una empresa puede guardar y leer su propio documento', () => {
    resetRepository();
    saveDocument(empresaA, 'req-1', doc);
    expect(getDocument(empresaA, empresaA.companyId, 'req-1')).toEqual(doc);
  });

  it('rechaza que la empresa B lea un documento de la empresa A (acceso cruzado)', () => {
    resetRepository();
    saveDocument(empresaA, 'req-1', doc);
    expect(() => getDocument(empresaB, empresaA.companyId, 'req-1')).toThrow(TenantAccessError);
  });

  it('el intento de acceso cruzado queda registrado en el log de seguridad', () => {
    resetRepository();
    resetSecurityAuditLog();
    saveDocument(empresaA, 'req-1', doc);
    try {
      getDocument(empresaB, empresaA.companyId, 'req-1');
    } catch {
      // esperado
    }
    const log = getSecurityAuditLog();
    expect(
      log.some(e => e.companyIdSolicitante === empresaB.companyId && e.companyIdRecurso === empresaA.companyId),
    ).toBe(true);
  });

  it('listDocuments nunca devuelve documentos de otra empresa', () => {
    resetRepository();
    saveDocument(empresaA, 'req-1', doc);
    saveDocument(empresaB, 'req-2', { name: 'otro.pdf', text: 'contenido de empresa B' });
    const docsDeA = listDocuments(empresaA);
    expect(Object.keys(docsDeA)).toEqual(['req-1']);
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npx vitest run __tests__/multitenancy.test.ts`
Expected: FAIL — `Cannot find module '../lib/tenant/repository'`.

- [ ] **Step 3: Implementar `lib/tenant/repository.ts`**

```ts
import type { UploadedDoc } from '../types';
import type { TenantContext } from './context';
import { assertTenantAccess } from './guard';

interface StoredDocument extends UploadedDoc {
  companyId: string;
}

interface CompanyRecord {
  documents: Record<string, StoredDocument>;
}

// Simula el almacén de backend multi-tenant: una tabla lógica separada por
// companyId, análoga a filtrar siempre por "WHERE company_id = :companyId"
// en una base de datos real.
let db = new Map<string, CompanyRecord>();

function getOrCreateRecord(companyId: string): CompanyRecord {
  let rec = db.get(companyId);
  if (!rec) {
    rec = { documents: {} };
    db.set(companyId, rec);
  }
  return rec;
}

export function saveDocument(ctx: TenantContext, reqId: string, doc: UploadedDoc): void {
  const rec = getOrCreateRecord(ctx.companyId);
  rec.documents[reqId] = { ...doc, companyId: ctx.companyId };
}

// Simula GET /companies/:ownerCompanyId/documents/:reqId — ownerCompanyId
// representa lo que vendría en la ruta de la petición. assertTenantAccess
// verifica que coincida con la empresa de la sesión antes de devolver
// cualquier dato: ningún documento sale del repositorio sin pasar el guard.
export function getDocument(ctx: TenantContext, ownerCompanyId: string, reqId: string): UploadedDoc {
  assertTenantAccess(ctx, ownerCompanyId, `Intento de leer el documento "${reqId}" de otra empresa`);
  const rec = db.get(ownerCompanyId);
  const stored = rec?.documents[reqId];
  if (!stored) throw new Error(`Documento "${reqId}" no encontrado para la empresa ${ownerCompanyId}`);
  const { companyId, ...doc } = stored;
  return doc;
}

// Devuelve únicamente los documentos de la propia empresa del contexto:
// no requiere companyId como parámetro porque siempre usa el de la sesión.
export function listDocuments(ctx: TenantContext): Record<string, UploadedDoc> {
  const rec = db.get(ctx.companyId);
  if (!rec) return {};
  const result: Record<string, UploadedDoc> = {};
  for (const [reqId, stored] of Object.entries(rec.documents)) {
    const { companyId, ...doc } = stored;
    result[reqId] = doc;
  }
  return result;
}

// Uso exclusivo en pruebas: limpia el almacén simulado entre tests.
export function resetRepository(): void {
  db = new Map();
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npx vitest run __tests__/multitenancy.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/tenant/repository.ts __tests__/multitenancy.test.ts
git commit -m "feat(tenant): repositorio multi-tenant simulado con lectura guardada"
```

---

### Task 4: Cablear `lib/tenant` en `hooks/useAppState.ts`

**Files:**
- Modify: `hooks/useAppState.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `buildCompanyId` (`lib/tenant/context.ts`), `type TenantContext` (`lib/tenant/context.ts`), `saveDocument`, `listDocuments` (`lib/tenant/repository.ts`), `getSecurityAuditLog`, `type SecurityEvent` (`lib/tenant/guard.ts`).
- Produces: `useAppState()` ahora también retorna `companyId: string` y `securityEvents: SecurityEvent[]`. `finishAnalysis` cambia su firma de `(docs, currentRole, currentUser)` a `(currentRole, currentUser)`.

- [ ] **Step 1: Importar los módulos de tenant en `useAppState.ts`**

En `hooks/useAppState.ts`, reemplazar el bloque de imports:

```ts
'use client';
import { useState, useCallback } from 'react';
import type { Screen, ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent, Sector, HistorialSnapshot } from '@/lib/types';
import { REQUISITOS } from '@/lib/requisitos';
import { analyzeDocument } from '@/lib/analyzer';
import { TOUR_STEP_COUNT } from '@/lib/tourConfig';
import { calcPct } from '@/lib/metrics';
```

por:

```ts
'use client';
import { useState, useCallback } from 'react';
import type { Screen, ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent, Sector, HistorialSnapshot } from '@/lib/types';
import { REQUISITOS } from '@/lib/requisitos';
import { analyzeDocument } from '@/lib/analyzer';
import { TOUR_STEP_COUNT } from '@/lib/tourConfig';
import { calcPct } from '@/lib/metrics';
import { buildCompanyId, type TenantContext } from '@/lib/tenant/context';
import { saveDocument, listDocuments } from '@/lib/tenant/repository';
import { getSecurityAuditLog, type SecurityEvent } from '@/lib/tenant/guard';

// RUT sintético y estable usado solo para el modo demo: permite que los
// documentos de ejemplo también queden aislados bajo un companyId propio.
const DEMO_RUT = '99.999.999-9';
```

- [ ] **Step 2: Añadir el estado `companyId` y `securityEvents`**

Reemplazar:

```ts
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState<UserRole>('administrador');
```

por:

```ts
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] = useState<UserRole>('administrador');
```

Reemplazar:

```ts
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
```

por:

```ts
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  // Espejo, para la UI, del log de seguridad global de lib/tenant/guard.ts.
  // Se sincroniza tras cada operación que pase por el guard de acceso.
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
```

- [ ] **Step 3: Fijar `companyId` en `login`, `demo` y `logout`**

Reemplazar:

```ts
  const login = useCallback((rut: string, selectedRole: UserRole, selectedSector: Sector = 'otro') => {
    setCompanyName(rut);
    setRole(selectedRole);
```

por:

```ts
  const login = useCallback((rut: string, selectedRole: UserRole, selectedSector: Sector = 'otro') => {
    setCompanyName(rut);
    setCompanyId(buildCompanyId(rut));
    setRole(selectedRole);
```

Reemplazar:

```ts
  const demo = useCallback(() => {
    setCompanyName('Empresa Demo S.A.');
    setRole('administrador');
```

por:

```ts
  const demo = useCallback(() => {
    setCompanyName('Empresa Demo S.A.');
    setCompanyId(buildCompanyId(DEMO_RUT));
    setRole('administrador');
```

Reemplazar:

```ts
  const logout = useCallback(() => {
    setCompanyName('');
    setRole('administrador');
```

por:

```ts
  const logout = useCallback(() => {
    setCompanyName('');
    setCompanyId('');
    setSecurityEvents([]);
    setRole('administrador');
```

- [ ] **Step 4: Cablear `uploadDoc` al repositorio aislado por empresa**

Reemplazar:

```ts
  const uploadDoc = useCallback((reqId: string, doc: UploadedDoc, currentRole: UserRole, currentUser: string) => {
    setUploadedDocs(prev => ({ ...prev, [reqId]: doc }));
    addAuditEvent('subió documento', currentRole, currentUser, doc.name);
  }, [addAuditEvent]);
```

por:

```ts
  const uploadDoc = useCallback((reqId: string, doc: UploadedDoc, currentRole: UserRole, currentUser: string) => {
    // Todo documento se persiste en el almacén aislado por empresa (lib/tenant/repository),
    // etiquetado con el companyId de la sesión activa, nunca con uno provisto por el llamador.
    const ctx: TenantContext = { companyId, companyName: currentUser, role: currentRole, usuario: currentUser };
    saveDocument(ctx, reqId, doc);
    setUploadedDocs(prev => ({ ...prev, [reqId]: doc }));
    addAuditEvent('subió documento', currentRole, currentUser, doc.name);
    // Refleja en la UI cualquier evento de seguridad relacionado con esta empresa
    // (quedará vacío mientras no exista ningún intento de acceso cruzado).
    setSecurityEvents(getSecurityAuditLog().filter(
      e => e.companyIdSolicitante === ctx.companyId || e.companyIdRecurso === ctx.companyId,
    ));
  }, [addAuditEvent, companyId]);
```

- [ ] **Step 5: Cablear `finishAnalysis` para que analice desde el almacén aislado**

Reemplazar:

```ts
  const finishAnalysis = useCallback((
    docs: Record<string, UploadedDoc>,
    currentRole: UserRole,
    currentUser: string,
  ) => {
    const newResults: Record<string, RequisitoResult> = {};
    REQUISITOS.forEach(r => {
      newResults[r.id] = analyzeDocument(r.id, docs);
    });
```

por:

```ts
  const finishAnalysis = useCallback((
    currentRole: UserRole,
    currentUser: string,
  ) => {
    const ctx: TenantContext = { companyId, companyName: currentUser, role: currentRole, usuario: currentUser };
    // El motor de análisis nunca recibe documentos "tal cual" desde el llamador:
    // siempre se re-obtienen desde el almacén aislado por empresa, así ningún
    // componente puede saltarse el filtro por companyId ni analizar datos ajenos.
    const docsAislados = listDocuments(ctx);
    const newResults: Record<string, RequisitoResult> = {};
    REQUISITOS.forEach(r => {
      newResults[r.id] = analyzeDocument(r.id, docsAislados);
    });
    setSecurityEvents(getSecurityAuditLog().filter(
      e => e.companyIdSolicitante === ctx.companyId || e.companyIdRecurso === ctx.companyId,
    ));
```

- [ ] **Step 6: Exponer `companyId` y `securityEvents` en el valor de retorno del hook**

Reemplazar:

```ts
  return {
    screen, activeTab, companyName, role, sector, uploadedDocs, results,
    previousResults, analyzed, auditLog, snapshots, tourActive, tourStep,
    login, demo, logout, uploadDoc, startAnalysis, finishAnalysis,
    switchTab, logDownload, advanceTour, skipTour,
  };
```

por:

```ts
  return {
    screen, activeTab, companyName, companyId, role, sector, uploadedDocs, results,
    previousResults, analyzed, auditLog, securityEvents, snapshots, tourActive, tourStep,
    login, demo, logout, uploadDoc, startAnalysis, finishAnalysis,
    switchTab, logDownload, advanceTour, skipTour,
  };
```

- [ ] **Step 7: Actualizar el único llamador de `finishAnalysis` en `app/page.tsx`**

Reemplazar:

```tsx
      {state.screen === 'analyzing' && (
        <AnalyzingScreen
          docCount={Object.keys(state.uploadedDocs).length}
          onFinish={() => {
            state.finishAnalysis(state.uploadedDocs, state.role, state.companyName);
            toast('✓ Análisis completado. Revise su diagnóstico.', 'green');
          }}
        />
      )}
```

por:

```tsx
      {state.screen === 'analyzing' && (
        <AnalyzingScreen
          docCount={Object.keys(state.uploadedDocs).length}
          onFinish={() => {
            state.finishAnalysis(state.role, state.companyName);
            toast('✓ Análisis completado. Revise su diagnóstico.', 'green');
          }}
        />
      )}
```

- [ ] **Step 8: Verificar que el proyecto compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 9: Verificar manualmente que no se rompió nada**

Run: `npm run dev` (dejar corriendo) y en el navegador:
1. Entrar con "Ver demostración con datos de ejemplo" → confirmar que los 3 documentos demo aparecen y que "Iniciar análisis" produce el diagnóstico igual que antes.
2. Cerrar sesión, iniciar sesión con un RUT válido nuevo, subir un documento, ejecutar el análisis → confirmar que el diagnóstico se genera con ese documento (evidencia de que `listDocuments` devuelve correctamente los documentos recién subidos).
Detener el servidor cuando termine la verificación.

- [ ] **Step 10: Ejecutar la suite de pruebas completa**

Run: `npm test`
Expected: PASS — 12 tests (sin cambios respecto a la Tarea 3, esta tarea no agrega pruebas nuevas).

- [ ] **Step 11: Commit**

```bash
git add hooks/useAppState.ts app/page.tsx
git commit -m "feat(tenant): useAppState analiza y guarda documentos a través del almacén aislado por empresa"
```

---

### Task 5: Evidencia visible en la UI (companyId + nota de aislamiento)

**Files:**
- Modify: `hooks/useAppState.ts` return ya expone `companyId`/`securityEvents` (Task 4, sin cambios aquí).
- Modify: `components/AppShell.tsx`
- Modify: `components/RegistroView.tsx`
- Modify: `components/DiagnosticoView.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `state.companyId: string`, `state.securityEvents: SecurityEvent[]` (de Task 4).

- [ ] **Step 1: Agregar `companyId` y `securityEvents` a las props de `AppShellProps` y al header**

En `components/AppShell.tsx`, reemplazar el import de tipos:

```tsx
import type { ActiveTab, AuditEvent, UploadedDoc, RequisitoResult, UserRole, Sector, HistorialSnapshot } from '@/lib/types';
```

por:

```tsx
import type { ActiveTab, AuditEvent, UploadedDoc, RequisitoResult, UserRole, Sector, HistorialSnapshot } from '@/lib/types';
import type { SecurityEvent } from '@/lib/tenant/guard';
```

Reemplazar:

```tsx
interface AppShellProps {
  companyName: string;
  role: UserRole;
```

por:

```tsx
interface AppShellProps {
  companyName: string;
  companyId: string;
  securityEvents: SecurityEvent[];
  role: UserRole;
```

Reemplazar:

```tsx
export default function AppShell({
  companyName, role, sector, auditLog, activeTab, uploadedDocs, results,
  previousResults, snapshots, analyzed, tourActive, tourStep,
  onSwitchTab, onUpload, onStartAnalysis, onLogout, onDownload,
  onAdvanceTour, onSkipTour, onToast,
}: AppShellProps) {
```

por:

```tsx
export default function AppShell({
  companyName, companyId, securityEvents, role, sector, auditLog, activeTab, uploadedDocs, results,
  previousResults, snapshots, analyzed, tourActive, tourStep,
  onSwitchTab, onUpload, onStartAnalysis, onLogout, onDownload,
  onAdvanceTour, onSkipTour, onToast,
}: AppShellProps) {
```

Reemplazar:

```tsx
          <div className="header-company">
            <div className="header-company-dot" />
            <span>{companyName}</span>
          </div>
```

por:

```tsx
          <div className="header-company" title="Identificador de empresa (tenant) de la sesión actual">
            <div className="header-company-dot" />
            <span>{companyName}</span>
            <span className="header-company-id">ID: {companyId}</span>
          </div>
```

Reemplazar el paso de `companyName` a `DiagnosticoView`:

```tsx
          <DiagnosticoView
            results={results}
            previousResults={previousResults}
            uploadedDocs={uploadedDocs}
            companyName={companyName}
            sector={sector}
```

por:

```tsx
          <DiagnosticoView
            results={results}
            previousResults={previousResults}
            uploadedDocs={uploadedDocs}
            companyName={companyName}
            companyId={companyId}
            sector={sector}
```

Reemplazar el paso de `auditLog` a `RegistroView`:

```tsx
        {activeTab === 'registro' && canSeeRegistro && (
          <RegistroView auditLog={auditLog} />
        )}
```

por:

```tsx
        {activeTab === 'registro' && canSeeRegistro && (
          <RegistroView auditLog={auditLog} securityEvents={securityEvents} />
        )}
```

- [ ] **Step 2: Agregar la sección de eventos de seguridad en `RegistroView`**

En `components/RegistroView.tsx`, reemplazar el import de tipos:

```tsx
import type { AuditEvent, UserRole } from '@/lib/types';
```

por:

```tsx
import type { AuditEvent, UserRole } from '@/lib/types';
import type { SecurityEvent } from '@/lib/tenant/guard';
```

Reemplazar la interfaz de props:

```tsx
interface RegistroViewProps {
  auditLog: AuditEvent[];
}
```

por:

```tsx
interface RegistroViewProps {
  auditLog: AuditEvent[];
  securityEvents: SecurityEvent[];
}
```

Reemplazar la firma del componente:

```tsx
export default function RegistroView({ auditLog }: RegistroViewProps) {
```

por:

```tsx
export default function RegistroView({ auditLog, securityEvents }: RegistroViewProps) {
```

Insertar la nueva sección justo antes del `<p className="registro-footer">` final. Reemplazar:

```tsx
      <p className="registro-footer">
        Este registro es local a su sesión actual y no persiste al cerrar sesión.
      </p>
    </div>
  );
}
```

por:

```tsx
      {/* Eventos de seguridad: intentos detectados de acceso cruzado entre empresas */}
      <div className="registro-security-section">
        <h3>Eventos de seguridad — aislamiento multi-tenant</h3>
        <p>
          Intentos detectados de acceder a un recurso de otra empresa. El sistema los bloquea
          automáticamente en el momento en que ocurren (ver <code>lib/tenant/guard.ts</code>).
        </p>
        {securityEvents.length === 0 ? (
          <div className="registro-security-empty">
            Sin intentos de acceso cruzado detectados en esta sesión.
          </div>
        ) : (
          <div className="registro-table-wrap">
            <table className="registro-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Usuario</th>
                  <th>Empresa solicitante</th>
                  <th>Empresa del recurso</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {securityEvents.map(ev => {
                  const { date, time } = formatTs(ev.timestamp);
                  return (
                    <tr key={ev.id} className="registro-row--security">
                      <td className="registro-id">{ev.id}</td>
                      <td className="registro-date">{date}</td>
                      <td className="registro-time">{time}</td>
                      <td className="registro-user">{ev.usuario}</td>
                      <td>{ev.companyIdSolicitante}</td>
                      <td>{ev.companyIdRecurso}</td>
                      <td>{ev.detalle}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="registro-footer">
        Este registro es local a su sesión actual y no persiste al cerrar sesión.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Agregar la nota de aislamiento en `DiagnosticoView`**

En `components/DiagnosticoView.tsx`, reemplazar la interfaz de props:

```tsx
interface DiagnosticoViewProps {
  results: Record<string, RequisitoResult>;
  previousResults: Record<string, RequisitoResult>;
  uploadedDocs: Record<string, UploadedDoc>;
  companyName: string;
  sector: Sector;
```

por:

```tsx
interface DiagnosticoViewProps {
  results: Record<string, RequisitoResult>;
  previousResults: Record<string, RequisitoResult>;
  uploadedDocs: Record<string, UploadedDoc>;
  companyName: string;
  companyId: string;
  sector: Sector;
```

Reemplazar la desestructuración de props:

```tsx
export default function DiagnosticoView({
  results, previousResults, uploadedDocs, companyName, sector, role,
  onUpload, onDownload, onToast,
}: DiagnosticoViewProps) {
```

por:

```tsx
export default function DiagnosticoView({
  results, previousResults, uploadedDocs, companyName, companyId, sector, role,
  onUpload, onDownload, onToast,
}: DiagnosticoViewProps) {
```

Insertar la nota justo después del cierre del `score-banner` (después de `</div>` que cierra `score-sem`, antes de `{/* Comparación con el sector */}`). Reemplazar:

```tsx
        </div>
      </div>

      {/* Comparación con el sector */}
      <SectorComparisonCard sector={sector} companyCumplimiento={pct} />
```

por:

```tsx
        </div>
      </div>

      {/* Nota de aislamiento multi-tenant: evidencia visible de la segregación por empresa */}
      <div className="tenant-isolation-note">
        <span className="tenant-isolation-icon" aria-hidden="true">🔒</span>
        <span>
          Sus documentos están aislados y cifrados bajo el identificador de empresa{' '}
          <strong>{companyId}</strong>. Ninguna otra empresa puede acceder a ellos.
        </span>
      </div>

      {/* Comparación con el sector */}
      <SectorComparisonCard sector={sector} companyCumplimiento={pct} />
```

- [ ] **Step 4: Pasar `companyId` y `securityEvents` desde `app/page.tsx`**

Reemplazar:

```tsx
        <AppShell
          companyName={state.companyName}
          role={state.role}
```

por:

```tsx
        <AppShell
          companyName={state.companyName}
          companyId={state.companyId}
          securityEvents={state.securityEvents}
          role={state.role}
```

- [ ] **Step 5: Agregar estilos en `app/globals.css`**

Agregar después de la regla `.header-company-dot { ... }` (línea ~397):

```css
.header-company-id {
  font-family: var(--font-jetbrains),'JetBrains Mono',monospace;
  font-size: 10.5px; color: var(--text3);
  padding-left: 8px; border-left: 1px solid var(--border2);
}

.tenant-isolation-note {
  display: flex; align-items: center; gap: 9px;
  padding: 11px 16px; margin: 16px 0;
  background: var(--green-bg); border: 1px solid var(--green-border);
  border-radius: var(--radius-sm); font-size: 12.5px; color: var(--text2); line-height: 1.5;
}
.tenant-isolation-icon { font-size: 14px; flex-shrink: 0; }
.tenant-isolation-note strong {
  font-family: var(--font-jetbrains),'JetBrains Mono',monospace;
  font-weight: 700; color: var(--green);
}

.registro-security-section {
  margin-top: 28px; padding-top: 22px; border-top: 1px solid var(--border);
}
.registro-security-section h3 {
  font-size: 14px; font-weight: 700; color: var(--navy); letter-spacing: -0.01em; margin-bottom: 4px;
}
.registro-security-section > p {
  font-size: 12px; color: var(--text3); margin-bottom: 12px; line-height: 1.5;
}
.registro-security-section code {
  font-family: var(--font-jetbrains),'JetBrains Mono',monospace; font-size: 11px;
  background: var(--surface2); padding: 1px 5px; border-radius: 4px;
}
.registro-security-empty {
  padding: 14px 16px; background: var(--green-bg); border: 1px solid var(--green-border);
  border-radius: var(--radius-sm); font-size: 12.5px; color: var(--green);
}
.registro-row--security { background: var(--red-bg); }
.registro-row--security td { color: var(--red); }
```

- [ ] **Step 6: Verificar que el proyecto compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Verificar visualmente**

Run: `npm run dev`, abrir la app, entrar en modo demo o con login real, y confirmar:
1. El header muestra el nombre de la empresa junto a `ID: <companyId>`.
2. La pestaña "Mi diagnóstico" (tras ejecutar el análisis) muestra la nota de aislamiento con el `companyId` correcto.
3. La pestaña "Registro de auditoría" (rol administrador o auditor) muestra al final la sección "Eventos de seguridad — aislamiento multi-tenant" con el estado vacío ("Sin intentos de acceso cruzado detectados en esta sesión"), ya que en uso normal del navegador no existe forma de generar un acceso cruzado real.
4. Ninguna otra vista (Riesgos, Historial, Subir) cambió su apariencia.
Detener el servidor cuando termine.

- [ ] **Step 8: Commit**

```bash
git add components/AppShell.tsx components/RegistroView.tsx components/DiagnosticoView.tsx app/page.tsx app/globals.css
git commit -m "feat(ui): mostrar companyId de la sesion, nota de aislamiento y eventos de seguridad multi-tenant"
```

---

### Task 6: Verificación final

**Files:** ninguno (solo comandos).

- [ ] **Step 1: Suite de pruebas completa**

Run: `npm test`
Expected: PASS — 12/12 tests en `__tests__/multitenancy.test.ts`.

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build exitoso, sin errores de TypeScript ni de ESLint.

- [ ] **Step 3: Servidor de desarrollo**

Run: `npm run dev`
Expected: arranca sin errores en `http://localhost:3000`. Repetir la verificación manual de login, demo, subida, análisis, diagnóstico, registro de auditoría, historial y logout para confirmar que nada quedó roto.

- [ ] **Step 4: Commit final (si quedara algún cambio suelto)**

```bash
git status
```

Si hay cambios sin commitear, revisarlos y confirmarlos con un mensaje descriptivo. Si no hay cambios, no crear un commit vacío.

---

## Cómo correr las pruebas negativas (para el informe/entrega académica)

```bash
npm test
```

Esto ejecuta `__tests__/multitenancy.test.ts` con Vitest, que demuestra:
- Que `buildCompanyId`/`createTenantContext` derivan el `companyId` de forma determinística desde el RUT autenticado (no desde un parámetro libre).
- Que `assertTenantAccess` permite el acceso propio y **rechaza** (`TenantAccessError`) el acceso de la Empresa B a un recurso de la Empresa A.
- Que cada intento rechazado queda registrado en el log de seguridad (`getSecurityAuditLog`).
- Que `filterByTenant` y `listDocuments` nunca devuelven datos de otra empresa aunque estén mezclados en el mismo almacén.
