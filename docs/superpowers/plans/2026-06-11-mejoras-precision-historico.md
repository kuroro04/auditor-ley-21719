# Mejoras de Precisión e Historial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer el diccionario de sinónimos a un archivo separado, mostrar indicadores visuales de confianza en el diagnóstico, y agregar una pestaña "Historial" con gráfico SVG de evolución del cumplimiento.

**Architecture:** El motor de análisis ya implementa detección de sinónimos y calcula `confianza`; solo se reorganiza el diccionario a `lib/sinonimos.ts` y se expone la confianza en la UI. El historial se guarda como array de snapshots en estado React (`useAppState`) y se renderiza en un componente nuevo con SVG puro (sin dependencias externas).

**Tech Stack:** Next.js 14, React 18, TypeScript 5, CSS custom properties, SVG nativo.

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `lib/sinonimos.ts` | Crear | Diccionario de sinónimos por requisito/criterio |
| `lib/types.ts` | Modificar | Añadir `HistorialSnapshot`; `'historial'` en `ActiveTab` |
| `lib/requisitos.ts` | Modificar | Importar sinónimos desde `sinonimos.ts` |
| `hooks/useAppState.ts` | Modificar | Estado `snapshots`, captura en `finishAnalysis`, reset en `logout` |
| `components/DiagnosticoView.tsx` | Modificar | Indicadores de confianza + nota explicativa |
| `components/HistorialView.tsx` | Crear | Vista completa con SVG chart, tabla y tendencia |
| `components/AppShell.tsx` | Modificar | Tab Historial + prop `snapshots` |
| `app/page.tsx` | Modificar | Pasar `snapshots` a AppShell |
| `app/globals.css` | Modificar | Estilos para confianza y vista historial |

---

## Task 1: Crear lib/sinonimos.ts

**Files:**
- Create: `lib/sinonimos.ts`

- [ ] **Step 1: Crear el archivo con el diccionario completo**

Crear `lib/sinonimos.ts` con el siguiente contenido exacto:

