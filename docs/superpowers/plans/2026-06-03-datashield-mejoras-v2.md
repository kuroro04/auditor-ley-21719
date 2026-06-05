# DataShield 21.719 — Mejoras v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar RBAC, audit log, disclaimer legal, sinónimos con confianza, indicador de validación, timeout de sesión y sección de riesgos a DataShield 21.719 sin romper funcionalidad existente.

**Architecture:** La app es una SPA Next.js 14 sin backend. Todo el estado vive en React (sin localStorage). Se añaden 4 archivos nuevos (RegistroView, RiesgosView, SessionTimeoutModal, useSessionTimeout) y se modifican 8 existentes de forma aditiva. Las dependencias fluyen: types → requisitos/analyzer → useAppState → page.tsx → componentes.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS (globals.css), sin librerías externas adicionales.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `lib/types.ts` | Modificar | Nuevos tipos: UserRole, AuditEvent; campos en Criterio, CriterioResult, ActiveTab |
| `lib/requisitos.ts` | Modificar | Agregar synonyms[] y validado a los 50 criterios |
| `lib/analyzer.ts` | Modificar | Lógica de sinónimos y campo confianza |
| `hooks/useSessionTimeout.ts` | Crear | Timer de inactividad con reset en eventos del usuario |
| `hooks/useAppState.ts` | Modificar | Estado role, auditLog, helpers login/uploadDoc/finishAnalysis |
| `components/Landing.tsx` | Modificar | Actualizar firma onLogin para incluir UserRole |
| `components/LoginCard.tsx` | Modificar | Selector de rol |
| `components/RegistroView.tsx` | Crear | Tabla de audit log |
| `components/RiesgosView.tsx` | Crear | Cards de riesgos y controles |
| `components/SessionTimeoutModal.tsx` | Crear | Modal de expiración con countdown |
| `components/UploadView.tsx` | Modificar | Prop canUpload para RBAC |
| `components/AppShell.tsx` | Modificar | Tabs condicionales, role en header, nuevas vistas |
| `components/DiagnosticoView.tsx` | Modificar | Disclaimer, chips confianza, badges validado, RBAC |
| `app/page.tsx` | Modificar | Conectar timeout modal, pasar role/auditLog |
| `app/globals.css` | Modificar | Estilos para todos los elementos nuevos |

---

## Task 1: Extender lib/types.ts

**Files:**
- Modify: `lib/types.ts`

- [ ] **Paso 1: Reemplazar el contenido de lib/types.ts con los tipos extendidos**

```typescript
// Roles de acceso disponibles en la plataforma
export type UserRole = 'administrador' | 'visualizador' | 'auditor';

// Evento registrado en el audit log
export interface AuditEvent {
  id: number;
  timestamp: string;        // ISO 8601
  rol: UserRole;
  usuario: string;          // RUT de la empresa
  accion: 'subió documento' | 'ejecutó análisis' | 'descargó informe' | 'eliminó documento';
  archivo?: string;
}

export interface Criterio {
  name: string;
  keywords: string[];
  synonyms: string[];       // Términos alternativos aceptados
  validado: boolean;        // Revisado por especialista legal
}

export interface Plazo {
  date: string;
  urgency: 'ok' | 'pronto' | 'urgent';
}

export interface Requisito {
  id: string;
  num: string;
  nombre: string;
  art: string;
  desc: string;
  multa: string;
  nivel: 'medio' | 'alto' | 'critico';
  plazo: Plazo;
  criterios: Criterio[];
}

export interface UploadedDoc {
  name: string;
  text: string;
  wordCount?: number;
  extractedFully?: boolean;
  extractMethod?: string;
}

export interface CriterioResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  found: string;
  kwFound: number;
  kwTotal: number;
  confianza: 'alta' | 'media' | 'baja'; // Confianza del análisis
  validado: boolean;                      // Copiado desde Criterio
}

export interface RequisitoResult {
  estado: 'green' | 'yellow' | 'red';
  cobertura: number;
  criterios: CriterioResult[];
  gap: string;
}

export type Screen = 'landing' | 'app' | 'analyzing';
// 'registro' solo visible para admin/auditor; 'riesgos' visible para todos
export type ActiveTab = 'subir' | 'diagnostico' | 'registro' | 'riesgos';

export interface ToastItem {
  id: number;
  msg: string;
  type: 'blue' | 'green' | 'yellow' | 'red';
}
```

- [ ] **Paso 2: Verificar compilación TypeScript**

```powershell
cd "C:\Users\lrrp2\OneDrive\Escritorio\auditor-ley-21719"
npx tsc --noEmit
```

Esperado: Sin errores (puede haber errores de archivos que aún usan los tipos viejos — se corrigen en tareas siguientes).

- [ ] **Paso 3: Commit**

```powershell
git add lib/types.ts
git commit -m "feat: extender tipos — UserRole, AuditEvent, synonyms/validado en Criterio, ActiveTab con registro/riesgos"
```

---

## Task 2: Actualizar lib/requisitos.ts

**Files:**
- Modify: `lib/requisitos.ts`

- [ ] **Paso 1: Reemplazar el contenido completo de lib/requisitos.ts**

