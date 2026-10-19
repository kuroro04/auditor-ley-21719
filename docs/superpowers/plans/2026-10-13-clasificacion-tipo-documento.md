# Clasificación de tipo de documento y endurecimiento de evidencia — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que el motor de análisis puntúe documentos del tipo incorrecto (plan maestro, blog descriptivo) como si fueran políticas de privacidad, y hacer que las políticas reales escritas en lenguaje Ley 19.628 alcancen cobertura correcta.

**Architecture:** Se agrega una función de clasificación previa (`clasificarDocumento`) que detecta si el documento usa voz performativa (declara cumplimiento) o normativa (describe requisitos), y bloquea el análisis si se clasifica como `'incorrecto'`. Luego se endurecen tres reglas del motor de evidencia (Cambios 2–4) y se expande el vocabulario de frases legales para cubrir terminología 19.628.

**Tech Stack:** TypeScript, Vitest. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-13-clasificacion-tipo-documento-design.md`

## Global Constraints

- Mantener todas las interfaces y firmas de función existentes para el motor semántico (`buildRequisitoResult` es exportado y lo consume `semanticMatcher.ts` — no cambiar su firma ni tipo de retorno).
- `'wrong_type'` y `'unanalyzable'` solo los produce `analyzeDocument`, nunca `buildRequisitoResult`.
- Toda nueva evidencia penaliza la confianza, no excluye la evidencia binariamente (principio de consistencia del spec).
- Los sinónimos (`sinonimos.ts`) solo se evalúan cuando `kwsValidas === 0 AND frasesEncontradas === 0`.
- Los fixtures reales están en `__tests__/fixtures/`. El test file `__tests__/documentClassification.test.ts` ya existe y tiene tests `[POST-IMPL]` que deben pasar al final.

## Review Focus

- **Políticas en tercera persona formal sin ningún performativo de 1ª/2ª persona** — deben clasificar `'correcto'`, no `'dudoso'`. Verificar que los marcadores de 3ª persona están en la lista de performativos de `politica_privacidad` y cubren el caso Cencosud (Task 2).
- **Blog que contiene "finalidades del tratamiento" y "responsable del tratamiento"** — debe clasificar `'incorrecto'` por ausencia de performativos, no ser promovido por las nuevas frases legales. El gate de clasificación (Task 5) debe ejecutarse antes de cualquier evaluación de criterios. Test en Task 5.
- **Criterio con frase legal y exactamente 0 keywords** — debe producir `status: 'warn'`, `confianza: 'alta'` (Cambio 2). Test en Task 4, añadido a la descripción del Cambio 2.
- **Documento muy largo (9.000 palabras) con 3 menciones absolutas de un keyword** — la densidad relativa debe ser ~0.33/1000 palabras, debajo del umbral `1.0`, por lo que confianza debe ser `'media'` no `'alta'` para ese criterio. Test en Task 4 con fixture sintético.
- **`kwsEnContextoNormativo` en `CriterioResult`** — campo nuevo que el frontend no consume todavía; debe inicializarse a `[]` en todos los paths (no-doc, scanned, wrong_type, normal) para no romper la serialización. Verificar en Task 5.

---

## Mapa de archivos

| Archivo | Cambio | Task |
|---------|--------|------|
| `lib/types.ts` | Añadir `'wrong_type'`, `ClasificacionConfig`, `ClasificacionDocumentoResult`, campos nuevos en `CriterioResult` y `RequisitoResult`, campo `clasificacion` en `Requisito` | 1 |
| `lib/requisitos.ts` | Añadir campo `clasificacion` a los 10 `REQUISITOS` | 2 |
| `lib/analyzer.ts` | Nueva función `clasificarDocumento()`; endurecimiento de `evaluarCriterio()`; gate en `analyzeDocument()` | 3, 4, 5 |
| `lib/frasesLegales.ts` | Añadir frases 19.628 para 4 criterios de `politica_privacidad` | 6 |
| `lib/sinonimos.ts` | Añadir formas verbales y alternativas 19.628 | 6 |
| `__tests__/documentClassification.test.ts` | Ya existe — los tests `[POST-IMPL]` deben pasar al completar Task 5 | 5 |
| `__tests__/vocabularyRegression.test.ts` | Nuevo — tests de vocabulario independientes de la clasificación | 6 |
| `__tests__/analyzer.test.ts` | Reemplazar fixture de keyword-soup; verificar otros tests sin cambios | 7 |

---

### Task 1: Tipos — añadir interfaces y campos nuevos

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produce: `ClasificacionConfig`, `ClasificacionDocumentoResult` (usadas en Tasks 2, 3, 5)
- Produce: `CriterioResult` actualizado con `kwsEnContextoNormativo: string[]`
- Produce: `RequisitoResult` actualizado con `'wrong_type'` y `clasificacionDocumento?`
- Produce: `Requisito` actualizado con `clasificacion: ClasificacionConfig`

- [ ] **Step 1: Añadir los nuevos tipos en `lib/types.ts`**

Localizar el bloque de interfaces y aplicar estos cambios (no tocar ninguna otra interfaz):

```typescript
// Añadir ANTES de la interfaz Requisito:
export interface ClasificacionConfig {
  marcadoresPerformativos: string[];
  marcadoresNormativos: {
    tier1: string[];
    tier2: string[];
  };
}

export interface ClasificacionDocumentoResult {
  tipo: 'correcto' | 'dudoso' | 'incorrecto';
  razon: string;
  performativosEncontrados: string[];
  normativosEncontrados: string[];
}
```

En `interface Requisito`, añadir al final del cuerpo:
```typescript
  clasificacion: ClasificacionConfig;
```

En `interface CriterioResult`, añadir después del campo `densidad`:
```typescript
  kwsEnContextoNormativo: string[];
  densidadRelativa?: number;
```

En `interface RequisitoResult`, cambiar:
```typescript
  // DE:
  estado: 'green' | 'yellow' | 'red' | 'unanalyzable';
  // A:
  estado: 'green' | 'yellow' | 'red' | 'unanalyzable' | 'wrong_type';
```

Y añadir al final del cuerpo de `RequisitoResult`:
```typescript
  clasificacionDocumento?: ClasificacionDocumentoResult;
```

- [ ] **Step 2: Verificar que TypeScript compila sin errores de tipo**

```
npx tsc --noEmit
```

Errores esperados: todos los objetos que construyan `CriterioResult` ahora requieren `kwsEnContextoNormativo`. Habrá errores en `lib/analyzer.ts`. Eso es correcto — se corrigen en las tareas siguientes.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): agregar ClasificacionConfig, wrong_type y kwsEnContextoNormativo

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Datos de clasificación — campo `clasificacion` en los 10 requisitos

**Files:**
- Modify: `lib/requisitos.ts`

**Interfaces:**
- Consumes: `ClasificacionConfig` de `lib/types.ts` (Task 1)

- [ ] **Step 1: Verificar qué errores de TypeScript produce el cambio de Task 1 en requisitos.ts**

```
npx tsc --noEmit 2>&1 | grep requisitos
```

Si `Requisito` ahora requiere `clasificacion`, cada elemento del array `REQUISITOS` fallará hasta que se añada el campo.

- [ ] **Step 2: Añadir `clasificacion` a `politica_privacidad`**

Dentro del objeto `politica_privacidad` en `REQUISITOS`, al final (después de `criterios`):

```typescript
    clasificacion: {
      marcadoresPerformativos: [
        // 1ª / 2ª persona
        'tratamos sus datos', 'tratamos tus datos', 'sus datos personales son tratados',
        'usted tiene derecho a', 'usted puede ejercer', 'puede solicitar acceso',
        'nuestros datos de contacto', 'la empresa responsable es', 'somos responsables de',
        'recopilamos los siguientes datos', 'utilizamos sus datos para',
        'conservamos sus datos', 'le informamos que', 'datos del responsable',
        // 3ª persona formal (el responsable se nombra a sí mismo)
        'el usuario podrá', 'el titular podrá', 'el usuario tendrá', 'el titular tendrá',
        'representante legal corresponde', 'conservará los datos', 'consiente expresamente',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'el art.', 'el artículo', 'según el artículo',
          'el responsable debe', 'debe informar', 'la normativa requiere',
          'la empresa está obligada', 'este artículo establece', 'conforme a la ley',
        ],
        tier2: [
          'plan maestro', 'cronograma', 'etapa', 'hito',
          'análisis de cumplimiento', 'gestión de proyecto', 'equipo de proyecto',
          'diagnóstico de cumplimiento', 'brecha de cumplimiento',
        ],
      },
    },