```ts
// Diccionario de sinónimos por requisito y criterio.
// Clave externa = ID del requisito en REQUISITOS.
// Clave interna = nombre exacto del criterio (debe coincidir con criterio.name).
// Edite aquí para ampliar la detección sin tocar el motor ni los requisitos.

export const SINONIMOS: Record<string, Record<string, string[]>> = {

  politica_privacidad: {
    'Identidad y contacto del responsable de datos': [
      'controlador', 'data controller', 'encargado del tratamiento',
      'representante legal', 'titular del tratamiento', 'responsable del tratamiento',
    ],
    'Finalidad y propósito del tratamiento': [
      'motivo del tratamiento', 'uso de datos', 'razón del tratamiento',
      'para qué se usan los datos', 'objetivo del tratamiento',
    ],
    'Base legal (consentimiento / interés legítimo)': [
      'habilitación legal', 'fundamento jurídico', 'licitud',
      'título legal', 'base jurídica', 'legitimación',
    ],
    'Derechos ARCO del titular (acceso, rectificación...)': [
      'derechos del titular', 'portabilidad', 'supresión',
      'derecho al olvido', 'derecho de supresión',
    ],
    'Plazo de conservación de los datos': [
      'período de guarda', 'ciclo de vida', 'tiempo de almacenamiento',
      'período de retención', 'duración del tratamiento',
    ],
  },

  registro_actividades: {
    'Categorías de datos personales tratados': [
      'clases de datos', 'naturaleza de los datos', 'tipo de información',
      'datos de carácter personal', 'categorías de información',
    ],
    'Finalidad de cada actividad de tratamiento': [
      'motivo', 'objetivo del tratamiento', 'razón', 'propósito de uso',
    ],
    'Destinatarios y terceros receptores': [
      'cesionarios', 'subencargados', 'data processors',
      'partners', 'socios', 'receptores de datos',
    ],
    'Plazos de supresión o eliminación': [
      'borrado', 'destrucción', 'período de retención', 'tiempo de baja',
    ],
    'Medidas de seguridad aplicadas': [
      'protección', 'salvaguardas', 'controles técnicos',
      'ISO 27001', 'controles organizativos',
    ],
  },

  procedimiento_arco: {
    'Canal formal para recibir solicitudes': [
      'medio de contacto', 'buzón', 'mecanismo de solicitud', 'plataforma de atención',
    ],
    'Plazo de respuesta (máx. 30 días)': [
      'mes', 'término legal', 'lapso de respuesta', 'plazo hábil',
    ],
    'Verificación de identidad del solicitante': [
      'identificación', 'acreditación', 'comprobación', 'validación de identidad',
    ],
    'Proceso de rectificación y corrección': [
      'enmienda', 'actualización de datos', 'cambio de información', 'modificación del registro',
    ],
    'Proceso de supresión / cancelación': [
      'remoción', 'derecho al olvido', 'borrado definitivo', 'eliminación permanente',
    ],
  },

  contrato_encargado: {
    'Objeto y duración del tratamiento definidos': [
      'propósito del contrato', 'vigencia', 'período contractual', 'alcance del tratamiento',
    ],
    'Instrucciones documentadas del responsable': [
      'directivas', 'mandato', 'órdenes del responsable', 'indicaciones contractuales',
    ],
    'Obligaciones de confidencialidad': [
      'reserva', 'privacidad', 'cláusula de no divulgación', 'NDA', 'secreto profesional',
    ],
    'Cláusula de medidas de seguridad': [
      'controles técnicos', 'salvaguardas', 'seguridad de la información', 'medidas organizativas',
    ],
    'Condiciones de subcontratación': [
      'sub-procesador', 'proveedor externo', 'cadena de suministro', 'subencargado de datos',
    ],
    'Asistencia para solicitudes ARCO': [
      'apoyo', 'colaboración', 'asistencia al responsable', 'cooperación con el responsable',
    ],
    'Devolución o destrucción al término': [
      'restitución', 'eliminación al cierre', 'borrado final', 'disposición al término',
    ],
  },

  evaluacion_impacto: {
    'Descripción sistemática del tratamiento': [
      'análisis detallado', 'mapeo de datos', 'descripción del proceso de datos', 'inventario de tratamiento',
    ],
    'Evaluación de necesidad y proporcionalidad': [
      'pertinencia', 'adecuación', 'limitación del tratamiento', 'mínimo necesario',
    ],
    'Identificación de riesgos para titulares': [
      'amenazas', 'vulnerabilidades', 'análisis de riesgo', 'exposición a riesgos',
    ],
    'Medidas de mitigación de riesgos': [
      'reducción de riesgos', 'controles compensatorios', 'tratamiento del riesgo', 'plan de acción',
    ],
  },

  politica_retencion: {
    'Plazos definidos por categoría de dato': [
      'vigencia del dato', 'duración del almacenamiento', 'ciclo de vida del dato', 'período de conservación',
    ],
    'Proceso de revisión periódica': [
      'control periódico', 'evaluación regular', 'revisión programada', 'auditoría de datos',
    ],
    'Método de destrucción segura': [
      'trituración', 'supresión segura', 'sanitización', 'borrado certificado', 'eliminación irrecuperable',
    ],
    'Responsable del proceso de eliminación': [
      'delegado', 'persona designada', 'cargo responsable', 'encargado de la baja',
    ],
  },

  registro_rnpa: {
    'Certificado o comprobante de inscripción RNPA': [
      'certificado apdp', 'registro oficial', 'inscripción formal', 'número de registro', 'folio',
    ],
    'Inscripción vigente (no vencida)': [
      'activo', 'en vigor', 'no vencido', 'actualizado', 'al día',
    ],
  },

  plan_brechas: {
    'Procedimiento de detección de incidentes': [
      'vigilancia', 'supervisión', 'aviso', 'evento de seguridad', 'monitoreo continuo',
    ],
    'Protocolo de notificación en 72 horas': [
      'tres días', 'período de notificación', 'plazo legal de notificación', 'notificación inmediata',
    ],
    'Contenido mínimo de la notificación': [
      'información de la brecha', 'detalle del incidente', 'contenido obligatorio', 'elementos de la notificación',
    ],
    'Comunicación a titulares afectados': [
      'afectados', 'personas impactadas', 'aviso a los titulares', 'información a los interesados',
    ],
    'Registro histórico de incidentes': [
      'registro de eventos', 'trazabilidad', 'base de datos de incidentes', 'historial de seguridad',
    ],
  },

  consentimiento: {
    'Consentimiento libre, específico e informado': [
      'voluntario', 'expreso', 'explícito', 'sin ambigüedad', 'consentimiento válido',
    ],
    'Información sobre qué datos y para qué': [
      'información sobre el tratamiento', 'descripción de datos recopilados', 'detalle de finalidad',
    ],
    'Mecanismo de retiro del consentimiento': [
      'revocar autorización', 'desuscribir', 'rechazar el tratamiento', 'cancelar autorización',
    ],
    'Registro de fecha y forma de obtención': [
      'evidencia del consentimiento', 'prueba de aceptación', 'log de consentimiento', 'auditoría del consentimiento',
    ],
  },

  designacion_dpo: {
    'Identidad y datos de contacto del DPO': [
      'data protection officer', 'encargado de privacidad',
      'delegado de protección de datos', 'oficial de privacidad',
    ],
    'Funciones y responsabilidades definidas': [
      'rol del delegado', 'competencias del DPO', 'atribuciones', 'obligaciones del DPO',
    ],
    'Independencia y recursos asignados': [
      'autonomía', 'libre de conflictos de interés', 'imparcialidad', 'posición independiente',
    ],
    'Notificación a la APDP realizada': [
      'informado a la autoridad', 'declarado ante la APDP', 'reportado al regulador', 'comunicado a la agencia',
    ],
  },

};
```

- [ ] **Step 2: Verificar TypeScript del archivo nuevo**

```bash
npx tsc --noEmit lib/sinonimos.ts 2>&1 | head -20
```

Si no hay errores, continuar. Si hay errores de encoding (caracteres especiales), guardar con UTF-8.

- [ ] **Step 3: Commit**

```bash
git add lib/sinonimos.ts
git commit -m "feat: diccionario de sinónimos separado (lib/sinonimos.ts)"
```

---