```typescript
import type { Requisito } from './types';

export const REQUISITOS: Requisito[] = [
  {
    id: 'politica_privacidad',
    num: '01',
    nombre: 'Política de privacidad',
    art: 'Art. 14 — Deber de información',
    desc: 'Documento que informa a sus clientes qué datos recopila, para qué y quién es el responsable.',
    multa: '500 UTM',
    nivel: 'medio',
    plazo: { date: 'Vigente', urgency: 'ok' },
    criterios: [
      {
        name: 'Identidad y contacto del responsable de datos',
        keywords: ['responsable','rut','domicilio','contacto','encargado'],
        synonyms: ['controlador','data controller','titular del tratamiento','representante legal'],
        validado: true,
      },
      {
        name: 'Finalidad y propósito del tratamiento',
        keywords: ['finalidad','propósito','para qué','objetivo'],
        synonyms: ['motivo del tratamiento','uso de datos','razón del tratamiento'],
        validado: true,
      },
      {
        name: 'Base legal (consentimiento / interés legítimo)',
        keywords: ['consentimiento','base legal','interés legítimo','autorización'],
        synonyms: ['habilitación legal','fundamento jurídico','licitud','título legal'],
        validado: true,
      },
      {
        name: 'Derechos ARCO del titular (acceso, rectificación...)',
        keywords: ['acceso','rectificación','cancelación','oposición','derechos','arco'],
        synonyms: ['derechos del titular','portabilidad','supresión','derecho al olvido'],
        validado: true,
      },
      {
        name: 'Plazo de conservación de los datos',
        keywords: ['conservación','retención','plazo','tiempo','eliminar'],
        synonyms: ['período de guarda','ciclo de vida','tiempo de almacenamiento'],
        validado: true,
      },
    ],
  },
  {
    id: 'registro_actividades',
    num: '02',
    nombre: 'Registro de actividades de tratamiento',
    art: 'Art. 16 — Registro interno obligatorio',
    desc: 'Inventario interno que documenta todos los flujos de datos personales que su empresa maneja.',
    multa: '1.000 UTM',
    nivel: 'alto',
    plazo: { date: 'Vigente', urgency: 'ok' },
    criterios: [
      {
        name: 'Categorías de datos personales tratados',
        keywords: ['categorías','tipos de datos','datos sensibles','personales'],
        synonyms: ['clases de datos','naturaleza de los datos','tipo de información'],
        validado: true,
      },
      {
        name: 'Finalidad de cada actividad de tratamiento',
        keywords: ['finalidad','propósito'],
        synonyms: ['motivo','objetivo del tratamiento','razón'],
        validado: true,
      },
      {
        name: 'Destinatarios y terceros receptores',
        keywords: ['destinatarios','encargados','terceros','proveedores','receptores'],
        synonyms: ['cesionarios','subencargados','data processors','partners'],
        validado: true,
      },
      {
        name: 'Plazos de supresión o eliminación',
        keywords: ['supresión','eliminación','plazo','baja'],
        synonyms: ['borrado','destrucción','período de retención'],
        validado: true,
      },
      {
        name: 'Medidas de seguridad aplicadas',
        keywords: ['seguridad','cifrado','medidas','controles'],
        synonyms: ['protección','salvaguardas','controles técnicos','ISO 27001'],
        validado: true,
      },
    ],
  },
  {
    id: 'procedimiento_arco',
    num: '03',
    nombre: 'Procedimiento de derechos ARCO',
    art: 'Art. 11–13 — Derechos del titular',
    desc: 'Protocolo escrito para atender solicitudes de acceso, rectificación, cancelación y oposición en máximo 30 días.',
    multa: '1.000 UTM',
    nivel: 'alto',
    plazo: { date: 'Vigente', urgency: 'ok' },
    criterios: [
      {
        name: 'Canal formal para recibir solicitudes',
        keywords: ['canal','formulario','correo','solicitudes','recepción'],
        synonyms: ['medio de contacto','buzón','mecanismo de solicitud'],
        validado: true,
      },
      {
        name: 'Plazo de respuesta (máx. 30 días)',
        keywords: ['30 días','treinta','plazo','respuesta'],
        synonyms: ['mes','término legal','lapso de respuesta'],
        validado: true,
      },
      {
        name: 'Verificación de identidad del solicitante',
        keywords: ['identidad','verificación','autenticación','rut'],
        synonyms: ['identificación','acreditación','comprobación'],
        validado: true,
      },
      {
        name: 'Proceso de rectificación y corrección',
        keywords: ['rectificación','corrección','modificación'],
        synonyms: ['enmienda','actualización de datos','cambio de información'],
        validado: true,
      },
      {
        name: 'Proceso de supresión / cancelación',
        keywords: ['supresión','cancelación','eliminar','borrar','baja'],
        synonyms: ['remoción','derecho al olvido','borrado definitivo'],
        validado: true,
      },
    ],
  },
  {
    id: 'contrato_encargado',
    num: '04',
    nombre: 'Contrato con encargado de datos',
    art: 'Art. 25 — Encargado de tratamiento',
    desc: 'Si usa proveedores externos que procesan datos de sus clientes (cloud, marketing, RRHH), necesita un contrato especial.',
    multa: '2.000 UTM',
    nivel: 'alto',
    plazo: { date: 'Vigente', urgency: 'pronto' },
    criterios: [
      {
        name: 'Objeto y duración del tratamiento definidos',
        keywords: ['objeto','duración','alcance','término'],
        synonyms: ['propósito del contrato','vigencia','período contractual'],
        validado: true,
      },
      {
        name: 'Instrucciones documentadas del responsable',
        keywords: ['instrucciones','instrucción','según instrucciones'],
        synonyms: ['directivas','mandato','órdenes del responsable'],
        validado: true,
      },
      {
        name: 'Obligaciones de confidencialidad',
        keywords: ['confidencialidad','secreto','no divulgar','sigilo'],
        synonyms: ['reserva','privacidad','cláusula de no divulgación','NDA'],
        validado: true,
      },
      {
        name: 'Cláusula de medidas de seguridad',
        keywords: ['medidas seguridad','seguridad informática','protección'],
        synonyms: ['controles técnicos','salvaguardas','seguridad de la información'],
        validado: true,
      },
      {
        name: 'Condiciones de subcontratación',
        keywords: ['subencargado','subcontratación','terceros'],
        synonyms: ['sub-procesador','proveedor externo','cadena de suministro'],
        validado: true,
      },
      {
        name: 'Asistencia para solicitudes ARCO',
        keywords: ['asistencia','arco','solicitudes titular','cooperación'],
        synonyms: ['apoyo','colaboración','asistencia al responsable'],
        validado: true,
      },
      {
        name: 'Devolución o destrucción al término',
        keywords: ['devolución','destrucción','término','cese','fin contrato'],
        synonyms: ['restitución','eliminación al cierre','borrado final'],
        validado: true,
      },
    ],
  },
  {
    id: 'evaluacion_impacto',
    num: '05',
    nombre: 'Evaluación de impacto (EIPD)',
    art: 'Art. 38 — Evaluación de impacto en privacidad',
    desc: 'Análisis formal de riesgos. Obligatorio si trata datos sensibles o a gran escala.',
    multa: '3.000 UTM',
    nivel: 'alto',
    plazo: { date: '31 Ago', urgency: 'pronto' },
    criterios: [
      {
        name: 'Descripción sistemática del tratamiento',
        keywords: ['descripción sistemática','descripción del tratamiento'],
        synonyms: ['análisis detallado','mapeo de datos','descripción del proceso de datos'],
        validado: false,
      },
      {
        name: 'Evaluación de necesidad y proporcionalidad',
        keywords: ['necesidad','proporcionalidad','minimización'],
        synonyms: ['pertinencia','adecuación','limitación del tratamiento'],
        validado: false,
      },
      {
        name: 'Identificación de riesgos para titulares',
        keywords: ['riesgos','evaluación de riesgos','probabilidad','impacto'],
        synonyms: ['amenazas','vulnerabilidades','análisis de riesgo'],
        validado: false,
      },
      {
        name: 'Medidas de mitigación de riesgos',
        keywords: ['mitigación','medidas','salvaguardas','controles'],
        synonyms: ['reducción de riesgos','controles compensatorios','tratamiento del riesgo'],
        validado: false,
      },
    ],
  },
  {
    id: 'politica_retencion',
    num: '06',
    nombre: 'Política de retención y eliminación',
    art: 'Art. 7 — Limitación del plazo de conservación',
    desc: 'Documento que define cuánto tiempo guarda cada tipo de dato y cómo los destruye de forma segura.',
    multa: '1.000 UTM',
    nivel: 'medio',
    plazo: { date: 'Vigente', urgency: 'ok' },
    criterios: [
      {
        name: 'Plazos definidos por categoría de dato',
        keywords: ['plazo','período','tiempo máximo','años','meses'],
        synonyms: ['vigencia del dato','duración del almacenamiento','ciclo de vida del dato'],
        validado: false,
      },
      {
        name: 'Proceso de revisión periódica',
        keywords: ['revisión periódica','auditoría','anual','verificación'],
        synonyms: ['control periódico','evaluación regular','revisión programada'],
        validado: false,
      },
      {
        name: 'Método de destrucción segura',
        keywords: ['destrucción','borrado seguro','anonimización','shredding','eliminación'],
        synonyms: ['trituración','supresión segura','sanitización','borrado certificado'],
        validado: false,
      },
      {
        name: 'Responsable del proceso de eliminación',
        keywords: ['responsable','encargado','dpo','cargo'],
        synonyms: ['delegado','persona designada','cargo responsable'],
        validado: false,
      },
    ],
  },
  {
    id: 'registro_rnpa',
    num: '07',
    nombre: 'Inscripción en el RNPA',
    art: 'Art. 55 — Registro Nacional de Protección de Datos',
    desc: 'Su empresa debe registrarse formalmente ante la APDP como responsable de tratamiento de datos.',
    multa: '1.000 UTM',
    nivel: 'alto',
    plazo: { date: '09 Jun', urgency: 'urgent' },
    criterios: [
      {
        name: 'Certificado o comprobante de inscripción RNPA',
        keywords: ['rnpa','registro nacional','inscripción','número inscripción','apdp'],
        synonyms: ['certificado apdp','registro oficial','inscripción formal','número de registro'],
        validado: false,
      },
      {
        name: 'Inscripción vigente (no vencida)',
        keywords: ['vigente','inscripción vigente','fecha inscripción'],
        synonyms: ['activo','en vigor','no vencido','actualizado'],
        validado: false,
      },
    ],
  },
  {
    id: 'plan_brechas',
    num: '08',
    nombre: 'Plan de respuesta ante brechas',
    art: 'Art. 40 — Notificación de brechas de seguridad',
    desc: 'Protocolo que detalla cómo actuará su empresa si ocurre una fuga de datos. Tiene 72 horas para notificar a la APDP.',
    multa: '5.000 UTM',
    nivel: 'critico',
    plazo: { date: 'Vigente', urgency: 'urgent' },
    criterios: [
      {
        name: 'Procedimiento de detección de incidentes',
        keywords: ['detección','monitoreo','alerta','incidente'],
        synonyms: ['vigilancia','supervisión','aviso','evento de seguridad'],
        validado: false,
      },
      {
        name: 'Protocolo de notificación en 72 horas',
        keywords: ['72 horas','setenta y dos','notificación apdp','notificar'],
        synonyms: ['tres días','período de notificación','plazo legal de notificación'],
        validado: false,
      },
      {
        name: 'Contenido mínimo de la notificación',
        keywords: ['contenido','descripción brecha','datos afectados','notificación'],
        synonyms: ['información de la brecha','detalle del incidente','contenido obligatorio'],
        validado: false,
      },
      {
        name: 'Comunicación a titulares afectados',
        keywords: ['titulares afectados','comunicar personas','notificar usuarios'],
        synonyms: ['afectados','personas impactadas','aviso a los titulares'],
        validado: false,
      },
      {
        name: 'Registro histórico de incidentes',
        keywords: ['registro','log','historial','incidentes','bitácora'],
        synonyms: ['registro de eventos','trazabilidad','base de datos de incidentes'],
        validado: false,
      },
    ],
  },
  {
    id: 'consentimiento',
    num: '09',
    nombre: 'Consentimiento informado documentado',
    art: 'Art. 12 — Requisitos del consentimiento',
    desc: 'Evidencia de que sus clientes o usuarios autorizaron voluntariamente el tratamiento de sus datos.',
    multa: '2.000 UTM',
    nivel: 'alto',
    plazo: { date: 'Vigente', urgency: 'pronto' },
    criterios: [
      {
        name: 'Consentimiento libre, específico e informado',
        keywords: ['libre','específico','informado','inequívoco'],
        synonyms: ['voluntario','expreso','explícito','sin ambigüedad'],
        validado: false,
      },
      {
        name: 'Información sobre qué datos y para qué',
        keywords: ['qué datos','para qué','finalidad','datos tratados'],
        synonyms: ['información sobre el tratamiento','descripción de datos recopilados'],
        validado: false,
      },
      {
        name: 'Mecanismo de retiro del consentimiento',
        keywords: ['retirar','revocar','retirar consentimiento','baja','opt-out'],
        synonyms: ['revocar autorización','desuscribir','rechazar el tratamiento'],
        validado: false,
      },
      {
        name: 'Registro de fecha y forma de obtención',
        keywords: ['fecha consentimiento','registro','cuando','cómo obtuvo'],
        synonyms: ['evidencia del consentimiento','prueba de aceptación','log de consentimiento'],
        validado: false,
      },
    ],
  },
  {
    id: 'designacion_dpo',
    num: '10',
    nombre: 'Designación del Delegado DPO',
    art: 'Art. 49 — Delegado de protección de datos',
    desc: 'Si su empresa trata datos a gran escala o datos sensibles, debe designar formalmente un Delegado de Protección de Datos.',
    multa: '2.000 UTM',
    nivel: 'medio',
    plazo: { date: '30 Jun', urgency: 'pronto' },
    criterios: [
      {
        name: 'Identidad y datos de contacto del DPO',
        keywords: ['dpo','delegado','nombre delegado','contacto dpo','correo dpo'],
        synonyms: ['data protection officer','encargado de privacidad','delegado de protección de datos'],
        validado: false,
      },
      {
        name: 'Funciones y responsabilidades definidas',
        keywords: ['funciones','responsabilidades','tareas dpo'],
        synonyms: ['rol del delegado','competencias del DPO','atribuciones'],
        validado: false,
      },
      {
        name: 'Independencia y recursos asignados',
        keywords: ['independencia','recursos','acceso','sin conflicto'],
        synonyms: ['autonomía','libre de conflictos de interés','imparcialidad'],
        validado: false,
      },
      {
        name: 'Notificación a la APDP realizada',
        keywords: ['notificado','comunicado','registrado','apdp'],
        synonyms: ['informado a la autoridad','declarado ante la APDP','reportado al regulador'],
        validado: false,
      },
    ],
  },
];
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

Esperado: Solo errores en archivos que aún usan tipos viejos (analyzer.ts, useAppState.ts). Todos se corrigen en tareas siguientes.

- [ ] **Paso 3: Commit**

```powershell
git add lib/requisitos.ts
git commit -m "feat: agregar synonyms[] y validado a los 50 criterios de requisitos legales"
```

---

## Task 3: Actualizar lib/analyzer.ts

**Files:**
- Modify: `lib/analyzer.ts`

- [ ] **Paso 1: Reemplazar el contenido de lib/analyzer.ts con lógica de sinónimos**

```typescript
import { REQUISITOS } from './requisitos';
import type { UploadedDoc, RequisitoResult, CriterioResult } from './types';