```

- [ ] **Step 3: Añadir `clasificacion` a los 9 requisitos restantes**

Usar el mismo patrón. Tier 1 es transversal (mismo para todos). Tier 2 varía según el tipo de documento.

**`registro_actividades`:**
```typescript
    clasificacion: {
      marcadoresPerformativos: [
        'este registro contiene', 'hemos registrado las siguientes actividades',
        'el responsable registra', 'nuestras actividades de tratamiento',
        'los datos que tratamos son', 'las categorías de datos que tratamos',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe',
          'la normativa requiere', 'conforme al artículo', 'el registro debe incluir',
        ],
        tier2: [
          'plantilla de rat', 'tabla de actividades', 'inventario de tratamiento',
          'este template', 'guía de cumplimiento',
        ],
      },
    },
```

**`procedimiento_arco`:**
```typescript
    clasificacion: {
      marcadoresPerformativos: [
        'puede ejercer sus derechos enviando', 'para ejercer sus derechos contacte',
        'procesaremos su solicitud en', 'responderemos su solicitud en un plazo',
        'enviando su solicitud a', 'podrá ejercer sus derechos a través',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley establece que', 'según el artículo', 'el responsable debe responder',
          'la normativa obliga', 'el plazo legal es', 'conforme a la ley',
        ],
        tier2: [
          'procedimiento interno', 'este procedimiento', 'guía de derechos',
          'paso a paso', 'manual de atención',
        ],
      },
    },
```

**`contrato_encargado`:**
```typescript
    clasificacion: {
      marcadoresPerformativos: [
        'el encargado se obliga a', 'en virtud del presente contrato',
        'el presente contrato regula', 'el encargado tratará únicamente',
        'las partes acuerdan que', 'el encargado garantiza',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe',
          'la normativa requiere', 'el contrato debe incluir',
        ],
        tier2: [
          'este contrato tipo', 'modelo de contrato', 'plantilla contractual',
          'cláusula tipo',
        ],
      },
    },
```

**`evaluacion_impacto`:**
```typescript
    clasificacion: {
      marcadoresPerformativos: [
        'esta evaluación analiza', 'el presente estudio de impacto',
        'hemos identificado los siguientes riesgos', 'los riesgos analizados son',
        'la presente dpia concluye', 'el responsable ha evaluado',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe realizar',
          'la normativa requiere', 'cuando el tratamiento requiere', 'conforme al artículo',
        ],
        tier2: [
          'guía de evaluación', 'metodología de evaluación', 'paso a paso',
          'plantilla dpia', 'este análisis de cumplimiento',
        ],
      },
    },
```

**`politica_retencion`:**
```typescript
    clasificacion: {
      marcadoresPerformativos: [
        'los datos se conservarán durante', 'eliminaremos los datos tras',
        'esta política establece los plazos', 'destruiremos los datos cuando',
        'el plazo de conservación que aplicamos', 'conservamos los datos durante',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe',
          'la normativa establece', 'los datos deben eliminarse', 'conforme a la ley',
        ],
        tier2: [
          'política de retención', 'ciclo de vida del dato',
          'programa de gestión de datos', 'guía de retención', 'calendario de destrucción',
        ],
      },
    },
```

**`registro_rnpa`:**
```typescript
    clasificacion: {
      marcadoresPerformativos: [
        'inscrito en el rnpa con número', 'nuestra empresa está inscrita',
        'el número de inscripción es', 'inscripción vigente número',
        'nos encontramos registrados', 'registrado ante la apdp',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe inscribirse',
          'la normativa obliga', 'conforme al artículo', 'la obligación legal de inscripción',
        ],
        tier2: [
          'trámite de inscripción', 'formulario de registro',
          'guía de inscripción', 'requisitos para registrarse', 'cómo inscribirse',
        ],
      },
    },
```

**`plan_brechas`:**
```typescript
    clasificacion: {
      marcadoresPerformativos: [
        'ante una brecha procederemos a', 'notificaremos a la apdp en un plazo',
        'comunicaremos a los afectados', 'el protocolo establece que notificaremos',
        'en caso de incidente de seguridad', 'nuestro plan de respuesta ante brechas',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe notificar',
          'la normativa obliga a notificar', 'el plazo legal de notificación',
          'conforme al artículo',
        ],
        tier2: [
          'plan de respuesta a incidentes', 'guía de respuesta',
          'este plan de acción', 'protocolo de gestión',
        ],
      },
    },
```

**`consentimiento`:**
```typescript
    clasificacion: {
      marcadoresPerformativos: [
        'usted consiente expresamente', 'al aceptar esta política',
        'hemos obtenido su consentimiento', 'puede retirar su consentimiento enviando',
        'el titular ha otorgado su consentimiento', 'el consentimiento se obtiene mediante',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el consentimiento debe ser',
          'la normativa requiere', 'el consentimiento válido debe', 'conforme al artículo',
        ],
        tier2: [
          'formulario de consentimiento', 'gestión del consentimiento',
          'registro de consentimientos', 'base de datos de consentimientos',
        ],
      },
    },
```

**`designacion_dpo`:**
```typescript
    clasificacion: {
      marcadoresPerformativos: [
        'hemos designado como delegado de protección', 'el delegado de protección de datos nombrado',
        'nuestro dpo es', 'el dpo de esta organización es',
        'hemos nombrado a', 'el delegado designado es',
      ],
      marcadoresNormativos: {
        tier1: [
          'la ley exige', 'según el artículo', 'el responsable debe designar',
          'la normativa obliga', 'la obligación de designar', 'conforme al artículo',
        ],
        tier2: [
          'proceso de designación', 'convocatoria para dpo',
          'criterios de selección', 'perfil requerido para el dpo',
        ],
      },
    },
```

- [ ] **Step 4: Verificar compilación sin errores de tipo**

```
npx tsc --noEmit 2>&1 | grep -v analyzer
```

Solo deben quedar errores de `analyzer.ts` (por el campo `kwsEnContextoNormativo` que se añade en Task 4).

- [ ] **Step 5: Commit**

```bash
git add lib/requisitos.ts
git commit -m "feat(requisitos): agregar marcadores de clasificacion a los 10 requisitos

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Nueva función `clasificarDocumento()`

**Files:**
- Modify: `lib/analyzer.ts` (solo añadir la nueva función, sin tocar las existentes)

**Interfaces:**
- Consumes: `ClasificacionConfig`, `ClasificacionDocumentoResult` de `lib/types.ts` (Task 1)
- Produces: `clasificarDocumento(config, texto): ClasificacionDocumentoResult` (usada en Task 5)

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `__tests__/documentClassification.test.ts` (antes del último cierre) un nuevo describe:

```typescript
// ── Tests unitarios de clasificarDocumento — importar cuando exista ──────────
// Descomenta este bloque en Task 3 del plan de implementación.
// import { clasificarDocumento } from '../lib/analyzer';
```

Crear `__tests__/clasificarDocumento.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// La función se exporta en Task 3; hasta entonces este import falla
// y el test suite completo falla — eso es lo esperado.
import { clasificarDocumento } from '../lib/analyzer';
import { REQUISITOS } from '../lib/requisitos';

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8').toLowerCase();
}

const configPP = REQUISITOS.find(r => r.id === 'politica_privacidad')!.clasificacion;

describe('clasificarDocumento — politica_privacidad', () => {
  it('F1 Plan Maestro → incorrecto (0 performativos, ≥3 tier2)', () => {
    const texto = loadFixture('plan-maestro-proyecto.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.tipo).toBe('incorrecto');
    expect(res.performativosEncontrados).toHaveLength(0);
  });

  it('F2 Centro Médico → correcto (tiene performativos)', () => {
    const texto = loadFixture('politica-privacidad-completa.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.tipo).toBe('correcto');
    expect(res.performativosEncontrados.length).toBeGreaterThan(0);
  });

  it('F3 Escuela de Seguros → correcto (tiene performativos)', () => {
    const texto = loadFixture('politica-privacidad-concisa.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.tipo).toBe('correcto');
  });

  it('F4 Cencosud (tercera persona) → correcto (performativos de tercera persona formal)', () => {
    const texto = loadFixture('politica-tercera-persona.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.tipo).toBe('correcto');
    // Verificar que al menos uno de los marcadores de tercera persona fue detectado
    const marcadoresTerceraPersona = [
      'el usuario podrá', 'el usuario tendrá', 'representante legal corresponde',
      'conservará los datos', 'consiente expresamente',
    ];
    const encontrados = res.performativosEncontrados.filter(m =>
      marcadoresTerceraPersona.includes(m)
    );
    expect(encontrados.length).toBeGreaterThan(0);
  });

  it('F5 Artículo de blog → incorrecto (0 performativos)', () => {
    const texto = loadFixture('articulo-sobre-la-ley.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.tipo).toBe('incorrecto');
    expect(res.performativosEncontrados).toHaveLength(0);
  });

  it('razon explica la clasificación y no está vacía', () => {
    const texto = loadFixture('plan-maestro-proyecto.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.razon.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Ejecutar el test para confirmar que falla**

```
npx vitest run __tests__/clasificarDocumento.test.ts
```

Error esperado: `SyntaxError: The requested module ... does not provide an export named 'clasificarDocumento'`

- [ ] **Step 3: Implementar `clasificarDocumento` en `lib/analyzer.ts`**

Añadir al inicio del archivo, en la sección de CONSTANTES (después de `RADIO_FRAGMENTO`):

```typescript
// Marcadores de contexto normativo — indican que un keyword fue encontrado
// en un párrafo descriptivo, no en una declaración de cumplimiento.
const MARCADORES_CONTEXTO_NORMATIVO = [
  'la ley', 'el art.', 'el artículo', 'según el', 'conforme al',
  'la norma', 'la normativa', 'exige que', 'obliga a', 'requiere que',
  'establece que', 'dispone que',
];
```

Añadir importación al inicio del archivo:

```typescript
import type { UploadedDoc, RequisitoResult, CriterioResult, Requisito, ClasificacionConfig, ClasificacionDocumentoResult } from './types';
```

Añadir la función ANTES de `evaluarCriterio` (después de las funciones auxiliares):

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// CLASIFICACIÓN DEL TIPO DE DOCUMENTO (paso previo a la evaluación)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clasifica si el documento ES del tipo esperado o HABLA SOBRE ese tipo.
 * Un documento que cumple usa voz performativa; uno que describe usa voz normativa.
 */
export function clasificarDocumento(
  config: ClasificacionConfig,
  texto: string,
): ClasificacionDocumentoResult {
  const performativosEncontrados = config.marcadoresPerformativos.filter(m =>
    texto.includes(m.toLowerCase())
  );
  const normativosTier1 = config.marcadoresNormativos.tier1.filter(m =>
    texto.includes(m.toLowerCase())
  );
  const normativosTier2 = config.marcadoresNormativos.tier2.filter(m =>
    texto.includes(m.toLowerCase())
  );

  const nPerf = performativosEncontrados.length;
  const nT1   = normativosTier1.length;
  const nT2   = normativosTier2.length;

  let tipo: 'correcto' | 'dudoso' | 'incorrecto';
  let razon: string;

  if (nPerf >= 1) {
    if (nT1 < nPerf * 3) {
      tipo  = 'correcto';
      razon = `Documento con voz performativa (${nPerf} marcador${nPerf > 1 ? 'es' : ''} encontrado${nPerf > 1 ? 's' : ''}).`;
    } else {
      tipo  = 'dudoso';
      razon = `Señales mixtas: ${nPerf} performativo${nPerf > 1 ? 's' : ''} pero ${nT1} marcador${nT1 > 1 ? 'es' : ''} normativos Tier 1 — posible documento híbrido.`;
    }
  } else if (nT1 >= 2) {
    tipo  = 'incorrecto';
    razon = `El documento usa lenguaje normativo (${nT1} marcadores Tier 1: describe lo que "la ley exige" o "el responsable debe") sin declarar cumplimiento en primera persona.`;
  } else if (nT1 === 1 && nT2 >= 2) {
    tipo  = 'incorrecto';
    razon = `Lenguaje normativo combinado con vocabulario de gestión/consultoría (${nT1} Tier 1 + ${nT2} Tier 2).`;
  } else if (nT2 >= 3) {
    tipo  = 'incorrecto';
    razon = `Vocabulario específico de documentos de gestión (${nT2} marcadores Tier 2: ${normativosTier2.slice(0, 3).join(', ')}) sin ningún marcador performativo.`;
  } else {
    tipo  = 'dudoso';
    razon = 'Evidencia insuficiente para clasificar el tipo de documento con certeza.';
  }

  return {
    tipo,
    razon,
    performativosEncontrados,
    normativosEncontrados: [...normativosTier1, ...normativosTier2],
  };
}
```

- [ ] **Step 4: Ejecutar el test y confirmar que pasa**

```
npx vitest run __tests__/clasificarDocumento.test.ts
```

Todos los tests deben pasar. Si F4 (Cencosud) falla, revisar que "el usuario podrá" o "conservará los datos" aparecen en el texto del fixture (el texto viene en lowercase en el test porque el helper no hace toLowerCase — hay que verificar).

> Nota: El fixture F4 se pasa tal cual desde el archivo. La función `clasificarDocumento` recibe el texto lowercased porque en `analyzeDocument` se pasa `doc.text.toLowerCase()`. En el test, `loadFixture` devuelve el texto en lowercase por el `.toLowerCase()` al final. Confirmar que ese `.toLowerCase()` está en el helper del test.

- [ ] **Step 5: Commit**

```bash
git add lib/analyzer.ts lib/types.ts __tests__/clasificarDocumento.test.ts
git commit -m "feat(analyzer): implementar clasificarDocumento para detectar voz performativa vs normativa

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Endurecer `evaluarCriterio()` — Cambios 2, 3 y 4

**Files:**
- Modify: `lib/analyzer.ts` (solo dentro de `evaluarCriterio` y su interfaz interna `EvaluacionCriterio`)

**Interfaces:**
- La firma pública de `evaluarCriterio` cambia para recibir `wordCount?: number`.
- `EvaluacionCriterio` gana `kwsEnContextoNormativo: string[]` y `densidadRelativa: number`.
- `buildRequisitoResult` y `analyzeDocument` no se modifican en esta task.

- [ ] **Step 1: Escribir tests sintéticos que fallan (Cambios 2, 3, 4)**

Crear `__tests__/evaluarCriterio.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeDocument } from '../lib/analyzer';
import type { UploadedDoc } from '../lib/types';