## Task 2: Actualizar lib/types.ts

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Añadir `HistorialSnapshot` y expandir `ActiveTab`**

Aplicar dos cambios en `lib/types.ts`:

**Cambio A** — Reemplazar la línea con `ActiveTab`:
```ts
// Antes:
export type ActiveTab = 'subir' | 'diagnostico' | 'registro' | 'riesgos';

// Después:
export type ActiveTab = 'subir' | 'diagnostico' | 'registro' | 'riesgos' | 'historial';
```

**Cambio B** — Añadir `HistorialSnapshot` justo antes de la línea `export type Screen`:
```ts
export interface HistorialSnapshot {
  fecha: string;    // ISO 8601 — momento en que se ejecutó el análisis
  pct: number;      // porcentaje de cumplimiento global (0–100)
  green: number;    // cantidad de requisitos en estado verde
  yellow: number;   // cantidad de requisitos en estado amarillo
  red: number;      // cantidad de requisitos en estado rojo
}
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: los únicos errores deben ser sobre `snapshots` aún no declarado (se resuelve en Task 4). No deben haber errores de sintaxis.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: añadir HistorialSnapshot y tab historial a tipos"
```

---

## Task 3: Refactorizar lib/requisitos.ts

**Files:**
- Modify: `lib/requisitos.ts`

- [ ] **Step 1: Añadir import y helper al inicio del archivo**

Reemplazar la primera línea del archivo:
```ts
// Antes:
import type { Requisito } from './types';

// Después:
import type { Requisito } from './types';
import { SINONIMOS } from './sinonimos';

// Obtiene los sinónimos de un criterio desde el diccionario centralizado
const s = (reqId: string, criterioName: string): string[] =>
  SINONIMOS[reqId]?.[criterioName] ?? [];
```

- [ ] **Step 2: Reemplazar todos los arrays synonyms inline**

Para cada criterio en REQUISITOS, reemplazar el campo `synonyms: [...]` por la llamada al helper `s()`. La tabla completa de reemplazos:

**politica_privacidad:**
```ts
// criterio 'Identidad y contacto del responsable de datos'
synonyms: ['controlador','data controller','titular del tratamiento','representante legal'],
// → reemplazar con:
synonyms: s('politica_privacidad', 'Identidad y contacto del responsable de datos'),

// criterio 'Finalidad y propósito del tratamiento'
synonyms: ['motivo del tratamiento','uso de datos','razón del tratamiento'],
// → reemplazar con:
synonyms: s('politica_privacidad', 'Finalidad y propósito del tratamiento'),

// criterio 'Base legal (consentimiento / interés legítimo)'
synonyms: ['habilitación legal','fundamento jurídico','licitud','título legal'],
// → reemplazar con:
synonyms: s('politica_privacidad', 'Base legal (consentimiento / interés legítimo)'),

// criterio 'Derechos ARCO del titular (acceso, rectificación...)'
synonyms: ['derechos del titular','portabilidad','supresión','derecho al olvido'],
// → reemplazar con:
synonyms: s('politica_privacidad', 'Derechos ARCO del titular (acceso, rectificación...)'),

// criterio 'Plazo de conservación de los datos'
synonyms: ['período de guarda','ciclo de vida','tiempo de almacenamiento'],
// → reemplazar con:
synonyms: s('politica_privacidad', 'Plazo de conservación de los datos'),
```

**registro_actividades:**
```ts
synonyms: s('registro_actividades', 'Categorías de datos personales tratados'),
synonyms: s('registro_actividades', 'Finalidad de cada actividad de tratamiento'),
synonyms: s('registro_actividades', 'Destinatarios y terceros receptores'),
synonyms: s('registro_actividades', 'Plazos de supresión o eliminación'),
synonyms: s('registro_actividades', 'Medidas de seguridad aplicadas'),
```

**procedimiento_arco:**
```ts
synonyms: s('procedimiento_arco', 'Canal formal para recibir solicitudes'),
synonyms: s('procedimiento_arco', 'Plazo de respuesta (máx. 30 días)'),
synonyms: s('procedimiento_arco', 'Verificación de identidad del solicitante'),
synonyms: s('procedimiento_arco', 'Proceso de rectificación y corrección'),
synonyms: s('procedimiento_arco', 'Proceso de supresión / cancelación'),
```

**contrato_encargado:**
```ts
synonyms: s('contrato_encargado', 'Objeto y duración del tratamiento definidos'),
synonyms: s('contrato_encargado', 'Instrucciones documentadas del responsable'),
synonyms: s('contrato_encargado', 'Obligaciones de confidencialidad'),
synonyms: s('contrato_encargado', 'Cláusula de medidas de seguridad'),
synonyms: s('contrato_encargado', 'Condiciones de subcontratación'),
synonyms: s('contrato_encargado', 'Asistencia para solicitudes ARCO'),
synonyms: s('contrato_encargado', 'Devolución o destrucción al término'),
```

**evaluacion_impacto:**
```ts
synonyms: s('evaluacion_impacto', 'Descripción sistemática del tratamiento'),
synonyms: s('evaluacion_impacto', 'Evaluación de necesidad y proporcionalidad'),
synonyms: s('evaluacion_impacto', 'Identificación de riesgos para titulares'),
synonyms: s('evaluacion_impacto', 'Medidas de mitigación de riesgos'),
```