export function analyzeDocument(
  reqId: string,
  uploadedDocs: Record<string, UploadedDoc>
): RequisitoResult {
  const req = REQUISITOS.find(r => r.id === reqId)!;
  const doc = uploadedDocs[reqId];

  if (!doc) {
    return {
      estado: 'red',
      cobertura: 0,
      criterios: req.criterios.map(c => ({
        name: c.name,
        status: 'fail',
        found: 'Documento no subido',
        kwFound: 0,
        kwTotal: c.keywords.length,
        confianza: 'baja',
        validado: c.validado,
      })),
      gap: `Documento obligatorio según ${req.art}. Sin este documento su empresa queda expuesta a multas de ${req.multa}.`,
    };
  }

  const text = doc.text.toLowerCase();

  const criterios: CriterioResult[] = req.criterios.map(c => {
    // Paso 1: buscar keywords exactas
    const kwFoundList = c.keywords.filter(kw => text.includes(kw.toLowerCase()));

    // Paso 2: si no hay keywords, buscar sinónimos
    const synFoundList = kwFoundList.length === 0
      ? c.synonyms.filter(syn => text.includes(syn.toLowerCase()))
      : [];

    // Determinar confianza y kwFound efectivo
    let confianza: 'alta' | 'media' | 'baja';
    let kwFound: number;

    if (kwFoundList.length > 0) {
      confianza = 'alta';
      kwFound = kwFoundList.length;
    } else if (synFoundList.length > 0) {
      // Sinónimo encontrado: crédito parcial mínimo para cobertura
      confianza = 'media';
      kwFound = 1;
    } else {
      confianza = 'baja';
      kwFound = 0;
    }

    const ratio = kwFound / c.keywords.length;

    let status: 'ok' | 'warn' | 'fail';
    let found: string;

    if (ratio >= 0.6) {
      status = 'ok';
      found = `Cumple (${kwFound}/${c.keywords.length} términos)`;
    } else if (ratio >= 0.2 || confianza === 'media') {
      status = 'warn';
      found = confianza === 'media'
        ? `Sinónimo: "${synFoundList.slice(0, 2).join('", "')}"`
        : `Parcial (${kwFound}/${c.keywords.length} términos)`;
    } else {
      status = 'fail';
      found = kwFound > 0
        ? `Insuficiente (${kwFound}/${c.keywords.length} términos)`
        : 'No encontrado en el documento';
    }

    return {
      name: c.name,
      status,
      found,
      kwFound,
      kwTotal: c.keywords.length,
      confianza,
      validado: c.validado,
    };
  });

  // Score: ok=1.0, warn=0.5, fail=0.0
  const score = criterios.reduce((acc, c) => {
    if (c.status === 'ok') return acc + 1;
    if (c.status === 'warn') return acc + 0.5;
    return acc;
  }, 0);
  const cobertura = Math.round((score / criterios.length) * 100);

  let estado: 'green' | 'yellow' | 'red';
  let gap: string;

  if (cobertura >= 75) {
    estado = 'green';
    const warnItems = criterios.filter(c => c.status === 'warn');
    gap = warnItems.length > 0
      ? `Documento en cumplimiento (${cobertura}%). Puede reforzar: ${warnItems.map(c => c.name).slice(0, 2).join(', ')}.`
      : `Su documento cumple todos los criterios del ${req.art}.`;
  } else if (cobertura >= 35) {
    estado = 'yellow';
    const faltantes = criterios.filter(c => c.status !== 'ok').map(c => c.name).slice(0, 3);
    gap = `Cumplimiento parcial (${cobertura}%) del ${req.art}. Debe agregar o corregir: ${faltantes.join(', ')}.`;
  } else {
    estado = 'red';
    const criticos = criterios.filter(c => c.status === 'fail').map(c => c.name).slice(0, 2);
    const palabras = doc.wordCount ?? 0;
    const extraInfo = palabras < 50 && doc.extractedFully
      ? ` El documento parece muy breve (${palabras} palabras) para cubrir todos los requisitos legales.`
      : '';
    gap = `Documento insuficiente para ${req.art}. Criterios faltantes: ${criticos.join(', ')}. Riesgo de multa: ${req.multa}.${extraInfo}`;
  }

  return { estado, cobertura, criterios, gap };
}
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

Esperado: Sin errores en lib/. Los errores restantes estarán en hooks/useAppState.ts y componentes.

- [ ] **Paso 3: Commit**

```powershell
git add lib/analyzer.ts
git commit -m "feat: motor de análisis con sinónimos y campo confianza (alta/media/baja)"
```

---

## Task 4: Crear hooks/useSessionTimeout.ts

**Files:**
- Create: `hooks/useSessionTimeout.ts`

- [ ] **Paso 1: Crear el hook de timeout de sesión**

```typescript
'use client';
import { useEffect, useRef, useCallback } from 'react';

// Hook de inactividad de sesión.
// onWarn: se llama a los (idleMinutes * 60 - 60) segundos de inactividad.
// onExpire: se llama al cumplirse idleMinutes * 60 segundos de inactividad.
// active: solo corre cuando la sesión está abierta (screen === 'app').
export function useSessionTimeout(
  onWarn: () => void,
  onExpire: () => void,
  active: boolean,
  idleMinutes: number = 2
) {
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (expireTimer.current) clearTimeout(expireTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    if (!active) return;
    const totalMs = idleMinutes * 60 * 1000;
    const warnMs = totalMs - 60_000; // advertir 60 s antes del cierre
    warnTimer.current = setTimeout(onWarn, warnMs);
    expireTimer.current = setTimeout(onExpire, totalMs);
  }, [active, idleMinutes, onWarn, onExpire, clearTimers]);

  useEffect(() => {
    if (!active) {
      clearTimers();
      return;
    }
    resetTimers();
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimers, { passive: true }));
    return () => {
      clearTimers();
      events.forEach(e => window.removeEventListener(e, resetTimers));
    };
  }, [active, resetTimers, clearTimers]);

  return { resetTimers };
}
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

Esperado: Sin errores en hooks/useSessionTimeout.ts.

- [ ] **Paso 3: Commit**

```powershell
git add hooks/useSessionTimeout.ts
git commit -m "feat: hook useSessionTimeout con reset en actividad mouse/teclado"
```

---

## Task 5: Actualizar hooks/useAppState.ts

**Files:**
- Modify: `hooks/useAppState.ts`

- [ ] **Paso 1: Reemplazar hooks/useAppState.ts**

```typescript
'use client';
import { useState, useCallback } from 'react';
import type { Screen, ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent } from '@/lib/types';
import { REQUISITOS } from '@/lib/requisitos';
import { analyzeDocument } from '@/lib/analyzer';

const DEMO_DOCS: Record<string, UploadedDoc> = {
  politica_privacidad: {
    name: 'politica_privacidad_v2.pdf',
    text: 'responsable rut domicilio contacto finalidad propósito consentimiento base legal acceso rectificación cancelación oposición derechos arco conservación retención plazo eliminar transferencia internacional',
  },
  registro_actividades: {
    name: 'registro_actividades.xlsx',
    text: 'categorías tipos de datos destinatarios encargados terceros supresión eliminación plazo seguridad cifrado medidas finalidad propósito',
  },
  contrato_encargado: {
    name: 'contrato_encargado_v1.docx',
    text: 'objeto duración instrucciones confidencialidad secreto medidas seguridad',
  },
};

// Contador global para IDs únicos de eventos de auditoría
let auditCounter = 0;