function makeDoc(text: string, wordCount?: number): Record<string, UploadedDoc> {
  const wc = wordCount ?? text.trim().split(/\s+/).length;
  return {
    politica_privacidad: {
      name: 'test.txt',
      text: text.toLowerCase(),
      wordCount: wc,
      extractedFully: true,
    },
  };
}

// ── Cambio 2: Frase legal sola no basta para 'ok' ────────────────────────────

describe('Cambio 2 — frase legal sin keyword → warn, no ok', () => {
  it('criterio con frase legal exacta pero cero keywords → status warn, confianza alta', () => {
    // "plazo de conservación" es frase legal del criterio Plazo, pero
    // "conservación", "retención", "plazo", "tiempo", "eliminar" no aparecen
    // como palabras sueltas en este texto minimalista.
    const texto = 'el plazo de conservación de los datos se rige por la normativa vigente.';
    const docs = makeDoc(texto, 15);
    const res = analyzeDocument('politica_privacidad', docs);
    const criterioConFraseSinKw = res.criterios.find(c =>
      c.frasesLegalesEncontradas.length > 0 && c.kwFound === 0
    );
    expect(criterioConFraseSinKw).toBeDefined();
    expect(criterioConFraseSinKw?.status).toBe('warn');
    expect(criterioConFraseSinKw?.confianza).toBe('alta');
  });

  it('criterio con frase legal + al menos 1 keyword → status ok', () => {
    // "plazo de conservación" (frase) + "tiempo" (keyword) → ok
    const texto = 'indicamos el plazo de conservación de nuestros datos: durante el tiempo que sea necesario.';
    const docs = makeDoc(texto);
    const res = analyzeDocument('politica_privacidad', docs);
    const criterio = res.criterios.find(c => c.name.includes('Plazo'));
    expect(criterio?.status).toBe('ok');
  });

  it('ningún criterio tiene status ok solo por frase legal sin keyword', () => {
    // Solo frases legales, sin keywords sueltas, en un texto muy corto
    const texto = `
      derecho de acceso a sus datos personales.
      derecho de rectificación de sus datos.
      plazo de conservación de los datos establecido.
      responsable del tratamiento identificado.
      finalidad del tratamiento declarada.
    `;
    const docs = makeDoc(texto, 30);
    const res = analyzeDocument('politica_privacidad', docs);
    const okSinKw = res.criterios.filter(c =>
      c.frasesLegalesEncontradas.length > 0 && c.kwFound === 0 && c.status === 'ok'
    );
    expect(okSinKw).toHaveLength(0);
  });
});

// ── Cambio 3: Densidad relativa ───────────────────────────────────────────────

describe('Cambio 3 — densidad relativa afecta la confianza', () => {
  it('mismo count de keywords en doc largo → confianza menor o igual que en doc corto', () => {
    const base = 'responsable rut domicilio';
    const relleno = 'texto irrelevante sobre gestión empresarial sin datos';
    const corto = Array(15).fill(relleno).join(' ') + ' ' + base;
    const largo = Array(700).fill(relleno).join(' ') + ' ' + base;

    const resCorto = analyzeDocument('politica_privacidad', makeDoc(corto));
    const resLargo = analyzeDocument('politica_privacidad', makeDoc(largo));

    const orden: Record<string, number> = { alta: 2, media: 1, baja: 0 };
    const critCorto = resCorto.criterios.find(c => c.name.includes('Identidad'));
    const critLargo = resLargo.criterios.find(c => c.name.includes('Identidad'));
    if (critCorto && critLargo) {
      expect(orden[critLargo.confianza]).toBeLessThanOrEqual(orden[critCorto.confianza]);
    }
  });

  it('doc muy largo con pocas menciones no alcanza confianza alta solo por keywords', () => {
    // 7000 palabras de relleno + 1 mención de "responsable" y "rut"
    const relleno = 'palabra irrelevante sin relación alguna con privacidad ni datos';
    const texto = Array(7000).fill(relleno).join(' ') + ' responsable rut domicilio';
    const docs = makeDoc(texto, 7003);
    const res = analyzeDocument('politica_privacidad', docs);
    const identidad = res.criterios.find(c => c.name.includes('Identidad'));
    // Con densidad relativa muy baja y sin frase legal, no debe ser 'alta'
    expect(identidad?.confianza).not.toBe('alta');
  });
});

// ── Cambio 4: Contexto normativo como penalizador de confianza ────────────────

describe('Cambio 4 — contexto normativo penaliza confianza', () => {
  it('kwsEnContextoNormativo está presente en CriterioResult', () => {
    const texto = 'según el artículo la ley exige que el responsable informe el plazo de conservación.';
    const docs = makeDoc(texto);
    const res = analyzeDocument('politica_privacidad', docs);
    res.criterios.forEach(c => {
      expect(Array.isArray(c.kwsEnContextoNormativo)).toBe(true);
    });
  });

  it('keyword encontrado inmediatamente después de "la ley exige" se registra en kwsEnContextoNormativo', () => {
    // "plazo" es keyword del criterio Plazo; está precedido por "la ley exige que"
    const texto = 'la ley exige que el responsable defina el plazo de conservación.';
    const docs = makeDoc(texto);
    const res = analyzeDocument('politica_privacidad', docs);
    const criterioConContexto = res.criterios.find(c =>
      c.name.includes('Plazo') && c.kwsEnContextoNormativo.length > 0
    );
    expect(criterioConContexto).toBeDefined();
  });
});
```

- [ ] **Step 2: Ejecutar tests para confirmar que fallan**

```
npx vitest run __tests__/evaluarCriterio.test.ts
```

Los tests del Cambio 2 fallarán porque actualmente `frasesEncontradas.length > 0` solo produce `ok`. Los del Cambio 3 y 4 fallarán porque `kwsEnContextoNormativo` no existe aún en `CriterioResult`.

- [ ] **Step 3: Añadir `enContextoNormativo` helper y constante en `lib/analyzer.ts`**

Ya se añadió `MARCADORES_CONTEXTO_NORMATIVO` en Task 3. Añadir la función helper después de `calcularProximidad`:

```typescript
/**
 * Comprueba si en las 8 palabras anteriores a posKeyword hay algún marcador
 * normativo (la ley, el artículo, según el...). Indica que el keyword fue
 * encontrado en un contexto descriptivo, no en una declaración performativa.
 */