**politica_retencion:**
```ts
synonyms: s('politica_retencion', 'Plazos definidos por categoría de dato'),
synonyms: s('politica_retencion', 'Proceso de revisión periódica'),
synonyms: s('politica_retencion', 'Método de destrucción segura'),
synonyms: s('politica_retencion', 'Responsable del proceso de eliminación'),
```

**registro_rnpa:**
```ts
synonyms: s('registro_rnpa', 'Certificado o comprobante de inscripción RNPA'),
synonyms: s('registro_rnpa', 'Inscripción vigente (no vencida)'),
```

**plan_brechas:**
```ts
synonyms: s('plan_brechas', 'Procedimiento de detección de incidentes'),
synonyms: s('plan_brechas', 'Protocolo de notificación en 72 horas'),
synonyms: s('plan_brechas', 'Contenido mínimo de la notificación'),
synonyms: s('plan_brechas', 'Comunicación a titulares afectados'),
synonyms: s('plan_brechas', 'Registro histórico de incidentes'),
```

**consentimiento:**
```ts
synonyms: s('consentimiento', 'Consentimiento libre, específico e informado'),
synonyms: s('consentimiento', 'Información sobre qué datos y para qué'),
synonyms: s('consentimiento', 'Mecanismo de retiro del consentimiento'),
synonyms: s('consentimiento', 'Registro de fecha y forma de obtención'),
```

**designacion_dpo:**
```ts
synonyms: s('designacion_dpo', 'Identidad y datos de contacto del DPO'),
synonyms: s('designacion_dpo', 'Funciones y responsabilidades definidas'),
synonyms: s('designacion_dpo', 'Independencia y recursos asignados'),
synonyms: s('designacion_dpo', 'Notificación a la APDP realizada'),
```

- [ ] **Step 3: Verificar que no queden arrays synonyms inline**

```bash
npx grep -n "synonyms: \[" lib/requisitos.ts
```

Esperado: sin resultados. Si quedan, aplicar los reemplazos faltantes.

- [ ] **Step 4: Verificar compilación TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores en los archivos tocados hasta ahora.

- [ ] **Step 5: Commit**

```bash
git add lib/requisitos.ts
git commit -m "refactor: sinónimos desde lib/sinonimos.ts en todos los criterios"
```

---

## Task 4: Actualizar hooks/useAppState.ts

**Files:**
- Modify: `hooks/useAppState.ts`

- [ ] **Step 1: Añadir import de HistorialSnapshot**

Reemplazar la línea de imports de types:
```ts
// Antes:
import type { Screen, ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent, Sector } from '@/lib/types';

// Después:
import type { Screen, ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent, Sector, HistorialSnapshot } from '@/lib/types';
```

- [ ] **Step 2: Añadir estado snapshots**

Después de la línea `const [tourStep, setTourStep] = useState(0);`, añadir:
```ts
const [snapshots, setSnapshots] = useState<HistorialSnapshot[]>([]);
```

- [ ] **Step 3: Actualizar finishAnalysis para capturar snapshot**

Reemplazar la función `finishAnalysis` completa:

```ts
// Antes:
const finishAnalysis = useCallback((
  docs: Record<string, UploadedDoc>,
  currentRole: UserRole,
  currentUser: string,
) => {
  const newResults: Record<string, RequisitoResult> = {};
  REQUISITOS.forEach(r => {
    newResults[r.id] = analyzeDocument(r.id, docs);
  });
  setResults(newResults);
  setAnalyzed(true);
  // El análisis completa el flujo guiado: cerrar tour antes de saltar a diagnóstico
  setTourActive(false);
  setScreen('app');
  setActiveTab('diagnostico');
  addAuditEvent('ejecutó análisis', currentRole, currentUser);
}, [addAuditEvent]);

// Después:
const finishAnalysis = useCallback((
  docs: Record<string, UploadedDoc>,
  currentRole: UserRole,
  currentUser: string,
) => {
  const newResults: Record<string, RequisitoResult> = {};
  REQUISITOS.forEach(r => {
    newResults[r.id] = analyzeDocument(r.id, docs);
  });

  // Calcular métricas para el snapshot histórico
  const unanalyzable = REQUISITOS.filter(r => newResults[r.id]?.estado === 'unanalyzable').length;
  const analyzable   = REQUISITOS.length - unanalyzable;
  const greenCount   = REQUISITOS.filter(r => newResults[r.id]?.estado === 'green').length;
  const yellowCount  = REQUISITOS.filter(r => newResults[r.id]?.estado === 'yellow').length;
  const redCount     = REQUISITOS.filter(r => newResults[r.id]?.estado === 'red').length;
  const pct = analyzable > 0
    ? Math.round((greenCount * 100 + yellowCount * 50) / (analyzable * 100) * 100)
    : 0;

  setSnapshots(prev => [...prev, {
    fecha: new Date().toISOString(),
    pct,
    green: greenCount,
    yellow: yellowCount,
    red: redCount,
  }]);

  setResults(newResults);
  setAnalyzed(true);
  setTourActive(false);
  setScreen('app');
  setActiveTab('diagnostico');
  addAuditEvent('ejecutó análisis', currentRole, currentUser);
}, [addAuditEvent]);
```