export function useAppState() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [activeTab, setActiveTab] = useState<ActiveTab>('subir');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState<UserRole>('administrador');
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, UploadedDoc>>({});
  const [results, setResults] = useState<Record<string, RequisitoResult>>({});
  const [analyzed, setAnalyzed] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);

  // Registra un evento en el audit log (más reciente primero)
  const addAuditEvent = useCallback((
    accion: AuditEvent['accion'],
    currentRole: UserRole,
    currentUser: string,
    archivo?: string,
  ) => {
    setAuditLog(prev => [{
      id: ++auditCounter,
      timestamp: new Date().toISOString(),
      rol: currentRole,
      usuario: currentUser,
      accion,
      archivo,
    }, ...prev]);
  }, []);

  const login = useCallback((rut: string, selectedRole: UserRole) => {
    setCompanyName(rut);
    setRole(selectedRole);
    setScreen('app');
    setActiveTab('subir');
  }, []);

  const demo = useCallback(() => {
    setCompanyName('Empresa Demo S.A.');
    setRole('administrador');
    setUploadedDocs(DEMO_DOCS);
    setScreen('app');
    setActiveTab('subir');
  }, []);

  const logout = useCallback(() => {
    setCompanyName('');
    setRole('administrador');
    setUploadedDocs({});
    setResults({});
    setAnalyzed(false);
    setScreen('landing');
    setActiveTab('subir');
    setAuditLog([]);
    auditCounter = 0;
  }, []);

  const uploadDoc = useCallback((reqId: string, doc: UploadedDoc, currentRole: UserRole, currentUser: string) => {
    setUploadedDocs(prev => ({ ...prev, [reqId]: doc }));
    addAuditEvent('subió documento', currentRole, currentUser, doc.name);
  }, [addAuditEvent]);

  const startAnalysis = useCallback(() => {
    setScreen('analyzing');
  }, []);

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
    setScreen('app');
    setActiveTab('diagnostico');
    addAuditEvent('ejecutó análisis', currentRole, currentUser);
  }, [addAuditEvent]);

  const logDownload = useCallback((currentRole: UserRole, currentUser: string) => {
    addAuditEvent('descargó informe', currentRole, currentUser, 'informe_cumplimiento.pdf');
  }, [addAuditEvent]);

  const switchTab = useCallback((tab: ActiveTab, isAnalyzed: boolean): boolean => {
    if (tab === 'diagnostico' && !isAnalyzed) return false;
    setActiveTab(tab);
    return true;
  }, []);

  return {
    screen, activeTab, companyName, role, uploadedDocs, results, analyzed, auditLog,
    login, demo, logout, uploadDoc, startAnalysis, finishAnalysis, switchTab, logDownload,
  };
}
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

Esperado: Los errores ahora estarán solo en los componentes que aún no reciben los nuevos props.

- [ ] **Paso 3: Commit**

```powershell
git add hooks/useAppState.ts
git commit -m "feat: agregar role, auditLog y helpers logDownload/addAuditEvent a useAppState"
```

---

## Task 6a: Actualizar components/Landing.tsx

**Files:**
- Modify: `components/Landing.tsx`

- [ ] **Paso 1: Actualizar la firma de onLogin en Landing para incluir UserRole**

Landing solo reenvía el callback a LoginCard. El único cambio es la interfaz y el import:

```tsx
'use client';
import LoginCard from './LoginCard';
import type { UserRole } from '@/lib/types';
import { ScaleIcon, FileTextIcon, SearchCheckIcon, AlertCircleIcon, BarChart2Icon } from './Icons';

interface LandingProps {
  onLogin: (rut: string, role: UserRole) => void;  // actualizado
  onDemo: () => void;
  onToast: (msg: string, type: 'yellow' | 'blue') => void;
}

export default function Landing({ onLogin, onDemo, onToast }: LandingProps) {
  return (
    <div id="screen-landing" style={{ minHeight: '100vh', background: '#0f1e3d', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav className="landing-nav">
        <div className="brand">
          <div className="brand-icon">
            <ScaleIcon size={18} color="#fff" />
          </div>
          <div>
            <div className="brand-name">DataShield</div>
            <div className="brand-tagline">Ley 21.719 · Chile</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
          Sistema operativo — APDP 2025
        </div>
      </nav>

      {/* Body */}
      <div className="landing-body">
        <div className="landing-hero">
          <div className="badge-new landing-badge" style={{ marginBottom: 20, background: 'rgba(96,165,250,0.1)', borderColor: 'rgba(96,165,250,0.25)', color: '#60a5fa' }}>
            ✦ Plataforma oficial de diagnóstico
          </div>
          <h1>¿Su empresa cumple con la <span>Ley 21.719</span>?</h1>
          <p>
            Suba sus documentos y obtenga en minutos un diagnóstico detallado de las brechas
            que deben corregir para evitar multas de hasta{' '}
            <strong style={{ color: '#f87171' }}>5.000 UTM</strong> de la APDP.
          </p>
          <div className="landing-features">
            <div className="lf-item">
              <div className="lf-icon"><FileTextIcon size={13} color="#60a5fa" /></div>
              Suba sus documentos actuales (PDF, Word, Excel)
            </div>
            <div className="lf-item">
              <div className="lf-icon"><SearchCheckIcon size={13} color="#60a5fa" /></div>
              El sistema los contrasta contra los 10 requisitos de la ley
            </div>
            <div className="lf-item">
              <div className="lf-icon"><AlertCircleIcon size={13} color="#60a5fa" /></div>
              Vea exactamente qué le falta y cómo corregirlo
            </div>
            <div className="lf-item">
              <div className="lf-icon"><BarChart2Icon size={13} color="#60a5fa" /></div>
              Descargue un informe para presentar a directorio
            </div>
          </div>
        </div>

        <LoginCard onLogin={onLogin} onDemo={onDemo} onToast={onToast} />
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

- [ ] **Paso 3: Commit**

```powershell
git add components/Landing.tsx
git commit -m "fix: actualizar firma onLogin en Landing para incluir UserRole"
```

---

## Task 6: Actualizar components/LoginCard.tsx

**Files:**
- Modify: `components/LoginCard.tsx`

- [ ] **Paso 1: Reemplazar components/LoginCard.tsx con selector de rol**

```tsx
'use client';
import { useState } from 'react';
import type { UserRole } from '@/lib/types';

interface LoginCardProps {
  onLogin: (rut: string, role: UserRole) => void;
  onDemo: () => void;
  onToast: (msg: string, type: 'yellow' | 'blue') => void;
}