function enContextoNormativo(palabras: string[], posKeyword: number): boolean {
  const inicio = Math.max(0, posKeyword - 8);
  const ventana = palabras.slice(inicio, posKeyword).join(' ');
  return MARCADORES_CONTEXTO_NORMATIVO.some(m => ventana.includes(m));
}
```

- [ ] **Step 4: Actualizar `EvaluacionCriterio` y `evaluarCriterio` en `lib/analyzer.ts`**

Reemplazar la interfaz `EvaluacionCriterio` (líneas 130–141):

```typescript
interface EvaluacionCriterio {
  frasesEncontradas: string[];
  kwsValidas: string[];
  kwsNegadas: string[];
  kwsEnContextoNormativo: string[];
  sinonimosValidos: string[];
  densidad: number;
  densidadRelativa: number;
  proximidad: boolean;
  requiereRevisionManual: boolean;
  status: 'ok' | 'warn' | 'fail';
  confianza: 'alta' | 'media' | 'baja';
  fragmento: string;
}
```

Reemplazar la firma de `evaluarCriterio` (añadir `wordCount?`):

```typescript
function evaluarCriterio(
  texto: string,
  palabras: string[],
  keywords: string[],
  synonyms: string[],
  frasesLegales: string[],
  wordCount?: number,
): EvaluacionCriterio {
```

Reemplazar el bloque de keywords (sección 2, líneas ~160–180) para detectar contexto normativo:

```typescript
  // ── 2. Keywords: separar válidas de negadas; detectar contexto normativo ──
  const kwsValidas: string[] = [];
  const kwsNegadas: string[] = [];
  const kwsEnContextoNormativo: string[] = [];

  for (const kw of keywords) {
    const posiciones = encontrarPosiciones(palabras, kw);
    let hayValida = false;
    let hayNegada = false;
    let primeraValidaEnNormativo = false;

    for (const pos of posiciones) {
      if (detectarNegacion(palabras, pos)) {
        hayNegada = true;
      } else {
        hayValida = true;
        primeraValidaEnNormativo = enContextoNormativo(palabras, pos);
        break;
      }
    }

    if (hayValida) {
      kwsValidas.push(kw);
      if (primeraValidaEnNormativo) kwsEnContextoNormativo.push(kw);
    } else if (hayNegada) {
      kwsNegadas.push(kw);
    }
  }
```

Añadir cálculo de densidad relativa en la sección 4 (después de `calcularDensidad`):

```typescript
  // ── 4. Densidad de menciones ───────────────────────────────────────────
  const densidad = calcularDensidad(texto, [...keywords, ...frasesLegales]);
  const docWords = wordCount ?? palabras.length;
  const densidadRelativa = docWords > 0 ? (densidad * 1000) / docWords : densidad;
```

Reemplazar el bloque de **status** (sección 7, líneas ~212–223) con las nuevas reglas del Cambio 2:

```typescript
  // ── 7. Determinar status (Cambio 2: frase legal sola → warn, no ok) ────
  const umbralOk = Math.max(1, Math.ceil(keywords.length * 0.6));
  let status: 'ok' | 'warn' | 'fail';

  if (
    (frasesEncontradas.length >= 1 && kwsValidas.length >= 1) ||
    kwsValidas.length >= umbralOk
  ) {
    status = 'ok';
  } else if (
    frasesEncontradas.length >= 1 ||
    kwsValidas.length > 0 ||
    sinonimosValidos.length > 0 ||
    requiereRevisionManual
  ) {
    status = 'warn';
  } else {
    status = 'fail';
  }
```

Reemplazar el bloque de **confianza** (sección 8, líneas ~225–246) con Cambios 3 y 4:

```typescript
  // ── 8. Determinar confianza (Cambios 3 y 4) ───────────────────────────
  const UMBRAL_DENSIDAD_RELATIVA = 1.0;
  let confianza: 'alta' | 'media' | 'baja';

  if (frasesEncontradas.length >= 1 && kwsValidas.length >= 1) {
    confianza = 'alta';
  } else if (frasesEncontradas.length >= 1 && kwsValidas.length === 0) {
    // Frase legal sola: confianza alta (saber la frase exacta es señal fuerte)
    confianza = 'alta';
  } else if (
    kwsValidas.length >= umbralOk &&
    densidadRelativa > UMBRAL_DENSIDAD_RELATIVA &&
    proximidad
  ) {
    confianza = 'alta';
  } else if (
    kwsValidas.length >= umbralOk &&
    (densidadRelativa > UMBRAL_DENSIDAD_RELATIVA || proximidad)
  ) {
    confianza = 'alta';
  } else if (kwsValidas.length >= umbralOk) {
    confianza = 'media';
  } else if (kwsValidas.length > 0 || sinonimosValidos.length > 0) {
    confianza = 'media';
  } else {
    confianza = 'baja';
  }

  // Cambio 4: contexto normativo penaliza confianza un nivel (alta→media)
  if (
    kwsEnContextoNormativo.length > 0 &&
    kwsEnContextoNormativo.length > kwsValidas.length / 2
  ) {
    if (confianza === 'alta') confianza = 'media';
  }

  // Revisión manual baja confianza
  if (requiereRevisionManual && confianza === 'alta') confianza = 'media';
```

Reemplazar el `return` al final de `evaluarCriterio` para incluir los campos nuevos:

```typescript
  return {
    frasesEncontradas,
    kwsValidas,
    kwsNegadas,
    kwsEnContextoNormativo,
    sinonimosValidos,
    densidad,
    densidadRelativa,
    proximidad,
    requiereRevisionManual,
    status,
    confianza,
    fragmento,
  };
```

- [ ] **Step 5: Ejecutar los tests y confirmar que pasan**

```
npx vitest run __tests__/evaluarCriterio.test.ts
```

Si algún test del Cambio 2 falla revisar si el texto sintético tiene una keyword suelta además de la frase legal (el texto minimalista del primer test fue diseñado para evitarlo — verificar que "conservación" no aparece como palabra suelta en esa oración).

- [ ] **Step 6: Ejecutar el suite completo para detectar regresiones**

```
npx vitest run
```

Los tests `[BASELINE]` que antes pasaban deben seguir pasando. Los tests `[POST-IMPL]` aún fallan porque el gate de clasificación no está wired (Task 5).

- [ ] **Step 7: Commit**

```bash
git add lib/analyzer.ts __tests__/evaluarCriterio.test.ts
git commit -m "feat(analyzer): endurecer evaluarCriterio con Cambios 2, 3 y 4 (densidad relativa, contexto normativo)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Wiring — gate de clasificación en `analyzeDocument()`

**Files:**
- Modify: `lib/analyzer.ts` (solo `analyzeDocument` y el objeto `CriterioResult` que construye)

**Interfaces:**
- Consumes: `clasificarDocumento` (Task 3), `evaluarCriterio` actualizada (Task 4)
- Produces: `RequisitoResult` con `'wrong_type'` y `clasificacionDocumento?`

- [ ] **Step 1: Actualizar la llamada a `evaluarCriterio` en `analyzeDocument`**

En el map de criterios (alrededor de línea 329), cambiar la llamada para pasar `doc.wordCount`:

```typescript
  const criterios: CriterioResult[] = req.criterios.map(c => {
    const ev = evaluarCriterio(texto, palabras, c.keywords, c.synonyms, c.frasesLegales, doc.wordCount);
```

Y en la construcción del `CriterioResult` devuelto (alrededor de línea 354), añadir los campos nuevos:

```typescript
    return {
      name: c.name,
      status: ev.status,
      found,
      kwFound: ev.kwsValidas.length,
      kwTotal: c.keywords.length,
      confianza: ev.confianza,
      validado: c.validado,
      negaciones: ev.kwsNegadas,
      frasesLegalesEncontradas: ev.frasesEncontradas,
      requiereRevisionManual: ev.requiereRevisionManual,
      densidad: ev.densidad,
      densidadRelativa: ev.densidadRelativa,
      kwsEnContextoNormativo: ev.kwsEnContextoNormativo,
      fragmentoDocumento: ev.fragmento,
    };
```

- [ ] **Step 2: Añadir el gate de clasificación en `analyzeDocument`**

Reemplazar el bloque que inicializa el análisis (después del `if (doc.scanned) {...}` y antes del `const texto = ...`):

```typescript
  const texto = doc.text.toLowerCase();
  const palabras = texto.split(/\s+/);

  // ── Clasificación del tipo de documento ───────────────────────────────────
  // Si el documento es del tipo incorrecto, no evaluar criterios.
  const clasificacion = clasificarDocumento(req.clasificacion, texto);

  if (clasificacion.tipo === 'incorrecto') {
    return {
      estado: 'wrong_type',
      cobertura: 0,
      criterios: req.criterios.map(c => ({
        name: c.name,
        status: 'fail' as const,
        found: 'Documento de tipo incorrecto — no analizado',
        kwFound: 0,
        kwTotal: c.keywords.length,
        confianza: 'baja' as const,
        validado: c.validado,
        negaciones: [],
        frasesLegalesEncontradas: [],
        requiereRevisionManual: false,
        densidad: 0,
        densidadRelativa: 0,
        kwsEnContextoNormativo: [],
        fragmentoDocumento: '',
      })),
      gap: `El documento "${doc.name}" no parece ser una "${req.nombre}". ${clasificacion.razon} Cargue el documento correcto para este requisito.`,
      clasificacionDocumento: clasificacion,
    };
  }
```

También añadir `kwsEnContextoNormativo: []` a los paths `sin documento` y `escaneado` que se construyen antes (para que el tipo sea completo):

```typescript
  // Sin documento subido — añadir kwsEnContextoNormativo: []
  if (!doc) {
    return {
      estado: 'red',
      cobertura: 0,
      criterios: req.criterios.map(c => ({
        // ... campos existentes ...
        kwsEnContextoNormativo: [],
        fragmentoDocumento: '',
      })),
      gap: `...`,
    };
  }

  // Documento escaneado — añadir kwsEnContextoNormativo: []
  if (doc.scanned) {
    return {
      estado: 'unanalyzable',
      cobertura: 0,
      criterios: req.criterios.map(c => ({
        // ... campos existentes ...
        kwsEnContextoNormativo: [],
        fragmentoDocumento: '',
      })),
      gap: `...`,
    };
  }
```

Reemplazar el `return buildRequisitoResult(req, criterios, doc)` al final de `analyzeDocument` por:

```typescript
  const resultado = buildRequisitoResult(req, criterios, doc);

  // Dudoso: análisis corre completo, pero el estado máximo es 'yellow'
  if (clasificacion.tipo === 'dudoso' && resultado.estado === 'green') {
    const warnItems = criterios.filter(c => c.status === 'warn');
    return {
      ...resultado,
      estado: 'yellow' as const,
      gap: `Cumplimiento aparente (${resultado.cobertura}%) del ${req.art}, pero el tipo de documento no está confirmado. ${clasificacion.razon}${warnItems.length > 0 ? ` Puede reforzar: ${warnItems.map(c => c.name).slice(0, 2).join(', ')}.` : ''}`,
      clasificacionDocumento: clasificacion,
    };
  }

  return {
    ...resultado,
    clasificacionDocumento: clasificacion,
  };
```

- [ ] **Step 3: Compilar y ejecutar el suite completo**

```
npx tsc --noEmit
npx vitest run
```

Resultado esperado tras esta task:
- `[BASELINE]` tests siguen pasando
- `[POST-IMPL]` tests de F1 (Plan Maestro wrong_type) y F5 (Blog wrong_type) deben pasar ahora
- `[POST-IMPL]` tests de F2/F3/F4 (`clasificacionDocumento.tipo === 'correcto'`) deben pasar
- `[POST-IMPL]` tests de F2/F3/F4 (`estado === 'green'`) pueden seguir fallando — eso es esperado hasta Task 6 (vocabulario)

Si F4 (Cencosud) falla el test `tipo !== 'incorrecto'`, significa que ninguno de los marcadores de 3ª persona está en el texto. Verificar en el fixture con:
```
npx tsx -e "const t = require('fs').readFileSync('__tests__/fixtures/politica-tercera-persona.txt','utf-8').toLowerCase(); console.log(t.includes('el usuario podrá'), t.includes('conservará los datos'), t.includes('representante legal corresponde'))"
```

- [ ] **Step 4: Commit**

```bash
git add lib/analyzer.ts
git commit -m "feat(analyzer): wiring del gate de clasificacion en analyzeDocument

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Vocabulario 19.628 — `frasesLegales.ts`, `sinonimos.ts` y test de regresión

**Files:**
- Modify: `lib/frasesLegales.ts`
- Modify: `lib/sinonimos.ts`
- Create: `__tests__/vocabularyRegression.test.ts`

**Interfaces:**
- Consumes: `analyzeDocument` (Task 5 completa, con gate wired)
- Produce: F2 Centro Médico alcanza `estado: 'green'`; F3/F4 mejoran hacia `'yellow'` o `'green'`

- [ ] **Step 1: Escribir los tests de regresión de vocabulario que fallan**

Crear `__tests__/vocabularyRegression.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzeDocument } from '../lib/analyzer';
import type { UploadedDoc } from '../lib/types';

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