- [ ] **Step 4: Resetear snapshots en logout**

Dentro de la función `logout`, añadir `setSnapshots([]);` junto a los demás resets:

```ts
// En logout, añadir esta línea junto a setAuditLog([]):
setSnapshots([]);
```

- [ ] **Step 5: Exportar snapshots en el return**

Reemplazar el `return` al final del hook:
```ts
// Antes:
return {
  screen, activeTab, companyName, role, sector, uploadedDocs, results,
  previousResults, analyzed, auditLog, tourActive, tourStep,
  login, demo, logout, uploadDoc, startAnalysis, finishAnalysis,
  switchTab, logDownload, advanceTour, skipTour,
};

// Después:
return {
  screen, activeTab, companyName, role, sector, uploadedDocs, results,
  previousResults, analyzed, auditLog, snapshots, tourActive, tourStep,
  login, demo, logout, uploadDoc, startAnalysis, finishAnalysis,
  switchTab, logDownload, advanceTour, skipTour,
};
```

- [ ] **Step 6: Verificar compilación**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: errores en AppShell y page.tsx por `snapshots` aún no conectado — normal, se resuelven en tasks siguientes.

- [ ] **Step 7: Commit**

```bash
git add hooks/useAppState.ts
git commit -m "feat: estado snapshots y captura histórica en finishAnalysis"
```

---

## Task 5: Actualizar components/DiagnosticoView.tsx

**Files:**
- Modify: `components/DiagnosticoView.tsx`

Añadir indicadores visuales de confianza en la lista de criterios de cada requisito.

- [ ] **Step 1: Añadir la nota de confianza antes de criterios-list**

En `DiagnosticoView.tsx`, localizar este bloque (línea ~308):
```tsx
<div className="criterios-list">
  {criterios.map((c, i) => (
```

Reemplazarlo con:
```tsx
{criterios.some(c => c.confianza !== 'alta') && (
  <p className="confianza-nota">
    La confianza indica qué tan segura es la detección automática.
    Recomendamos validación legal en criterios de confianza media o baja.
  </p>
)}
<div className="criterios-list">
  {criterios.map((c, i) => (
```

- [ ] **Step 2: Añadir el punto de confianza en cada criterio-item**

Localizar el bloque de cada criterio-item:
```tsx
<div key={i} className="criterio-item">
  <div className={`criterio-badge ${c.status}`}>
    {c.status === 'ok' ? '✓' : c.status === 'warn' ? '~' : '✕'}
  </div>
  <div className="criterio-name">{c.name}</div>
  <div className={`criterio-found ${c.status}`}>{c.found}</div>
</div>
```

Reemplazarlo con:
```tsx
<div key={i} className="criterio-item">
  <div className={`criterio-badge ${c.status}`}>
    {c.status === 'ok' ? '✓' : c.status === 'warn' ? '~' : '✕'}
  </div>
  <div className="criterio-name">{c.name}</div>
  <div className={`criterio-found ${c.status}`}>{c.found}</div>
  <span
    className={`confianza-dot ${c.confianza}`}
    title={`Confianza ${c.confianza}: ${
      c.confianza === 'alta'
        ? 'keyword exacta encontrada'
        : c.confianza === 'media'
        ? 'detectado vía sinónimo'
        : 'no encontrado'
    }`}
  />
</div>
```

- [ ] **Step 3: Verificar compilación**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores nuevos en DiagnosticoView.

- [ ] **Step 4: Commit**

```bash
git add components/DiagnosticoView.tsx
git commit -m "feat: indicadores visuales de confianza en criterios del diagnóstico"
```

---

## Task 6: Crear components/HistorialView.tsx

**Files:**
- Create: `components/HistorialView.tsx`

- [ ] **Step 1: Crear el componente completo**

Crear `components/HistorialView.tsx` con el siguiente contenido:

```tsx
'use client';
import type { HistorialSnapshot } from '@/lib/types';

interface HistorialViewProps {
  snapshots: HistorialSnapshot[];
}

// Dimensiones del área de trazado SVG
const W = 600, H = 190;
const PAD = { top: 20, right: 24, bottom: 48, left: 48 };
const CW = W - PAD.left - PAD.right; // ancho útil: 528
const CH = H - PAD.top - PAD.bottom; // alto útil: 122

function xPos(i: number, total: number): number {
  return total === 1 ? PAD.left + CW / 2 : PAD.left + (i / (total - 1)) * CW;
}
function yPos(pct: number): number {
  return PAD.top + (1 - pct / 100) * CH;
}
function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

export default function HistorialView({ snapshots }: HistorialViewProps) {
  // Estado vacío: nunca se ejecutó ningún análisis
  if (snapshots.length === 0) {
    return (
      <div className="historial-view">
        <div className="historial-empty">
          <div className="historial-empty-icon">📈</div>
          <h3>Aún no hay análisis registrados</h3>
          <p>
            Suba sus documentos en la pestaña <strong>Subir documentos</strong> y ejecute
            el análisis para comenzar a registrar la evolución del cumplimiento de su empresa.
          </p>
        </div>
      </div>
    );
  }

  const ultimo    = snapshots[snapshots.length - 1];
  const penultimo = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const delta     = penultimo ? ultimo.pct - penultimo.pct : 0;

  // Construir la polilínea SVG (solo cuando hay ≥2 puntos)
  const polylinePoints = snapshots
    .map((s, i) => `${xPos(i, snapshots.length).toFixed(1)},${yPos(s.pct).toFixed(1)}`)
    .join(' ');

  // Polígono de área rellena: línea + cierre inferior
  const areaPoints = snapshots.length > 1
    ? `${polylinePoints} ${xPos(snapshots.length - 1, snapshots.length).toFixed(1)},${(PAD.top + CH).toFixed(1)} ${PAD.left.toFixed(1)},${(PAD.top + CH).toFixed(1)}`
    : '';

  const gridLines = [100, 75, 50, 25, 0];

  return (
    <div className="historial-view">

      {/* Encabezado */}
      <div className="historial-header">
        <h2>Progreso histórico de cumplimiento</h2>
        <p>{snapshots.length} análisis registrado{snapshots.length !== 1 ? 's' : ''} en esta sesión</p>
      </div>

      {/* Indicador de tendencia (solo cuando hay ≥2 análisis) */}
      {penultimo && (
        <div className={`historial-tendencia ${delta > 0 ? 'positiva' : delta < 0 ? 'negativa' : 'neutra'}`}>
          <span className="historial-tendencia-icono">
            {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}
          </span>
          <span>
            {delta > 0
              ? `Mejoró ${delta}% desde el último análisis (${penultimo.pct}% → ${ultimo.pct}%)`
              : delta < 0
              ? `Retrocedió ${Math.abs(delta)}% desde el último análisis (${penultimo.pct}% → ${ultimo.pct}%)`
              : `Sin cambios respecto al último análisis (${ultimo.pct}%)`}
          </span>
        </div>
      )}

      {/* Gráfico SVG */}
      <div className="historial-chart-wrap">
        {snapshots.length === 1 && (
          <p className="historial-single-msg">
            Ejecute más análisis para ver la evolución de su cumplimiento a lo largo del tiempo.
          </p>
        )}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="historial-svg"
        >
          {/* Líneas de cuadrícula y etiquetas eje Y */}
          {gridLines.map(pct => {
            const y = yPos(pct);
            return (
              <g key={pct}>
                <line
                  x1={PAD.left} y1={y}
                  x2={PAD.left + CW} y2={y}
                  stroke="rgba(15,30,61,0.08)" strokeWidth="1"
                />
                <text
                  x={PAD.left - 6} y={y + 4}
                  textAnchor="end" fontSize="10"
                  fill="rgba(138,150,184,1)"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Área rellena bajo la línea (≥2 puntos) */}
          {snapshots.length > 1 && (
            <polygon points={areaPoints} fill="rgba(37,99,235,0.07)" />
          )}

          {/* Línea de tendencia (≥2 puntos) */}
          {snapshots.length > 1 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Puntos y etiquetas eje X */}
          {snapshots.map((s, i) => {
            const cx = xPos(i, snapshots.length);
            const cy = yPos(s.pct);
            const isLast = i === snapshots.length - 1;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={isLast ? 6 : 5} fill="#2563eb" />
                <circle cx={cx} cy={cy} r={isLast ? 3.5 : 3} fill="white" />
                {/* Etiqueta del porcentaje sobre el punto */}
                <text
                  x={cx} y={cy - 10}
                  textAnchor="middle" fontSize="10" fontWeight={isLast ? '700' : '400'}
                  fill="#2563eb"
                >
                  {s.pct}%
                </text>
                {/* Etiqueta eje X */}
                <text
                  x={cx} y={PAD.top + CH + 18}
                  textAnchor="middle" fontSize="9"
                  fill="rgba(138,150,184,1)"
                >
                  {snapshots.length <= 6 ? fechaCorta(s.fecha) : `#${i + 1}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tabla resumen */}
      <div className="historial-tabla-wrap">
        <table className="historial-tabla">
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Cumplimiento</th>
              <th>Al día</th>
              <th>Incompleto</th>
              <th>Faltante</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s, i) => (
              <tr key={i} className={i === snapshots.length - 1 ? 'historial-row-last' : ''}>
                <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                <td>{fechaCorta(s.fecha)}</td>
                <td><strong>{s.pct}%</strong></td>
                <td style={{ color: 'var(--green)' }}>{s.green}</td>
                <td style={{ color: 'var(--yellow)' }}>{s.yellow}</td>
                <td style={{ color: 'var(--red)' }}>{s.red}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit 2>&1 | grep HistorialView
```

Esperado: sin errores relacionados con HistorialView.

- [ ] **Step 3: Commit**

```bash
git add components/HistorialView.tsx
git commit -m "feat: componente HistorialView con gráfico SVG de evolución"
```

---

## Task 7: Actualizar components/AppShell.tsx

**Files:**
- Modify: `components/AppShell.tsx`

- [ ] **Step 1: Añadir imports y prop snapshots**

Añadir el import de HistorialView y HistorialSnapshot:
```tsx
// Añadir al bloque de imports existente:
import HistorialView from './HistorialView';
import type { ..., HistorialSnapshot } from '@/lib/types';
// (añadir HistorialSnapshot a la lista de tipos importados de @/lib/types)
```

Actualizar la interfaz `AppShellProps` para añadir `snapshots`:
```tsx
// Añadir dentro de AppShellProps, después de previousResults:
snapshots: HistorialSnapshot[];
```

Actualizar los parámetros destructurados de la función:
```tsx
// Antes:
export default function AppShell({
  companyName, role, sector, auditLog, activeTab, uploadedDocs, results,
  previousResults, analyzed, tourActive, tourStep,
  ...
}: AppShellProps) {

// Después:
export default function AppShell({
  companyName, role, sector, auditLog, activeTab, uploadedDocs, results,
  previousResults, snapshots, analyzed, tourActive, tourStep,
  ...
}: AppShellProps) {
```

- [ ] **Step 2: Añadir tab Historial en el nav**

Dentro del `<nav className="app-nav">`, después del tab de Registro, añadir:
```tsx
<div className={`nav-tab${activeTab === 'historial' ? ' active' : ''}`} onClick={() => onSwitchTab('historial')}>
  <span style={{ fontSize: 14 }}>📈</span> Historial
  {snapshots.length >= 2 && (
    <span className="nav-tab-badge" style={{ background: 'rgba(37,99,235,0.12)', color: 'var(--blue)' }}>
      {snapshots.length}
    </span>
  )}
</div>
```

- [ ] **Step 3: Renderizar HistorialView en el contenido**

Dentro del `<div className="app-content">`, añadir al final (después del bloque de Registro):
```tsx
{activeTab === 'historial' && (
  <HistorialView snapshots={snapshots} />
)}
```

- [ ] **Step 4: Verificar compilación**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: error en `app/page.tsx` por `snapshots` faltante — normal, se resuelve en Task 8.

- [ ] **Step 5: Commit**

```bash
git add components/AppShell.tsx
git commit -m "feat: tab Historial en AppShell con badge de conteo"
```

---

## Task 8: Actualizar app/page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Pasar snapshots a AppShell**

En `app/page.tsx`, dentro del bloque `{state.screen === 'app' && (`, añadir `snapshots={state.snapshots}` como prop de `<AppShell>`:

```tsx
// En el JSX de AppShell, añadir después de previousResults:
snapshots={state.snapshots}
```

El bloque completo de AppShell queda así (solo se añade la línea marcada con →):
```tsx
<AppShell
  companyName={state.companyName}
  role={state.role}
  sector={state.sector}
  auditLog={state.auditLog}
  activeTab={state.activeTab}
  uploadedDocs={state.uploadedDocs}
  results={state.results}
  previousResults={state.previousResults}
  snapshots={state.snapshots}   {/* ← añadir esta línea */}
  analyzed={state.analyzed}
  tourActive={state.tourActive}
  tourStep={state.tourStep}
  onSwitchTab={tab => {
    const ok = state.switchTab(tab, state.analyzed);
    if (!ok) toast('Primero suba documentos y ejecute el análisis', 'yellow');
  }}
  onUpload={(reqId, doc) => state.uploadDoc(reqId, doc, state.role, state.companyName)}
  onStartAnalysis={() => {
    if (Object.keys(state.uploadedDocs).length === 0) {
      toast('Suba al menos 1 documento primero', 'yellow');
      return;
    }
    state.startAnalysis();
  }}
  onLogout={state.logout}
  onDownload={() => state.logDownload(state.role, state.companyName)}
  onAdvanceTour={state.advanceTour}
  onSkipTour={state.skipTour}
  onToast={toast}
/>
```

- [ ] **Step 2: Verificar compilación limpia**

```bash
npx tsc --noEmit 2>&1
```

Esperado: **cero errores**. Si quedan errores, revisar que los imports de `HistorialSnapshot` estén en todos los archivos que lo usan.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: conectar snapshots de useAppState a AppShell"
```

---

## Task 9: Actualizar app/globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Añadir estilos al final del archivo**

Añadir al final de `app/globals.css`:

```css
/* ─────────────────────────────────────────────────────────
   INDICADORES DE CONFIANZA (Mejora 2)
   ───────────────────────────────────────────────────────── */
.confianza-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-left: 6px;
  vertical-align: middle;
}
.confianza-dot.alta  { background: #4ade80; }
.confianza-dot.media { background: #fcd34d; }
.confianza-dot.baja  { background: #f87171; }

.confianza-nota {
  font-size: 11px;
  color: var(--text3);
  background: rgba(15,30,61,0.04);
  border-left: 2px solid var(--border2);
  padding: 6px 10px;
  border-radius: 0 6px 6px 0;
  margin-bottom: 8px;
  line-height: 1.5;
}

/* ─────────────────────────────────────────────────────────
   HISTORIAL VIEW (Mejora 3)
   ───────────────────────────────────────────────────────── */
.historial-view {
  max-width: 860px;
  margin: 0 auto;
  padding: 24px 20px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Encabezado */
.historial-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--navy);
}
.historial-header p {
  font-size: 13px;
  color: var(--text3);
  margin-top: 2px;
}

/* Estado vacío */
.historial-empty {
  text-align: center;
  padding: 64px 20px;
  color: var(--text3);
}
.historial-empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.historial-empty h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text2);
  margin-bottom: 8px;
}
.historial-empty p {
  font-size: 14px;
  max-width: 420px;
  margin: 0 auto;
  line-height: 1.6;
}

/* Indicador de tendencia */
.historial-tendencia {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
}
.historial-tendencia.positiva {
  background: var(--green-bg);
  color: var(--green);
  border: 1px solid var(--green-border);
}
.historial-tendencia.negativa {
  background: var(--red-bg);
  color: var(--red);
  border: 1px solid var(--red-border);
}
.historial-tendencia.neutra {
  background: var(--surface);
  color: var(--text2);
  border: 1px solid var(--border);
}
.historial-tendencia-icono {
  font-size: 18px;
  font-weight: 700;
}

/* Contenedor del gráfico */
.historial-chart-wrap {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 16px 12px;
  box-shadow: var(--shadow);
}
.historial-single-msg {
  font-size: 12px;
  color: var(--text3);
  text-align: center;
  margin-bottom: 8px;
  font-style: italic;
}
.historial-svg {
  width: 100%;
  height: auto;
  display: block;
}

/* Tabla resumen */
.historial-tabla-wrap {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow);
}
.historial-tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.historial-tabla th {
  padding: 10px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.historial-tabla td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}
.historial-tabla tr:last-child td {
  border-bottom: none;
}
.historial-row-last td {
  background: rgba(37,99,235,0.04);
  font-weight: 500;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: estilos para indicadores de confianza y vista historial"
```

---

## Task 10: Build final y verificación

**Files:** (ninguno nuevo — solo verificación)

- [ ] **Step 1: Build completo**

```bash
npm run build 2>&1
```

Esperado: `✓ Compiled successfully` sin errores TypeScript ni de compilación.

- [ ] **Step 2: Iniciar servidor de desarrollo**

```bash
npm run dev
```

- [ ] **Step 3: Verificar Mejora 2 — indicadores de confianza**

1. Abrir `http://localhost:3000`
2. Hacer clic en "Ver demo"
3. Ir a la pestaña "Mi diagnóstico" (el análisis se ejecuta automáticamente en demo)
4. Expandir cualquier requisito (hacer clic en la tarjeta)
5. Verificar que los criterios muestran puntos de color:
   - Verde para criterios detectados con keyword exacta
   - Amarillo para detectados vía sinónimo
   - Rojo para no encontrados
6. Verificar que aparece la nota gris cuando hay criterios con confianza media o baja

- [ ] **Step 4: Verificar Mejora 3 — pestaña Historial con un análisis**

1. Ir a la pestaña "Historial" (visible en la barra de navegación)
2. Con el modo demo (que ejecuta 1 análisis), verificar:
   - Se ve el gráfico con un solo punto azul
   - Aparece el mensaje "Ejecute más análisis para ver la evolución..."
   - La tabla muestra 1 fila con fecha, % y colores

- [ ] **Step 5: Verificar Mejora 3 — múltiples análisis**

1. En modo demo, ir a "Subir documentos" y hacer clic en "Analizar documentos" nuevamente
2. Ir a "Historial"
3. Verificar:
   - El gráfico ahora muestra 2 puntos conectados por línea azul
   - Aparece el indicador de tendencia (verde/rojo/gris según la diferencia)
   - La tabla muestra 2 filas, la última con fondo azul suave

- [ ] **Step 6: Verificar Mejora 1 — diccionario separado**

```bash
npx grep -r "synonyms: \[" lib/requisitos.ts
```

Esperado: sin resultados (todos los sinónimos vienen de `sinonimos.ts`).

- [ ] **Step 7: Commit final de verificación**

```bash
git add -A
git commit -m "feat: mejoras de precisión (sinónimos, confianza, historial) — build verificado"
```

---

## Self-Review

**Spec coverage:**
- ✅ Mejora 1: `lib/sinonimos.ts` creado (Task 1), `requisitos.ts` refactorizado (Task 3)
- ✅ Mejora 2: Indicadores de confianza + nota explicativa en DiagnosticoView (Task 5)
- ✅ Mejora 3: `HistorialSnapshot` en types (Task 2), `snapshots` en useAppState (Task 4), `HistorialView` con SVG (Task 6), tab en AppShell (Task 7), prop en page.tsx (Task 8)
- ✅ CSS para ambas mejoras (Task 9)
- ✅ Build verification (Task 10)
- ✅ Sin localStorage: estado React puro
- ✅ Sin dependencias nuevas: SVG nativo
- ✅ Casos borde: 0 análisis (estado vacío), 1 análisis (mensaje orientador), ≥2 (gráfico completo)
- ✅ Logout resetea snapshots

**Consistencia de tipos:**
- `HistorialSnapshot` definido en Task 2, usado en Tasks 4, 6, 7
- `ActiveTab` expandido en Task 2, consumido en Tasks 7 y 8 sin cambios adicionales
- `snapshots: HistorialSnapshot[]` propagado: useAppState → page.tsx → AppShell → HistorialView

**Sin placeholders:** todas las tareas contienen código completo.