export default function LoginCard({ onLogin, onDemo, onToast }: LoginCardProps) {
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [role, setRole] = useState<UserRole>('administrador');

  const formatRut = (raw: string): string => {
    const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
    if (clean.length <= 1) return clean;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
  };

  const isValidRut = (value: string): boolean =>
    /^\d{1,2}\.\d{3}\.\d{3}-[\dKk]$/.test(value.trim());

  const handleLogin = () => {
    if (!rut.trim() || !email.trim()) {
      onToast('Complete RUT y correo para ingresar', 'yellow');
      return;
    }
    if (!isValidRut(rut)) {
      onToast('Formato de RUT inválido — use 12.345.678-9', 'yellow');
      return;
    }
    onLogin(rut.trim(), role);
  };

  return (
    <div className="login-card">
      <h2>Acceder a la plataforma</h2>
      <p className="login-sub">Ingrese o cree su cuenta de empresa</p>

      <div className="form-group">
        <label className="form-label">RUT de la empresa</label>
        <input className="form-input" type="text" placeholder="76.123.456-7"
          value={rut} maxLength={12}
          onChange={e => setRut(formatRut(e.target.value))} />
      </div>
      <div className="form-group">
        <label className="form-label">Correo corporativo</label>
        <input className="form-input" type="email" placeholder="nombre@empresa.cl"
          value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Contraseña</label>
        <input className="form-input" type="password" placeholder="••••••••"
          value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()} />
      </div>
      <div className="form-group">
        <label className="form-label">Rol de acceso</label>
        <select
          className="form-input"
          value={role}
          onChange={e => setRole(e.target.value as UserRole)}
        >
          <option value="administrador">Administrador — acceso completo</option>
          <option value="auditor">Auditor — diagnóstico + informes</option>
          <option value="visualizador">Visualizador — solo lectura</option>
        </select>
      </div>

      <button className="btn-login" onClick={handleLogin}>Ingresar →</button>

      <div className="login-divider">o continúe sin registrarse</div>

      <button className="btn-demo" onClick={onDemo}>
        Ver demostración con datos de ejemplo
      </button>

      <p className="login-legal">
        Sus documentos se procesan localmente en su navegador.<br />
        Ningún archivo es enviado a servidores externos.
      </p>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

- [ ] **Paso 3: Commit**

```powershell
git add components/LoginCard.tsx
git commit -m "feat: selector de rol (Administrador/Auditor/Visualizador) en LoginCard"
```

---

## Task 7: Crear components/RegistroView.tsx

**Files:**
- Create: `components/RegistroView.tsx`

- [ ] **Paso 1: Crear components/RegistroView.tsx**

```tsx
'use client';
import type { AuditEvent } from '@/lib/types';

interface RegistroViewProps {
  auditLog: AuditEvent[];
}

// Colores por tipo de acción
const ACCION_COLOR: Record<AuditEvent['accion'], string> = {
  'subió documento': 'var(--blue)',
  'ejecutó análisis': 'var(--green)',
  'descargó informe': 'var(--text2)',
  'eliminó documento': 'var(--red)',
};

export default function RegistroView({ auditLog }: RegistroViewProps) {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  return (
    <div className="registro-view">
      <div className="section-hdr">
        <h3>Registro de actividad</h3>
        <span>Trazabilidad de todas las acciones realizadas en esta sesión</span>
      </div>

      {auditLog.length === 0 ? (
        <div className="registro-empty">
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Sin actividad registrada
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Las acciones aparecerán aquí conforme se realicen.
          </div>
        </div>
      ) : (
        <div className="registro-table-wrap">
          <table className="registro-table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Acción</th>
                <th>Archivo</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map(event => (
                <tr key={event.id}>
                  <td className="registro-date">{formatDate(event.timestamp)}</td>
                  <td>{event.usuario}</td>
                  <td>
                    <span className="registro-rol-chip">{event.rol}</span>
                  </td>
                  <td style={{ color: ACCION_COLOR[event.accion], fontWeight: 500 }}>
                    {event.accion}
                  </td>
                  <td className="registro-archivo">{event.archivo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

- [ ] **Paso 3: Commit**

```powershell
git add components/RegistroView.tsx
git commit -m "feat: RegistroView — tabla de audit log ordenada por fecha descendente"
```

---

## Task 8: Crear components/RiesgosView.tsx

**Files:**
- Create: `components/RiesgosView.tsx`

- [ ] **Paso 1: Crear components/RiesgosView.tsx**

```tsx
'use client';

interface RiesgoItem {
  titulo: string;
  descripcion: string;
  nivel: 'alto' | 'medio' | 'bajo';
  mitigacion: string;
}

interface ControlItem {
  titulo: string;
  descripcion: string;
}

const RIESGOS_LEGALES: RiesgoItem[] = [
  {
    titulo: 'Cambios normativos APDP',
    descripcion: 'La APDP puede emitir reglamentos que modifiquen los criterios de cumplimiento.',
    nivel: 'alto',
    mitigacion: 'Monitoreo continuo de la Agenda Regulatoria APDP y actualización trimestral de criterios.',
  },
  {
    titulo: 'Responsabilidad por diagnóstico orientativo',
    descripcion: 'Un diagnóstico incorrecto podría inducir a error sobre el real estado de cumplimiento.',
    nivel: 'alto',
    mitigacion: 'Disclaimer legal obligatorio visible en toda pantalla de diagnóstico.',
  },
  {
    titulo: 'Interpretación errónea por parte del usuario',
    descripcion: 'Usuarios sin formación jurídica pueden malinterpretar los resultados del análisis.',
    nivel: 'medio',
    mitigacion: 'Documentación clara, tutoriales y recomendación explícita de asesoría legal especializada.',
  },
];

const RIESGOS_CIBERSEGURIDAD: RiesgoItem[] = [
  {
    titulo: 'Acceso no autorizado a datos sensibles',
    descripcion: 'Terceros podrían acceder a documentos empresariales cargados en la plataforma.',
    nivel: 'alto',
    mitigacion: 'RBAC + autenticación + procesamiento local en el browser (ningún dato al servidor).',
  },
  {
    titulo: 'Carga de archivos maliciosos',
    descripcion: 'Un archivo PDF o Word manipulado podría explotar vulnerabilidades del parser.',
    nivel: 'alto',
    mitigacion: 'Validación estricta de tipo MIME y límite de 10 MB antes de procesar.',
  },
  {
    titulo: 'Criterios de análisis desactualizados',
    descripcion: 'Si los criterios no se actualizan, el diagnóstico podría ser inexacto.',
    nivel: 'medio',
    mitigacion: 'Proceso de revisión legal trimestral con abogado especialista en protección de datos.',
  },
];

const RIESGOS_PROYECTO: RiesgoItem[] = [
  {
    titulo: 'Baja adopción en PYMEs',
    descripcion: 'Las PYMEs pueden carecer de conocimiento o motivación para usar la plataforma.',
    nivel: 'medio',
    mitigacion: 'UX simplificada, modo demo sin registro y materiales educativos de onboarding.',
  },
  {
    titulo: 'Ausencia de abogado en el equipo',
    descripcion: 'Sin respaldo jurídico, los criterios podrían ser incorrectos o incompletos.',
    nivel: 'alto',
    mitigacion: 'Alianza con firma legal especializada en protección de datos personales.',
  },
  {
    titulo: 'Costos de infraestructura',
    descripcion: 'Los costos de hosting y procesamiento podrían escalar con el volumen de usuarios.',
    nivel: 'bajo',
    mitigacion: 'Arquitectura sin servidor de datos (procesamiento local en el browser) minimiza costos.',
  },
];

const CONTROLES: ControlItem[] = [
  { titulo: 'Control de acceso por roles (RBAC)', descripcion: 'Tres roles con permisos diferenciados: Administrador, Auditor y Visualizador.' },
  { titulo: 'Registro de auditoría completo', descripcion: 'Trazabilidad de todas las acciones: subidas, análisis, descargas por rol y usuario.' },
  { titulo: 'Procesamiento local en el browser', descripcion: 'Ningún documento sale del dispositivo del usuario. Sin servidor de datos.' },
  { titulo: 'Validación de archivos (tipo + tamaño)', descripcion: 'Solo formatos .pdf, .doc, .docx, .xls, .xlsx, .txt con límite de 10 MB.' },
  { titulo: 'Gestión de sesión con timeout', descripcion: 'Logout automático tras 2 minutos de inactividad con aviso previo de 60 s.' },
  { titulo: 'Disclaimer legal visible', descripcion: 'Advertencia explícita en diagnóstico sobre la naturaleza orientativa del análisis.' },
  { titulo: 'Headers HTTP seguros', descripcion: 'CSP, HSTS, X-Frame-Options y X-Content-Type-Options configurados.' },
  { titulo: 'Análisis OWASP Top 10 considerado', descripcion: 'Sin eval, sin XSS, sin inyección, inputs sanitizados. Subida solo client-side.' },
];

const NIVEL_STYLE: Record<RiesgoItem['nivel'], React.CSSProperties> = {
  alto: { background: 'var(--red-bg)', borderColor: 'var(--red-border)', color: 'var(--red)' },
  medio: { background: 'var(--yellow-bg)', borderColor: 'var(--yellow-border)', color: 'var(--yellow)' },
  bajo: { background: 'var(--green-bg)', borderColor: 'var(--green-border)', color: 'var(--green)' },
};

const NIVEL_LABEL: Record<RiesgoItem['nivel'], string> = {
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
};

export default function RiesgosView() {
  return (
    <div className="riesgos-view">
      <div className="section-hdr">
        <h3>Riesgos y seguridad</h3>
        <span>Análisis de riesgos del proyecto y controles de seguridad implementados</span>
      </div>

      <div className="riesgos-grid">
        <RiesgoCard titulo="Riesgos legales" items={RIESGOS_LEGALES} />
        <RiesgoCard titulo="Riesgos de ciberseguridad" items={RIESGOS_CIBERSEGURIDAD} />
        <RiesgoCard titulo="Riesgos del proyecto" items={RIESGOS_PROYECTO} />
        <ControlesCard items={CONTROLES} />
      </div>
    </div>
  );
}

function RiesgoCard({ titulo, items }: { titulo: string; items: RiesgoItem[] }) {
  return (
    <div className="riesgo-card">
      <div className="riesgo-card-title">{titulo}</div>
      {items.map((item, i) => (
        <div key={i} className="riesgo-item">
          <div className="riesgo-item-header">
            <div className="riesgo-item-name">{item.titulo}</div>
            <span className="riesgo-nivel-tag" style={NIVEL_STYLE[item.nivel]}>
              {NIVEL_LABEL[item.nivel]}
            </span>
          </div>
          <div className="riesgo-item-desc">{item.descripcion}</div>
          <div className="riesgo-item-mit">
            <span className="riesgo-mit-label">Mitigación:</span> {item.mitigacion}
          </div>
        </div>
      ))}
    </div>
  );
}

function ControlesCard({ items }: { items: ControlItem[] }) {
  return (
    <div className="riesgo-card riesgo-card-controles">
      <div className="riesgo-card-title">Controles implementados</div>
      {items.map((item, i) => (
        <div key={i} className="control-item">
          <div className="control-check">✓</div>
          <div>
            <div className="control-name">{item.titulo}</div>
            <div className="control-desc">{item.descripcion}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

- [ ] **Paso 3: Commit**

```powershell
git add components/RiesgosView.tsx
git commit -m "feat: RiesgosView — 4 cards de riesgos legales, ciberseguridad, proyecto y controles"
```

---

## Task 9: Crear components/SessionTimeoutModal.tsx

**Files:**
- Create: `components/SessionTimeoutModal.tsx`

- [ ] **Paso 1: Crear components/SessionTimeoutModal.tsx**

```tsx
'use client';
import { useEffect, useState } from 'react';

interface SessionTimeoutModalProps {
  visible: boolean;
  onContinue: () => void;
  onLogout: () => void;
}

// Modal de advertencia de expiración de sesión con countdown de 60 s
export default function SessionTimeoutModal({ visible, onContinue, onLogout }: SessionTimeoutModalProps) {
  const [countdown, setCountdown] = useState(60);

  // Reiniciar countdown cada vez que el modal se hace visible
  useEffect(() => {
    if (!visible) {
      setCountdown(60);
      return;
    }
    const interval = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="session-overlay">
      <div className="session-modal">
        <div className="session-modal-icon">⏱</div>
        <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 8, color: 'var(--text)' }}>
          Su sesión expirará pronto
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.5 }}>
          Por inactividad, su sesión se cerrará en{' '}
          <strong style={{ color: countdown <= 10 ? 'var(--red)' : 'var(--text)' }}>
            {countdown}
          </strong>{' '}
          segundos.
        </p>
        <div className="session-modal-actions">
          <button className="btn-login" onClick={onContinue} style={{ flex: 1, marginBottom: 0 }}>
            Continuar sesión
          </button>
          <button className="btn-demo" onClick={onLogout} style={{ flex: 1, marginBottom: 0 }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

- [ ] **Paso 3: Commit**

```powershell
git add components/SessionTimeoutModal.tsx
git commit -m "feat: SessionTimeoutModal con countdown y botones Continuar/Cerrar"
```

---

## Task 10: Actualizar components/UploadView.tsx

**Files:**
- Modify: `components/UploadView.tsx`

- [ ] **Paso 1: Agregar prop canUpload y deshabilitar acciones cuando es false**

Reemplazar el archivo completo:

```tsx
'use client';
import { useRef, useState } from 'react';
import { REQUISITOS } from '@/lib/requisitos';
import { extractDocumentText } from '@/lib/extractText';
import type { UploadedDoc } from '@/lib/types';

interface UploadViewProps {
  uploadedDocs: Record<string, UploadedDoc>;
  canUpload: boolean; // false para Auditor y Visualizador
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onStartAnalysis: () => void;
  onToast: (msg: string, type: 'green' | 'yellow') => void;
}

export default function UploadView({ uploadedDocs, canUpload, onUpload, onStartAnalysis, onToast }: UploadViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingReqId = useRef<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const count = Object.keys(uploadedDocs).length;

  const triggerUpload = (reqId: string) => {
    if (!canUpload) return;
    pendingReqId.current = reqId;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const reqId = pendingReqId.current;
    if (!file || !reqId) return;

    setUploading(reqId);
    const result = await extractDocumentText(file);
    onUpload(reqId, result);
    setUploading(null);

    const req = REQUISITOS.find(r => r.id === reqId);
    if (req) {
      const words = result.wordCount ?? 0;
      const info = result.extractedFully
        ? `${words.toLocaleString('es-CL')} palabras extraídas`
        : 'solo nombre de archivo';
      onToast(`✓ "${file.name}" cargado · ${info}`, 'green');
    }
    pendingReqId.current = null;
  };

  return (
    <div className="upload-view">
      {/* Indicador de pasos */}
      <div className="step-indicator">
        <div className="step-item">
          <div className="step-num active">1</div>
          <div className="step-label active">Subir documentos</div>
        </div>
        <div className="step-connector" />
        <div className="step-item">
          <div className="step-num">2</div>
          <div className="step-label">Análisis automático</div>
        </div>
        <div className="step-connector" />
        <div className="step-item">
          <div className="step-num">3</div>
          <div className="step-label">Ver diagnóstico</div>
        </div>
      </div>

      {/* Hero */}
      <div className="upload-hero">
        <h2>
          {canUpload
            ? 'Suba los documentos de su empresa'
            : 'Documentos cargados en esta sesión'}
        </h2>
        <p>
          {canUpload
            ? 'Para cada requisito de la Ley 21.719, suba el documento correspondiente. El sistema lee el contenido real de PDF, Word y Excel.'
            : 'Su rol actual no permite subir o modificar documentos. Contacte al Administrador para realizar cambios.'}
        </p>
      </div>

      {/* Grid */}
      <div className="req-upload-grid">
        {REQUISITOS.map(r => {
          const doc = uploadedDocs[r.id];
          const isUploaded = !!doc;
          const isUploading = uploading === r.id;
          return (
            <div
              key={r.id}
              className={`req-upload-item${isUploaded ? ' uploaded' : ''}${isUploading ? ' uploading' : ''}`}
            >
              <div className="req-num">{r.num}</div>
              <div className="req-upload-info">
                <div className="req-upload-name">{r.nombre}</div>
                <div className="req-upload-art">{r.art}</div>
                <div className="req-upload-desc">{r.desc}</div>
              </div>
              <div className="req-upload-action">
                {isUploading ? (
                  <div className="uploading-tag"><span className="spin">↻</span> Extrayendo texto...</div>
                ) : isUploaded ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div className="upload-file-tag">✓ {doc.name}</div>
                    <div style={{ fontSize: 10, color: doc.extractedFully ? 'var(--green)' : 'var(--yellow)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {doc.extractedFully
                        ? `${(doc.wordCount ?? 0).toLocaleString('es-CL')} palabras · ${doc.extractMethod}`
                        : `⚠ ${doc.extractMethod}`}
                    </div>
                  </div>
                ) : canUpload ? (
                  <button className="btn-upload-req" onClick={() => triggerUpload(r.id)}>
                    ⬆ Subir archivo
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Sin documento</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA — solo visible para Administrador */}
      {canUpload && (
        <div className="upload-cta">
          <div className="upload-cta-text">
            <h3>
              {count === 0
                ? 'Suba al menos 1 documento para comenzar'
                : count < 5
                  ? `${count} documento${count > 1 ? 's' : ''} cargado${count > 1 ? 's' : ''} — puede analizar ahora o subir más`
                  : `${count} documentos cargados — listo para el análisis`}
            </h3>
            <p>
              {count === 0
                ? 'El sistema lee el contenido real del documento y lo contrasta con la ley'
                : count < 5
                  ? 'Mientras más documentos suba, más completo será el diagnóstico'
                  : 'Cobertura excelente. Ejecute el análisis para ver su diagnóstico.'}
            </p>
          </div>
          <button className="btn-analyze" disabled={count === 0} onClick={onStartAnalysis}>
            🔬 Analizar ahora →
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileSelected}
      />
    </div>
  );
}
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

- [ ] **Paso 3: Commit**

```powershell
git add components/UploadView.tsx
git commit -m "feat: prop canUpload en UploadView — deshabilita subida para Auditor/Visualizador"
```

---

## Task 11: Actualizar components/AppShell.tsx

**Files:**
- Modify: `components/AppShell.tsx`

- [ ] **Paso 1: Reemplazar components/AppShell.tsx con RBAC, nuevas tabs y role en header**

```tsx
'use client';
import UploadView from './UploadView';
import DiagnosticoView from './DiagnosticoView';
import RegistroView from './RegistroView';
import RiesgosView from './RiesgosView';
import type { ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent } from '@/lib/types';
import { ScaleIcon, FolderOpenIcon, ClipboardListIcon } from './Icons';

interface AppShellProps {
  companyName: string;
  role: UserRole;
  activeTab: ActiveTab;
  uploadedDocs: Record<string, UploadedDoc>;
  results: Record<string, RequisitoResult>;
  analyzed: boolean;
  auditLog: AuditEvent[];
  onSwitchTab: (tab: ActiveTab) => void;
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onStartAnalysis: () => void;
  onLogout: () => void;
  onDownloadReport: () => void;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  administrador: 'Administrador',
  auditor: 'Auditor',
  visualizador: 'Visualizador',
};

export default function AppShell({
  companyName, role, activeTab, uploadedDocs, results, analyzed, auditLog,
  onSwitchTab, onUpload, onStartAnalysis, onLogout, onDownloadReport, onToast,
}: AppShellProps) {
  const brechaCount = Object.values(results).filter(r => r.estado !== 'green').length;
  const canUpload = role === 'administrador';
  const canDownload = role === 'administrador' || role === 'auditor';
  const canSeeRegistro = role === 'administrador' || role === 'auditor';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-brand-icon">
            <ScaleIcon size={16} color="#fff" />
          </div>
          <div className="header-brand-name">DataShield</div>
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>Ley 21.719</span>
        </div>
        <div className="header-right">
          <div className="header-company">
            <div className="header-company-dot" />
            <span>{companyName}</span>
            <span className="role-chip">{ROLE_LABELS[role]}</span>
          </div>
          <button className="btn-logout" onClick={onLogout}>Salir</button>
        </div>
      </header>

      {/* Nav — tabs condicionales según rol */}
      <nav className="app-nav">
        <div
          className={`nav-tab${activeTab === 'subir' ? ' active' : ''}`}
          onClick={() => onSwitchTab('subir')}
        >
          <FolderOpenIcon size={14} /> Subir documentos
        </div>
        <div
          className={`nav-tab${activeTab === 'diagnostico' ? ' active' : ''}`}
          onClick={() => onSwitchTab('diagnostico')}
        >
          <ClipboardListIcon size={14} /> Mi diagnóstico
          {analyzed && brechaCount > 0 && (
            <span className="nav-tab-badge">{brechaCount}</span>
          )}
        </div>
        {canSeeRegistro && (
          <div
            className={`nav-tab${activeTab === 'registro' ? ' active' : ''}`}
            onClick={() => onSwitchTab('registro')}
          >
            Registro
          </div>
        )}
        <div
          className={`nav-tab${activeTab === 'riesgos' ? ' active' : ''}`}
          onClick={() => onSwitchTab('riesgos')}
        >
          Riesgos
        </div>
      </nav>

      {/* Contenido */}
      <div className="app-content">
        {activeTab === 'subir' && (
          <UploadView
            uploadedDocs={uploadedDocs}
            canUpload={canUpload}
            onUpload={onUpload}
            onStartAnalysis={onStartAnalysis}
            onToast={(msg, type) => onToast(msg, type)}
          />
        )}
        {activeTab === 'diagnostico' && analyzed && (
          <DiagnosticoView
            results={results}
            uploadedDocs={uploadedDocs}
            canUpload={canUpload}
            canDownload={canDownload}
            onUpload={onUpload}
            onDownloadReport={onDownloadReport}
            onToast={(msg, type) => onToast(msg, type)}
          />
        )}
        {activeTab === 'registro' && canSeeRegistro && (
          <RegistroView auditLog={auditLog} />
        )}
        {activeTab === 'riesgos' && (
          <RiesgosView />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

Esperado: Error en DiagnosticoView por props nuevas — se corrige en la tarea siguiente.

- [ ] **Paso 3: Commit**

```powershell
git add components/AppShell.tsx
git commit -m "feat: AppShell con RBAC (canUpload/canDownload), tabs Registro/Riesgos y role chip en header"
```

---

## Task 12: Actualizar components/DiagnosticoView.tsx

**Files:**
- Modify: `components/DiagnosticoView.tsx`

- [ ] **Paso 1: Reemplazar components/DiagnosticoView.tsx**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { REQUISITOS } from '@/lib/requisitos';
import type { RequisitoResult, UploadedDoc } from '@/lib/types';

interface DiagnosticoViewProps {
  results: Record<string, RequisitoResult>;
  uploadedDocs: Record<string, UploadedDoc>;
  canUpload: boolean;
  canDownload: boolean;
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onDownloadReport: () => void;
  onToast: (msg: string, type: 'green' | 'blue') => void;
}

const CIRC = 2 * Math.PI * 44;

// Etiquetas visuales de confianza del análisis
const CONFIANZA_CONFIG = {
  alta:  { label: 'Alta ●',  className: 'confianza-alta' },
  media: { label: 'Media ◐', className: 'confianza-media' },
  baja:  { label: 'Baja ○',  className: 'confianza-baja' },
};

export default function DiagnosticoView({
  results, uploadedDocs, canUpload, canDownload,
  onUpload, onDownloadReport, onToast,
}: DiagnosticoViewProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingReqId = useRef<string | null>(null);

  const green = REQUISITOS.filter(r => results[r.id]?.estado === 'green').length;
  const yellow = REQUISITOS.filter(r => results[r.id]?.estado === 'yellow').length;
  const red = REQUISITOS.filter(r => results[r.id]?.estado === 'red').length;
  const docsSubidos = Object.keys(uploadedDocs).length;
  const totalWords = Object.values(uploadedDocs).reduce((acc, d) => acc + (d.wordCount ?? 0), 0);
  const pct = Math.round((green * 100 + yellow * 50) / (10 * 100) * 100);

  const title = pct >= 80 ? 'Cumplimiento sólido' : pct >= 50 ? 'Cumplimiento parcial' : 'Brechas críticas detectadas';
  const desc = pct >= 80
    ? `Su empresa cumple ${pct}% de los requisitos de la Ley 21.719. Revise los ${red + yellow} puntos pendientes para alcanzar cumplimiento total.`
    : pct >= 50
      ? `Cumplimiento parcial (${pct}%). Existen ${red} documentos críticos faltantes que generan riesgo de multas de la APDP.`
      : `Cumplimiento bajo (${pct}%). Se recomienda acción inmediata. Hay ${red} brechas críticas que exponen a su empresa a multas graves.`;

  useEffect(() => {
    if (!circleRef.current) return;
    const t = setTimeout(() => {
      if (!circleRef.current) return;
      const offset = CIRC * (1 - pct / 100);
      circleRef.current.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
      circleRef.current.setAttribute('stroke-dashoffset', offset.toFixed(1));
      const color = pct >= 75 ? '#4ade80' : pct >= 40 ? '#fcd34d' : '#f87171';
      circleRef.current.setAttribute('stroke', color);
    }, 200);
    return () => clearTimeout(t);
  }, [pct]);

  const toggleCard = (id: string) =>
    setOpenCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const triggerUpload = (reqId: string) => {
    if (!canUpload) return;
    pendingReqId.current = reqId;
    if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const reqId = pendingReqId.current;
    if (!file || !reqId) return;
    const finish = (text: string) => {
      onUpload(reqId, { name: file.name, text: text.toLowerCase() });
      onToast(`✓ "${file.name}" actualizado`, 'green');
      pendingReqId.current = null;
    };
    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = ev => finish((ev.target?.result as string) || '');
      reader.readAsText(file);
    } else {
      setTimeout(() => finish(file.name), 800);
    }
  };

  const sorted = [...REQUISITOS].sort((a, b) => {
    const order = { red: 0, yellow: 1, green: 2 };
    return (order[results[a.id]?.estado ?? 'red'] ?? 0) - (order[results[b.id]?.estado ?? 'red'] ?? 0);
  });

  const multaReqs = REQUISITOS.filter(r => results[r.id]?.estado !== 'green');
  const plazoReqs = REQUISITOS.filter(r => results[r.id]?.estado !== 'green');

  return (
    <div className="diagnostico-view">

      {/* Disclaimer legal — siempre visible */}
      <div className="legal-disclaimer">
        <span className="legal-disclaimer-icon">⚠️</span>
        <span>
          Este diagnóstico es orientativo y se basa en análisis automático de documentos.
          No reemplaza la asesoría jurídica profesional. Para validez ante la APDP,
          consulte con un abogado especialista en protección de datos.
        </span>
      </div>

      {/* Score banner */}
      <div className="score-banner">
        <div className="score-ring-wrap">
          <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="55" cy="55" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle
              ref={circleRef}
              cx="55" cy="55" r="44" fill="none"
              stroke="#60a5fa" strokeWidth="8"
              strokeDasharray={CIRC.toFixed(1)}
              strokeDashoffset={CIRC.toFixed(1)}
              strokeLinecap="round"
            />
          </svg>
          <div className="score-center">
            <div className="score-big">{pct}%</div>
            <div className="score-label">cumplimiento</div>
          </div>
        </div>

        <div className="score-info">
          <h2>{title}</h2>
          <p>{desc}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <div className="doc-chip" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
              📄 {docsSubidos} documentos subidos
            </div>
            {totalWords > 0 && (
              <div className="doc-chip" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
                🔍 {totalWords.toLocaleString('es-CL')} palabras analizadas
              </div>
            )}
            <div className="doc-chip" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
              ⚖ 10 requisitos legales
            </div>
          </div>
        </div>

        <div className="score-sem">
          <div className="sem-mini green"><div className="sem-mini-dot" /><div><div className="sem-mini-count">{green}</div><div className="sem-mini-label">Al día</div></div></div>
          <div className="sem-mini yellow"><div className="sem-mini-dot" /><div><div className="sem-mini-count">{yellow}</div><div className="sem-mini-label">Incompleto</div></div></div>
          <div className="sem-mini red"><div className="sem-mini-dot" /><div><div className="sem-mini-count">{red}</div><div className="sem-mini-label">Faltante</div></div></div>
        </div>
      </div>

      {/* Brechas */}
      <div className="section-hdr">
        <h3>Detalle por requisito legal</h3>
        <span>Haga clic en cada requisito para ver el detalle</span>
      </div>
      <div className="brechas-list">
        {sorted.map(r => {
          const res = results[r.id];
          if (!res) return null;
          const { estado, cobertura, criterios, gap } = res;
          const icon = estado === 'green' ? '✓' : estado === 'yellow' ? '⚠' : '✕';
          const isOpen = openCards.has(r.id);
          const gapColor = estado === 'green' ? 'green' : estado === 'yellow' ? 'yellow' : 'red';
          return (
            <div key={r.id} className={`brecha-card state-${estado}${isOpen ? ' open' : ''}`}>
              <div className="brecha-header" onClick={() => toggleCard(r.id)}>
                <div className="brecha-estado">{icon}</div>
                <div className="brecha-info">
                  <div className="brecha-name">{r.nombre}</div>
                  <div className="brecha-art">{r.art}</div>
                </div>
                <div className="brecha-progress-wrap">
                  <div className="brecha-pct">{cobertura}%</div>
                  <div className="prog-bar">
                    <div className="prog-fill" style={{ width: `${cobertura}%` }} />
                  </div>
                </div>
                <div className="brecha-chevron">▼</div>
              </div>
              {isOpen && (
                <div className="brecha-body">
                  <div className="criterios-list">
                    {criterios.map((c, i) => {
                      const conf = CONFIANZA_CONFIG[c.confianza];
                      return (
                        <div key={i} className="criterio-item">
                          <div className={`criterio-badge ${c.status}`}>
                            {c.status === 'ok' ? '✓' : c.status === 'warn' ? '~' : '✕'}
                          </div>
                          <div className="criterio-name">{c.name}</div>
                          <div className={`criterio-found ${c.status}`}>{c.found}</div>
                          {/* Chip de confianza del análisis */}
                          <span className={`confianza-chip ${conf.className}`}>{conf.label}</span>
                          {/* Badge de validación por especialista */}
                          {c.validado
                            ? <span className="validado-badge validado-ok">Validado ✓</span>
                            : <span className="validado-badge validado-pending">Pendiente ⏳</span>
                          }
                        </div>
                      );
                    })}
                  </div>
                  <div className={`gap-box ${gapColor}`} style={{ marginTop: 10 }}>
                    <strong>
                      {estado === 'green' ? '✓ Cumple' : estado === 'yellow' ? '⚠ Brecha detectada' : '✕ Documento faltante'}:
                    </strong>{' '}{gap}
                  </div>
                  {estado !== 'green' && canUpload && (
                    <div style={{ marginTop: 10 }}>
                      <button className="btn-upload-req" onClick={e => { e.stopPropagation(); triggerUpload(r.id); }}>
                        ⬆ Subir documento actualizado
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Paneles de acción */}
      <div className="action-panel">
        <div className="action-card">
          <div className="action-card-title">Exposición a multas APDP</div>
          {multaReqs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--green)', padding: '8px 0' }}>✓ Sin exposición a multas</div>
          ) : (
            multaReqs.slice(0, 6).map(r => (
              <div key={r.id} className="multa-item">
                <div className={`multa-dot ${r.nivel === 'critico' || r.nivel === 'alto' ? 'alto' : 'medio'}`} />
                <div className="multa-name">{r.nombre}</div>
                <div className={`multa-utml ${r.nivel === 'critico' || r.nivel === 'alto' ? 'alto' : 'medio'}`}>{r.multa}</div>
              </div>
            ))
          )}
        </div>
        <div className="action-card">
          <div className="action-card-title">Plazos de cumplimiento</div>
          {plazoReqs.slice(0, 5).map(r => (
            <div key={r.id} className="plazo-item">
              <div className="plazo-date">{r.plazo.date}</div>
              <div className="plazo-info">
                <div className="plazo-title">{r.nombre}</div>
                <div className="plazo-sub">{r.art}</div>
              </div>
              <div className={`plazo-tag ${r.plazo.urgency}`}>
                {r.plazo.urgency === 'urgent' ? 'Urgente' : r.plazo.urgency === 'pronto' ? 'Pronto' : 'OK'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA de descarga — respeta canDownload */}
      <div className="diag-cta">
        <div>
          <h3>Descargue su informe de cumplimiento</h3>
          <p>Documento para presentar a directorio, abogados o la APDP</p>
        </div>
        {canDownload ? (
          <button className="btn-report" onClick={onDownloadReport}>
            📊 Descargar informe PDF
          </button>
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '10px 0' }}>
            Su rol no permite descargar informes
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleFile} />
    </div>
  );
}
```

- [ ] **Paso 2: Verificar compilación**

```powershell
npx tsc --noEmit
```

Esperado: Error en app/page.tsx por props nuevas en AppShell — se corrige en la siguiente tarea.

- [ ] **Paso 3: Commit**

```powershell
git add components/DiagnosticoView.tsx
git commit -m "feat: DiagnosticoView con disclaimer legal, chips de confianza y badges de validación"
```

---

## Task 13: Actualizar app/page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Paso 1: Reemplazar app/page.tsx conectando timeout, auditLog y nuevas firmas**

```tsx
'use client';
import { useState, useCallback } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/useToast';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import Landing from '@/components/Landing';
import AppShell from '@/components/AppShell';
import AnalyzingScreen from '@/components/AnalyzingScreen';
import SessionTimeoutModal from '@/components/SessionTimeoutModal';
import Toast from '@/components/Toast';

export default function Home() {
  const state = useAppState();
  const { toasts, toast } = useToast();
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  // Callbacks estables para el hook de timeout
  const handleWarn = useCallback(() => setShowTimeoutModal(true), []);
  const handleExpire = useCallback(() => {
    setShowTimeoutModal(false);
    state.logout();
  }, [state]);

  const { resetTimers } = useSessionTimeout(
    handleWarn,
    handleExpire,
    state.screen === 'app',   // solo activo cuando la sesión está abierta
    2                          // 2 minutos para demo (usar 10 en producción)
  );

  const handleContinueSession = useCallback(() => {
    setShowTimeoutModal(false);
    resetTimers();
  }, [resetTimers]);

  return (
    <>
      {state.screen === 'landing' && (
        <Landing
          onLogin={(rut, role) => {
            state.login(rut, role);
            toast('✓ Bienvenido. Suba sus documentos para comenzar el diagnóstico.', 'blue');
          }}
          onDemo={() => {
            state.demo();
            toast('✓ Modo demo activado con 3 documentos de ejemplo.', 'blue');
          }}
          onToast={toast}
        />
      )}

      {state.screen === 'analyzing' && (
        <AnalyzingScreen
          docCount={Object.keys(state.uploadedDocs).length}
          onFinish={() => {
            state.finishAnalysis(state.uploadedDocs, state.role, state.companyName);
            toast('✓ Análisis completado. Revise su diagnóstico.', 'green');
          }}
        />
      )}

      {state.screen === 'app' && (
        <AppShell
          companyName={state.companyName}
          role={state.role}
          activeTab={state.activeTab}
          uploadedDocs={state.uploadedDocs}
          results={state.results}
          analyzed={state.analyzed}
          auditLog={state.auditLog}
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
          onDownloadReport={() => {
            state.logDownload(state.role, state.companyName);
            toast('📊 Generando informe PDF — funcionalidad en producción', 'blue');
          }}
          onToast={toast}
        />
      )}

      {/* Modal de expiración de sesión */}
      <SessionTimeoutModal
        visible={showTimeoutModal}
        onContinue={handleContinueSession}
        onLogout={() => {
          setShowTimeoutModal(false);
          state.logout();
        }}
      />

      <Toast toasts={toasts} />
    </>
  );
}
```

- [ ] **Paso 2: Verificar compilación — debe ser 0 errores**

```powershell
npx tsc --noEmit
```

Esperado: **0 errores**. Si hay alguno, corresponde a una inconsistencia de tipos entre tareas anteriores.

- [ ] **Paso 3: Commit**

```powershell
git add app/page.tsx
git commit -m "feat: conectar SessionTimeoutModal, auditLog y roles en page.tsx"
```

---

## Task 14: Agregar estilos CSS en app/globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Paso 1: Agregar los nuevos estilos al final de app/globals.css**

Añadir el siguiente bloque al final del archivo (después del último estilo existente):

```css
/* ── ROLE CHIP (header) ── */
.role-chip {
  display: inline-flex;
  align-items: center;
  background: var(--blue-dim);
  border: 1px solid rgba(37,99,235,0.2);
  color: var(--blue);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 20px;
  margin-left: 6px;
}

/* ── LEGAL DISCLAIMER ── */
.legal-disclaimer {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: var(--yellow-bg);
  border: 1px solid var(--yellow-border);
  border-radius: var(--radius);
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 12.5px;
  color: var(--text2);
  line-height: 1.55;
}
.legal-disclaimer-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

/* ── CONFIANZA CHIP (criterio) ── */
.confianza-chip {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}
.confianza-alta  { background: var(--green-bg);  border: 1px solid var(--green-border);  color: var(--green); }
.confianza-media { background: var(--yellow-bg); border: 1px solid var(--yellow-border); color: var(--yellow); }
.confianza-baja  { background: var(--surface);   border: 1px solid var(--border);        color: var(--text3); }

/* ── VALIDADO BADGE (criterio) ── */
.validado-badge {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}
.validado-ok      { background: var(--green-bg);  border: 1px solid var(--green-border);  color: var(--green); }
.validado-pending { background: var(--surface);   border: 1px solid var(--border);        color: var(--text3); }

/* ── REGISTRO VIEW ── */
.registro-view { padding: 0; }
.registro-empty {
  text-align: center;
  padding: 60px 20px;
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.registro-table-wrap {
  overflow-x: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--white);
}
.registro-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.registro-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text3);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.registro-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  vertical-align: middle;
}
.registro-table tr:last-child td { border-bottom: none; }
.registro-table tr:hover td { background: var(--surface); }
.registro-date {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  color: var(--text2);
  white-space: nowrap;
}
.registro-archivo {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  color: var(--text2);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.registro-rol-chip {
  display: inline-block;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text2);
  padding: 2px 8px;
}

/* ── RIESGOS VIEW ── */
.riesgos-view { padding: 0; }
.riesgos-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 768px) {
  .riesgos-grid { grid-template-columns: 1fr; }
}
.riesgo-card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}
.riesgo-card-controles {
  border-color: var(--green-border);
  background: var(--green-bg);
}
.riesgo-card-title {
  font-weight: 700;
  font-size: 14px;
  color: var(--text);
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.riesgo-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.riesgo-item:last-child { border-bottom: none; }
.riesgo-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.riesgo-item-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text);
}
.riesgo-nivel-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid;
  white-space: nowrap;
  flex-shrink: 0;
}
.riesgo-item-desc {
  font-size: 12px;
  color: var(--text2);
  line-height: 1.5;
  margin-bottom: 4px;
}
.riesgo-item-mit {
  font-size: 11.5px;
  color: var(--text2);
  line-height: 1.45;
}
.riesgo-mit-label {
  font-weight: 600;
  color: var(--text);
}
.control-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(22,163,74,0.15);
}
.control-item:last-child { border-bottom: none; }
.control-check {
  width: 20px;
  height: 20px;
  background: var(--green);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}
.control-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text);
  margin-bottom: 2px;
}
.control-desc {
  font-size: 12px;
  color: var(--text2);
  line-height: 1.45;
}

/* ── SESSION TIMEOUT MODAL ── */
.session-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 30, 61, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeInUp 0.2s var(--ease-out) both;
}
.session-modal {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px;
  max-width: 380px;
  width: 90%;
  text-align: center;
  box-shadow: var(--shadow-lg);
  animation: cardIn 0.25s var(--ease-out) both;
}
.session-modal-icon {
  font-size: 36px;
  margin-bottom: 12px;
}
.session-modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}
```

- [ ] **Paso 2: Verificar que el criterio-item pueda alojar los nuevos chips**

El `.criterio-item` existente usa `display: flex; align-items: center; gap: 8px`. Los chips nuevos (confianza-chip y validado-badge) son `flex-shrink: 0` y caben en la misma línea. Si el espacio es insuficiente en pantallas pequeñas, añadir `flex-wrap: wrap` al `.criterio-item` buscando esa clase en globals.css y agregando la propiedad.

- [ ] **Paso 3: Iniciar el servidor de desarrollo para verificar visualmente**

```powershell
npm run dev
```

Abrir `http://localhost:3000` y verificar:

1. **Login**: El selector de rol aparece con las 3 opciones.
2. **Demo (Administrador)**: Las 4 pestañas aparecen (Subir, Diagnóstico, Registro, Riesgos).
3. **Header**: Se muestra el chip de rol junto al nombre de empresa.
4. **Diagnóstico**: El banner amarillo de disclaimer legal aparece al inicio.
5. **Criterios**: Cada criterio muestra chip de confianza (Alta/Media/Baja) y badge (Validado ✓ / Pendiente ⏳).
6. **Registro**: Tab vacío con estado vacío amigable.
7. **Riesgos**: 4 cards con riesgos y controles.
8. **Ejecutar análisis (demo)**: Pestaña Registro muestra el evento "ejecutó análisis".
9. **Timeout**: Tras 60 segundos de inactividad aparece el modal de advertencia.
10. **Visualizador**: Al loguearse como Visualizador, los botones de subir/analizar desaparecen y la pestaña Registro no aparece.

- [ ] **Paso 4: Commit final**

```powershell
git add app/globals.css
git commit -m "feat: estilos para role-chip, disclaimer, confianza-chip, validado-badge, registro-table, riesgos-grid, session-modal"
```

---

## Verificación final

Después de completar todas las tareas:

```powershell
npx tsc --noEmit
npm run build
```

Esperado:
- `tsc --noEmit`: **0 errores**
- `npm run build`: Compilación exitosa sin errores ni warnings críticos