function makeDoc(text: string): Record<string, UploadedDoc> {
  const words = text.trim().split(/\s+/).length;
  return {
    politica_privacidad: {
      name: name + '.txt',
      text: text.toLowerCase(),
      wordCount: words,
      extractedFully: true,
    },
  };
}

// ── F2: Centro Médico Antofagasta ─────────────────────────────────────────────
describe('F2 — Centro Médico Antofagasta (vocabulario 19.628)', () => {
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    docs = makeDoc(loadFixture('politica-privacidad-completa.txt'));
  });

  it('criterio Base legal encuentra "base de licitud"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const baseLegal = res.criterios.find(c => c.name.includes('Base legal'));
    expect(baseLegal?.frasesLegalesEncontradas).toContain('base de licitud');
  });

  it('criterio Plazo encuentra "vigencia del tratamiento"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const plazo = res.criterios.find(c => c.name.includes('Plazo'));
    expect(plazo?.frasesLegalesEncontradas.some(f =>
      f.includes('vigencia') || f.includes('conservará')
    )).toBe(true);
  });

  it('estado global es green con vocabulario 19.628 expandido', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('green');
    expect(res.cobertura).toBeGreaterThanOrEqual(75);
  });
});

// ── F3: Escuela de Seguros ────────────────────────────────────────────────────
describe('F3 — Escuela de Seguros (formas verbales / infinitivos)', () => {
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    docs = makeDoc(loadFixture('politica-privacidad-concisa.txt'));
  });

  it('criterio ARCO encuentra frase de infinitivos "acceder, rectificar, cancelar u oponerse"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const arco = res.criterios.find(c => c.name.includes('ARCO'));
    expect(arco?.frasesLegalesEncontradas.some(f =>
      f.includes('acceder') || f.includes('rectificar')
    )).toBe(true);
  });

  it('criterio Base legal encuentra "bases de legitimación"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const base = res.criterios.find(c => c.name.includes('Base legal'));
    expect(base?.frasesLegalesEncontradas.some(f =>
      f.includes('bases de legitimación') || f.includes('consentimiento expreso')
    )).toBe(true);
  });

  it('criterio Plazo encuentra "durante el tiempo necesario"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const plazo = res.criterios.find(c => c.name.includes('Plazo'));
    expect(plazo?.frasesLegalesEncontradas).toContain('durante el tiempo necesario');
  });

  it('estado no es red (tiene evidencia suficiente)', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).not.toBe('red');
    expect(res.estado).not.toBe('wrong_type');
  });
});

// ── F4: Cencosud (tercera persona + conservará los datos) ─────────────────────
describe('F4 — Cencosud (frases de tercera persona + 19.628)', () => {
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    docs = makeDoc(loadFixture('politica-tercera-persona.txt'));
  });

  it('criterio Plazo encuentra "conservará los datos"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const plazo = res.criterios.find(c => c.name.includes('Plazo'));
    expect(plazo?.frasesLegalesEncontradas).toContain('conservará los datos');
  });

  it('estado no es red ni wrong_type', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).not.toBe('red');
    expect(res.estado).not.toBe('wrong_type');
  });
});

// ── F5: Blog — gate bloquea antes de puntuar ──────────────────────────────────
describe('F5 — Blog: la clasificación impide puntuar aunque vocabulario aparezca', () => {
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    docs = makeDoc(loadFixture('articulo-sobre-la-ley.txt'));
  });

  it('estado es wrong_type (gate de clasificación activo)', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('wrong_type');
  });

  it('cobertura es 0 cuando wrong_type', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.cobertura).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar para confirmar que los tests fallan (vocabulario no expandido aún)**

```
npx vitest run __tests__/vocabularyRegression.test.ts
```

F2/F3/F4 tests de frasesLegales fallarán. F5 test `estado === 'wrong_type'` debe pasar (ya implementado en Task 5).

- [ ] **Step 3: Expandir `lib/frasesLegales.ts`**

Dentro del bloque `politica_privacidad`, añadir las siguientes frases a cada criterio:

```typescript
    'Finalidad y propósito del tratamiento': [
      // ... frases existentes ...
      'finalidades del tratamiento',          // plural (F3: "4. Finalidad del tratamiento")
      'datos personales serán utilizados para', // forma pasiva (F3 literal)
      'tratará sus datos personales',         // futuro (F2: "El Centro tratará sus datos personales")
    ],
    'Base legal (consentimiento / interés legítimo)': [
      // ... frases existentes ...
      'base de licitud',                      // término 19.628 (F2: "IV. Base de Licitud")
      'bases de legitimación',                // variante doctrinal (F3: "5. Bases de legitimación")
      'consentimiento expreso del titular',   // forma completa (F3 literal)
    ],
    'Derechos ARCO del titular (acceso, rectificación...)': [
      // ... frases existentes ...
      'acceder, rectificar, cancelar u oponerse', // fórmula verbal 19.628 (F3 literal)
      'revocar su consentimiento',            // F3: "Revocar su consentimiento en cualquier momento"
      'solicitar la eliminación',             // F3: "Solicitar la eliminación o portabilidad"
    ],
    'Plazo de conservación de los datos': [
      // ... frases existentes ...
      'conservará los datos',                 // F4: "Cencosud Retail S.A. conservará los datos"
      'durante el tiempo necesario',          // F3: "conservados durante el tiempo necesario"
      'vigencia del tratamiento',             // F2: sección "II. Vigencia del tratamiento de datos"
      'serán conservados durante',            // forma pasiva genérica
    ],
```

- [ ] **Step 4: Expandir `lib/sinonimos.ts`**

Dentro del bloque `politica_privacidad`, añadir a las listas existentes:

```typescript
    'Identidad y contacto del responsable de datos': [
      // ... sinónimos existentes ...
      'razón social',         // F2: "Razón social: Centro Médico Antofagasta S.A."
      'domiciliada',          // F4: "domiciliada para estos efectos en Av. Kennedy"
    ],
    'Base legal (consentimiento / interés legítimo)': [
      // ... sinónimos existentes ...
      'base de licitud',        // 19.628 (también en frasesLegales; sinonimos como red extra)
      'bases de legitimación',  // variante doctrinal
    ],
    'Derechos ARCO del titular (acceso, rectificación...)': [
      // ... sinónimos existentes ...
      'acceder',    // infinitivo de "acceso"
      'rectificar', // infinitivo de "rectificación"
      'oponerse',   // infinitivo de "oposición"
    ],
    'Plazo de conservación de los datos': [
      // ... sinónimos existentes ...
      'conservará',  // futuro verbal
      'vigencia',    // sustantivo 19.628
    ],
```

- [ ] **Step 5: Ejecutar los tests de vocabulario y confirmar que pasan**

```
npx vitest run __tests__/vocabularyRegression.test.ts
```

Si el test `'estado global es green'` de F2 falla, verificar cuáles criterios siguen en `warn`:

```
npx vitest run __tests__/vocabularyRegression.test.ts --reporter=verbose
```

Los criterios `Finalidad` y `Plazo` de F2 deberían tener frase legal + ≥1 keyword → ok. Si Finalidad sigue en warn, comprobar que "finalidades del tratamiento" está en el texto de F2 (que contiene "V. Finalidades del tratamiento de datos").

- [ ] **Step 6: Ejecutar el suite completo**

```
npx vitest run
```

La mayoría de los tests `[POST-IMPL]` de `documentClassification.test.ts` deben pasar ahora. Revisar cuáles siguen fallando y documentar si algún resultado inesperado emerge.

- [ ] **Step 7: Commit**

```bash
git add lib/frasesLegales.ts lib/sinonimos.ts __tests__/vocabularyRegression.test.ts
git commit -m "feat(vocabulario): agregar frases 19.628 y formas verbales para politica_privacidad

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Actualizar `__tests__/analyzer.test.ts`

**Files:**
- Modify: `__tests__/analyzer.test.ts`

El primer test usa una cadena de keywords sin prosa ("responsable rut domicilio..."). Con el gate de clasificación activo, ese texto tiene 0 performativos y ningún tier2 suficiente → `'dudoso'`. Con `buildRequisitoResult` que ahora lee `densidadRelativa`, el comportamiento cambia. El test debe reemplazarse por el fixture real.

- [ ] **Step 1: Leer el estado actual del test**

```
npx vitest run __tests__/analyzer.test.ts --reporter=verbose
```

Documentar qué tests pasan y cuáles fallan. El "sin documento" y "escaneado" deben seguir pasando (no dependen del fixture de política).

- [ ] **Step 2: Reemplazar el primer test con fixture real**

Localizar el bloque del primer test en `__tests__/analyzer.test.ts` (alrededor de línea 7) y reemplazarlo:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

// ... importaciones existentes ...

describe('analyzeDocument — politica_privacidad con fixture real', () => {
  it('política real (Centro Médico) alcanza estado green', () => {
    const texto = readFileSync(
      join(__dirname, 'fixtures', 'politica-privacidad-completa.txt'),
      'utf-8'
    );
    const words = texto.trim().split(/\s+/).length;
    const docs = {
      politica_privacidad: {
        name: 'politica-centro-medico.txt',
        text: texto.toLowerCase(),
        wordCount: words,
        extractedFully: true,
      },
    };
    const result = analyzeDocument('politica_privacidad', docs);
    expect(result.estado).toBe('green');
    expect(result.cobertura).toBeGreaterThanOrEqual(75);
    expect(result.clasificacionDocumento?.tipo).toBe('correcto');
  });
});
```

- [ ] **Step 3: Ejecutar el suite completo y confirmar que todos los tests pasan**

```
npx vitest run
```

- [ ] **Step 4: Commit final**

```bash
git add __tests__/analyzer.test.ts
git commit -m "test(analyzer): reemplazar fixture de keyword-soup por politica real (Centro Médico)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**

| Requisito del spec | Task que lo implementa |
|--------------------|----------------------|
| Cambio 1: `clasificarDocumento()` | Task 3 |
| Cambio 1: gate en `analyzeDocument()` | Task 5 |
| Cambio 1: `'wrong_type'` en estado | Task 1 + Task 5 |
| Cambio 2: frase legal + keyword para ok | Task 4 |
| Cambio 3: densidad relativa | Task 4 |
| Cambio 4: contexto normativo penaliza confianza | Task 4 |
| Vocabulario 19.628: frasesLegales | Task 6 |
| Vocabulario 19.628: sinonimos | Task 6 |
| `clasificacion` en los 10 REQUISITOS | Task 2 |
| Tercera persona formal (Cencosud) | Task 2 (marcadores performativos) |
| `kwsEnContextoNormativo` en CriterioResult | Task 1 + Task 4 + Task 5 |
| Test corpus F1–F5 (documentClassification.test.ts) | Task 5 + Task 6 |
| Test vocabulario (vocabularyRegression.test.ts) | Task 6 |
| Test clasificarDocumento | Task 3 |
| Actualizar analyzer.test.ts | Task 7 |

**2. Placeholder scan:** Ninguno encontrado. Todos los bloques de código tienen implementación completa.

**3. Type consistency:**
- `clasificarDocumento` exportada en Task 3 con firma `(config: ClasificacionConfig, texto: string): ClasificacionDocumentoResult`. Consumida en Task 5 con los mismos tipos.
- `evaluarCriterio` gana `wordCount?: number` en Task 4. Llamada actualizada en Task 5 con `doc.wordCount`.
- `kwsEnContextoNormativo: string[]` definido en Task 1, inicializado en Task 4 (evaluarCriterio), propagado en Task 5 (incluye paths sin-doc, escaneado, wrong_type).
- `clasificacionDocumento?: ClasificacionDocumentoResult` definido en Task 1, añadido a todos los returns de `analyzeDocument` en Task 5.

**4. Review Focus — tests añadidos por punto:**

- **Política tercera persona sin performativos 1ª/2ª:** cubierto por `clasificarDocumento.test.ts` Task 3: "F4 Cencosud → correcto (performativos de tercera persona formal)".
- **Blog con vocabulario expandido:** cubierto por `vocabularyRegression.test.ts` Task 6: "estado es wrong_type (gate de clasificación activo)".
- **Frase legal y 0 keywords → warn:** cubierto por `evaluarCriterio.test.ts` Task 4: "criterio con frase legal exacta pero cero keywords → status warn, confianza alta".
- **Doc largo con pocas menciones:** cubierto por `evaluarCriterio.test.ts` Task 4: "doc muy largo con pocas menciones no alcanza confianza alta solo por keywords".
- **`kwsEnContextoNormativo` inicializado en todos los paths:** cubierto implícitamente por `tsc --noEmit` (tipo requerido) y verificado en `evaluarCriterio.test.ts` Task 4: "kwsEnContextoNormativo está presente en CriterioResult".

---

## Estado de ejecución (2026-10-13, última sesión)

**Commits:** dc66ea7 → 68e5ea4 → f0359a9 → 0f848b5 → 8537753

**Completados:** Task 1, Task 2, Task 3, Task 4, Task 5

**Tabla de baseline B5 — ESTADO ACTUAL:**

| Fixture | Words | estado | cobertura | Identidad | Finalidad | Base legal | ARCO | Plazo |
|---------|-------|--------|-----------|-----------|-----------|------------|------|-------|
| F1 Plan Maestro | 9039 | **wrong_type** | **0%** | fail/baja | fail/baja | fail/baja | fail/baja | fail/baja |
| F2 Centro Médico | 1625 | yellow | 70% | ok/alta | warn/media | warn/media | ok/alta | warn/media |
| F3 Escuela Seguros | 776 | yellow | 70% | warn/media | ok/alta | warn/media | warn/media | ok/alta |
| F4 Cencosud | 1578 | yellow | 70% | ok/alta | warn/media | warn/media | ok/alta | warn/media |
| F5 Blog | 1961 | **wrong_type** | **0%** | fail/baja | fail/baja | fail/baja | fail/baja | fail/baja |

**Fallos de test actuales (todos esperados):**
- `documentClassification.test.ts` F1/F5 `[BASELINE]`: documentaban el bug antiguo, fallan porque el bug está corregido ✓
- `documentClassification.test.ts` F2 `[POST-IMPL]` estado green: F2 está en yellow 70%, necesita Task 6 para llegar a green ≥75%
- `analyzer.test.ts` "documento completo → green": usa fixture keyword-soup que el gate rechaza como wrong_type, necesita Task 7

**Próximo paso:** Task 6 — Vocabulario 19.628.
- Agregar frases a `lib/frasesLegales.ts`: "base de licitud", "bases de legitimación", "vigencia del tratamiento", "acceder, rectificar, cancelar u oponerse", "conservará los datos", "durante el tiempo necesario", "domicilio del responsable", "datos del representante legal".
- Agregar sinónimos verbales a `lib/sinonimos.ts`: "acceder", "rectificar", "oponerse", "conservará", "vigencia", "razón social", "domiciliada", "base de licitud".
- Crear `__tests__/vocabularyRegression.test.ts` primero (TDD iron law).
- Medir B6 — esperar que F2 suba a green ≥75%, F3/F4 mejoren.

**Completados (sesión 2026-10-19):** Task 6, Task 7

**Tabla de baseline B6 — ESTADO FINAL:**

| Fixture | Words | estado | cobertura | Identidad | Finalidad | Base legal | ARCO | Plazo |
|---------|-------|--------|-----------|-----------|-----------|------------|------|-------|
| F1 Plan Maestro | 9039 | **wrong_type** | 0% | fail | fail | fail | fail | fail |
| F2 Centro Médico | 1625 | **green** | **100%** | ok/alta | ok/alta | ok/alta | ok/alta | ok/alta |
| F3 Escuela Seguros | 776 | **green** | **90%** | warn/media | ok/alta | ok/alta | ok/alta | ok/alta |
| F4 Cencosud | 1578 | **green** | **80%** | ok/alta | warn/media | warn/media | ok/alta | ok/alta |
| F5 Blog | 1961 | **wrong_type** | 0% | fail | fail | fail | fail | fail |

**Fallos de test residuales (permanentes, esperados):**
- `documentClassification.test.ts` F1/F5 `[BASELINE]`: documentaban el bug antiguo; fallan porque el bug fue corregido. No tocar.

**Commits de esta rama:** dc66ea7 → 68e5ea4 → f0359a9 → 0f848b5 → 8537753 → 318354b → 8a0c57e

---

## Tarea siguiente — Criterios bloqueantes en `buildRequisitoResult`

**Problema identificado en B6:** F3 alcanza `green/90%` con el criterio Identidad en `warn`. Un documento puede mostrar "Cumple" sin identificar al responsable del tratamiento (Art. 14 letra a), que es el requisito más básico de cualquier política. Es el mismo patrón corregido en esta rama (documento del tipo equivocado puntúa alto) pero un nivel más arriba: documento del tipo correcto pero incompleto en lo esencial.

**Propuesta técnica:**
- Añadir campo `required?: true` en la interfaz `Criterio` (`lib/types.ts`)
- En `buildRequisitoResult`: si cualquier criterio con `required: true` tiene `status !== 'ok'`, el estado máximo es `'yellow'` (nunca `'green'`), independientemente de la cobertura
- Candidatos obvios en `politica_privacidad`: Identidad (Art. 14a), Base legal (Art. 14b) — el resto necesita revisión legal
- **Alcance pendiente:** revisar los 10 requisitos y determinar qué criterios de cada uno son bloqueantes — esto requiere su propio spec antes de implementar

**Por qué no se hizo en esta rama:** fuera del alcance de `clasificacion-tipo-documento`. La rama corrige clasificación y endurecimiento de evidencia; los criterios bloqueantes son una capa de agregación diferente.

---

**Condiciones de usuario activas:**
1. Revisor final: subagente con contexto fresco, revisa contra spec+baseline, NO contra tests.
2. Baseline después de CADA task; si algún fixture se mueve en dirección contraria, PARAR.
