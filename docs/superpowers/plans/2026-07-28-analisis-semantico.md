# Análisis semántico (NLP local) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una capa de análisis semántico (embeddings locales + similitud coseno) que corre automáticamente junto al motor de reglas existente, sin botón ni activación manual, y que nunca marca por sí sola un criterio como cumplido.

**Architecture:** El motor de reglas (`lib/analyzer.ts`) sigue calculando el resultado principal, síncrono e inmediato, sin cambios de comportamiento. Un módulo nuevo (`lib/semantic/`) carga en segundo plano un modelo de embeddings autohospedado (`Xenova/all-MiniLM-L6-v2`, servido desde `public/models/`, nunca desde un servidor externo) y, de forma asíncrona, enriquece con "posibles coincidencias semánticas" solo los criterios que el motor de reglas no confirmó con confianza alta. El resultado se fusiona en el estado de React (`hooks/useAppState.ts`) a medida que va estando listo, sin bloquear la interfaz.

**Tech Stack:** Next.js 14 / React 18 / TypeScript, `@xenova/transformers` (transformers.js) 2.17.2, Vitest.

## Global Constraints

- Todo el análisis (reglas + semántico) corre en el navegador del cliente. Ningún documento sale nunca a un servidor.
- El modelo de embeddings se autohospeda en `public/models/` (descargado una vez vía script de instalación desde Hugging Face). Ninguna llamada de red del navegador del usuario descarga el modelo ni envía documentos. El CSP existente en `next.config.mjs` **no se modifica**.
- No usar `localStorage` para documentos. Los documentos siguen en estado de React / `lib/tenant/repository.ts`, sin cambios.
- El motor de reglas (`lib/analyzer.ts`) no cambia su lógica de detección de criterios; solo se extrae una función pura de agregación (`buildRequisitoResult`) para reutilizarla.
- La capa semántica nunca sube un criterio a `status: 'ok'`. Como máximo, un criterio `fail` sube a `warn` con `confianza: 'media'` y `requiereRevisionManual: true`.
- Si el modelo falla al cargar, la app sigue funcionando solo con reglas (try/catch obligatorio, sin reintentos automáticos infinitos).
- Comentarios de código en español, siguiendo el estilo ya usado en `lib/analyzer.ts`.
- Umbral de similitud semántica: `0.5` (constante `UMBRAL_SIMILITUD_SEMANTICA`, exportada y fácil de tunear).

---

### Task 1: Script de instalación del modelo de embeddings

**Files:**
- Create: `scripts/fetch-embedding-model.mjs`
- Modify: `package.json` (agregar dependencia, scripts `postinstall` y `fetch-model`)
- Modify: `.gitignore` (no versionar los pesos del modelo)

**Interfaces:**
- Produces: archivos en `public/models/Xenova/all-MiniLM-L6-v2/{config.json,tokenizer.json,tokenizer_config.json,special_tokens_map.json,vocab.txt,onnx/model_quantized.onnx}`, servidos por Next.js como assets estáticos en `/models/Xenova/all-MiniLM-L6-v2/...`.

- [ ] **Step 1: Crear el script de descarga**

Crear `scripts/fetch-embedding-model.mjs`:

```js
// Descarga (una sola vez) los archivos del modelo de embeddings
// Xenova/all-MiniLM-L6-v2 hacia public/models/, para que el análisis
// semántico se sirva siempre desde el propio proyecto — nunca desde un
// servidor externo en tiempo de ejecución del navegador del usuario.
// Se ejecuta automáticamente en "postinstall" y también está disponible
// como "npm run fetch-model". Si falla (ej. sin conexión), NO rompe la
// instalación: la app sigue funcionando solo con el motor de reglas hasta
// que este script se ejecute con éxito.
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pipeline as streamPipeline } from 'stream/promises';
import { Readable } from 'stream';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/main`;
const DEST_DIR = join(__dirname, '..', 'public', 'models', MODEL_ID);

const ARCHIVOS = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'vocab.txt',
  'onnx/model_quantized.onnx',
];

async function descargarArchivo(nombreRelativo) {
  const destino = join(DEST_DIR, ...nombreRelativo.split('/'));
  if (existsSync(destino)) {
    console.log(`[fetch-embedding-model] ya existe, se omite: ${nombreRelativo}`);
    return;
  }
  mkdirSync(dirname(destino), { recursive: true });
  const url = `${BASE_URL}/${nombreRelativo}`;
  console.log(`[fetch-embedding-model] descargando ${nombreRelativo}...`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`No se pudo descargar ${url} (HTTP ${res.status})`);
  }
  await streamPipeline(Readable.fromWeb(res.body), createWriteStream(destino));
}

async function main() {
  try {
    for (const archivo of ARCHIVOS) {
      await descargarArchivo(archivo);
    }
    console.log('[fetch-embedding-model] modelo de análisis semántico listo en public/models/.');
  } catch (err) {
    console.warn(
      '[fetch-embedding-model] no se pudo descargar el modelo de análisis semántico ' +
      '(revise su conexión a internet). La app seguirá funcionando solo con el motor ' +
      'de reglas hasta que se ejecute "npm run fetch-model" con éxito.',
    );
    console.warn(String(err));
  }
}

main();
```

- [ ] **Step 2: Agregar scripts y dependencia en package.json**

En `package.json`, dentro de `"scripts"` agregar (junto a los existentes `dev`/`build`/`start`/`test`):

```json
    "fetch-model": "node scripts/fetch-embedding-model.mjs",
    "postinstall": "node scripts/fetch-embedding-model.mjs"
```

Y en `"dependencies"` agregar:

```json
    "@xenova/transformers": "^2.17.2",
```

- [ ] **Step 3: Excluir el modelo de git**

En `.gitignore`, junto al bloque de "generated assets — copied from node_modules at build time", agregar:

```
# modelo de embeddings del analisis semantico — se descarga via postinstall
# (ver scripts/fetch-embedding-model.mjs), no se versiona
public/models/
```

- [ ] **Step 4: Ejecutar el script y verificar**

Run: `node scripts/fetch-embedding-model.mjs`
Expected: se crean 6 archivos bajo `public/models/Xenova/all-MiniLM-L6-v2/` (el `.onnx` pesa ~23MB). Verificar con:

Run: `ls -la public/models/Xenova/all-MiniLM-L6-v2/ public/models/Xenova/all-MiniLM-L6-v2/onnx/` (o el equivalente `Get-ChildItem` en PowerShell)
Expected: aparecen `config.json`, `tokenizer.json`, `tokenizer_config.json`, `special_tokens_map.json`, `vocab.txt`, y `onnx/model_quantized.onnx`.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-embedding-model.mjs package.json .gitignore
git commit -m "feat: script de auto-hospedaje del modelo de embeddings (analisis semantico)"
```

(Los archivos descargados en `public/models/` NO se commitean — quedan ignorados por `.gitignore`.)

---

### Task 2: Instalar dependencia y ajustar next.config.mjs

**Files:**
- Modify: `package.json` (ya editado en Task 1 — aquí se corre `npm install`)
- Modify: `next.config.mjs`

**Interfaces:**
- Produces: `@xenova/transformers` instalado en `node_modules`; webpack configurado para bundlear limpio en el cliente.

- [ ] **Step 1: Instalar dependencias**

Run: `npm install`
Expected: instala `@xenova/transformers` y corre `postinstall` (descarga el modelo si no estaba ya). Sin errores fatales aunque la descarga falle (el script de Task 1 solo advierte).

- [ ] **Step 2: Ajustar next.config.mjs para el bundling en cliente**

En `next.config.mjs`, reemplazar:

```js
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
```

por:

```js
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    // @xenova/transformers: evitar que webpack intente resolver dependencias
    // opcionales de Node (sharp, backends nativos) que no existen en el navegador.
    config.resolve.alias.sharp$ = false;
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    return config;
  },
```

- [ ] **Step 3: Verificar que el proyecto sigue compilando**

Run: `npm run build`
Expected: build exitoso (todavía no se importa `@xenova/transformers` desde ningún componente, así que este paso solo confirma que el cambio de webpack no rompe nada existente).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json next.config.mjs
git commit -m "chore: instalar @xenova/transformers y ajustar webpack para bundling en cliente"
```

---

### Task 3: Extraer `buildRequisitoResult` en lib/analyzer.ts

**Files:**
- Modify: `lib/analyzer.ts`
- Test: `__tests__/analyzer.test.ts` (nuevo)

**Interfaces:**
- Produces: `export function buildRequisitoResult(req: Requisito, criterios: CriterioResult[], doc: UploadedDoc): RequisitoResult` — usada por `analyzeDocument` y, más adelante (Task 6), por la capa semántica.
- Consumes: tipos `Requisito`, `CriterioResult`, `RequisitoResult`, `UploadedDoc` de `./types`.

- [ ] **Step 1: Escribir el test de regresión (debe pasar con el código actual, antes de refactorizar)**

Crear `__tests__/analyzer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analyzeDocument } from '../lib/analyzer';
import type { UploadedDoc } from '../lib/types';

describe('analyzeDocument (regresión post-refactor de buildRequisitoResult)', () => {
  it('documento completo de política de privacidad da cobertura alta y estado green', () => {
    const docs: Record<string, UploadedDoc> = {
      politica_privacidad: {
        name: 'politica.txt',
        text: 'responsable rut domicilio contacto finalidad propósito consentimiento base legal '
          + 'acceso rectificación cancelación oposición derechos arco conservación retención plazo eliminar',
        wordCount: 25,
        extractedFully: true,
      },
    };
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('green');
    expect(res.cobertura).toBeGreaterThanOrEqual(75);
    expect(res.criterios).toHaveLength(5);
  });

  it('sin documento subido da estado red y cobertura 0', () => {
    const res = analyzeDocument('politica_privacidad', {});
    expect(res.estado).toBe('red');
    expect(res.cobertura).toBe(0);
    expect(res.gap).toMatch(/Sin este documento/);
  });

  it('documento escaneado da estado unanalyzable', () => {
    const docs: Record<string, UploadedDoc> = {
      politica_privacidad: { name: 'escaneado.pdf', text: '', scanned: true },
    };
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('unanalyzable');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que pasa ANTES de tocar analyzer.ts**

Run: `npx vitest run __tests__/analyzer.test.ts`
Expected: PASS (3 tests) — esto confirma el comportamiento actual antes de refactorizar.

- [ ] **Step 3: Extraer buildRequisitoResult**

En `lib/analyzer.ts`, cambiar el import del encabezado de:

```ts
import { REQUISITOS } from './requisitos';
import type { UploadedDoc, RequisitoResult, CriterioResult } from './types';
```

a:

```ts
import { REQUISITOS } from './requisitos';
import type { UploadedDoc, RequisitoResult, CriterioResult, Requisito } from './types';
```

Luego, reemplazar el bloque final de `analyzeDocument` (todo desde el comentario `// ── Calcular cobertura ─────` hasta el `return { estado, cobertura, criterios, gap };` de cierre de la función) por una llamada a la nueva función extraída. El bloque queda así:

```ts
  return buildRequisitoResult(req, criterios, doc);
}

// ═══════════════════════════════════════════════════════════════════════════
// AGREGACIÓN: cobertura, estado y mensaje de brecha a partir de los criterios
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula cobertura, estado (green/yellow/red) y mensaje de brecha a partir
 * de una lista de criterios ya evaluados. Se usa tanto desde el motor de
 * reglas (analyzeDocument) como desde la capa semántica, que recalcula el
 * resultado después de enriquecer algunos criterios con coincidencias
 * semánticas — así ambos caminos comparten exactamente la misma lógica de
 * agregación.
 */
export function buildRequisitoResult(
  req: Requisito,
  criterios: CriterioResult[],
  doc: UploadedDoc,
): RequisitoResult {
  // ── Calcular cobertura ─────────────────────────────────────────────────
  // ok=1.0, warn=0.5, fail=0.0
  const score = criterios.reduce((acc, c) => {
    if (c.status === 'ok')   return acc + 1;
    if (c.status === 'warn') return acc + 0.5;
    return acc;
  }, 0);
  const cobertura = Math.round((score / criterios.length) * 100);

  // ── Determinar estado y mensaje de brecha ──────────────────────────────
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
    const nPalabras = doc.wordCount ?? 0;
    const extraInfo = nPalabras < 50 && doc.extractedFully
      ? ` El documento parece muy breve (${nPalabras} palabras) para cubrir todos los requisitos legales.`
      : '';
    gap = `Documento insuficiente para ${req.art}. Criterios faltantes: ${criticos.join(', ')}. Riesgo de multa: ${req.multa}.${extraInfo}`;
  }

  return { estado, cobertura, criterios, gap };
}
```

(El resto de `analyzeDocument` — casos "sin documento" y "escaneado", y el `.map` que arma `criterios` — no cambia.)

- [ ] **Step 4: Correr el test de nuevo para confirmar que el refactor no rompió nada**

Run: `npx vitest run __tests__/analyzer.test.ts`
Expected: PASS (3 tests), mismo resultado que en el Step 2.

- [ ] **Step 5: Commit**

```bash
git add lib/analyzer.ts __tests__/analyzer.test.ts
git commit -m "refactor: extraer buildRequisitoResult de analyzeDocument para reuso"
```

---

### Task 4: Campos de la capa semántica en lib/types.ts

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `CriterioResult.origenDeteccion?: 'reglas' | 'semantico'`, `CriterioResult.coincidenciaSemantica?: { parrafo: string; similitud: number; nivel: 'alto' | 'medio' }`.

- [ ] **Step 1: Agregar los campos opcionales**

En `lib/types.ts`, dentro de `interface CriterioResult`, cambiar:

```ts
  // Fragmento textual EXACTO del documento (recorte con contexto alrededor
  // del término/frase que respalda la detección). Vacío cuando no hay
  // evidencia (status 'fail').
  fragmentoDocumento: string;
}
```

por:

```ts
  // Fragmento textual EXACTO del documento (recorte con contexto alrededor
  // del término/frase que respalda la detección). Vacío cuando no hay
  // evidencia (status 'fail').
  fragmentoDocumento: string;
  // ── Capa semántica (NLP local, complementaria al motor de reglas) ──────
  // Ausente = detectado por el motor de reglas (comportamiento de siempre).
  // 'semantico' = un criterio que las reglas marcaron 'fail' fue promovido
  // a 'warn' por una coincidencia semántica; NUNCA se usa para llegar a 'ok'.
  origenDeteccion?: 'reglas' | 'semantico';
  // Evidencia de la coincidencia semántica (presente tanto si origenDeteccion
  // es 'semantico' como si un criterio 'warn' de reglas además tuvo
  // corroboración semántica adicional).
  coincidenciaSemantica?: {
    parrafo: string;
    similitud: number;
    nivel: 'alto' | 'medio';
  };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (los campos son opcionales, no rompen ningún uso existente de `CriterioResult`).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: agregar campos de capa semantica a CriterioResult"
```

---

### Task 5: `lib/semantic/embeddingModel.ts` — singleton de carga del modelo

**Files:**
- Create: `lib/semantic/embeddingModel.ts`

**Interfaces:**
- Produces:
  - `export type EstadoModelo = 'idle' | 'loading' | 'ready' | 'error'`
  - `export function preloadEmbeddingModel(): void`
  - `export function getModelStatus(): EstadoModelo`
  - `export function subscribeModelStatus(cb: () => void): () => void`
  - `export async function getEmbedder(): Promise<(textos: string[]) => Promise<number[][]>>` (uso interno de `embed`)
  - `export async function embed(textos: string[]): Promise<number[][]>`
  - `export function cosineSim(a: number[], b: number[]): number`

- [ ] **Step 1: Crear el módulo**

Crear `lib/semantic/embeddingModel.ts`:

```ts
'use client';

// Carga perezosa y en segundo plano del modelo de embeddings local
// (Xenova/all-MiniLM-L6-v2). El modelo está autohospedado en
// public/models/ (ver scripts/fetch-embedding-model.mjs): nunca se
// descarga desde un servidor externo en el navegador del usuario.
// El import de @xenova/transformers es dinámico para que Next.js nunca
// intente evaluarlo durante el server-side rendering.

export type EstadoModelo = 'idle' | 'loading' | 'ready' | 'error';

type ExtractorEmbeddings = (textos: string[]) => Promise<number[][]>;

let estado: EstadoModelo = 'idle';
let extractorPromise: Promise<ExtractorEmbeddings> | null = null;
const subscriptores = new Set<() => void>();

function notificar() {
  subscriptores.forEach(cb => cb());
}

function setEstado(nuevo: EstadoModelo) {
  estado = nuevo;
  notificar();
}

/** Estado actual del modelo, para mostrar un indicador discreto en la UI. */
export function getModelStatus(): EstadoModelo {
  return estado;
}

/** Se suscribe a cambios de estado del modelo. Devuelve la función para desuscribirse. */
export function subscribeModelStatus(cb: () => void): () => void {
  subscriptores.add(cb);
  return () => subscriptores.delete(cb);
}

async function cargarExtractor(): Promise<ExtractorEmbeddings> {
  setEstado('loading');
  const { pipeline, env } = await import('@xenova/transformers');

  // El modelo se sirve desde public/models/ (asset propio del proyecto) —
  // nunca desde un servidor remoto. allowRemoteModels queda deshabilitado
  // a propósito, para que un modelo faltante falle explícitamente en vez
  // de intentar descargarlo de internet.
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = '/models/';

  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    quantized: true,
  });

  const wrapped: ExtractorEmbeddings = async (textos: string[]) => {
    const salida = await extractor(textos, { pooling: 'mean', normalize: true });
    const dim = salida.dims[salida.dims.length - 1];
    const vectores: number[][] = [];
    for (let i = 0; i < textos.length; i++) {
      vectores.push(Array.from(salida.data.slice(i * dim, (i + 1) * dim) as Float32Array));
    }
    return vectores;
  };

  setEstado('ready');
  return wrapped;
}

/**
 * Inicia la carga del modelo si aún no se ha iniciado. Idempotente: llamadas
 * repetidas (desde distintos componentes) reutilizan la misma carga. Si la
 * carga ya falló antes, NO reintenta automáticamente (evita bucles de
 * reintento); para reintentar hace falta recargar la página.
 */
export function preloadEmbeddingModel(): void {
  if (extractorPromise) return;
  extractorPromise = cargarExtractor().catch(err => {
    setEstado('error');
    throw err;
  });
  // Evita "unhandled rejection" a nivel de módulo cuando nadie más está
  // esperando esta promesa todavía (el error real se propaga igual a
  // quien sí la espere via getEmbedder()/embed()).
  extractorPromise.catch(() => {});
}

/**
 * Devuelve el extractor de embeddings, esperando a que termine de cargar si
 * hace falta. Lanza si el modelo falló al cargar — el llamador debe
 * capturarlo y seguir solo con el motor de reglas.
 */
export async function getEmbedder(): Promise<ExtractorEmbeddings> {
  preloadEmbeddingModel();
  return extractorPromise!;
}

/** Calcula embeddings normalizados (mean pooling) para un lote de textos. */
export async function embed(textos: string[]): Promise<number[][]> {
  if (textos.length === 0) return [];
  const extractor = await getEmbedder();
  return extractor(textos);
}

/** Similitud coseno entre dos vectores. Con vectores normalizados equivale al producto punto. */
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores. (Si `@xenova/transformers` no expone tipos para `env.localModelPath` en la versión instalada, usar `// @ts-expect-error` justo en esa línea con un comentario explicando por qué; verificar primero si hace falta antes de agregarlo.)

- [ ] **Step 3: Commit**

```bash
git add lib/semantic/embeddingModel.ts
git commit -m "feat: singleton de carga del modelo de embeddings (analisis semantico)"
```

---

### Task 6: `lib/semantic/semanticMatcher.ts` — enriquecimiento semántico + tests

**Files:**
- Create: `lib/semantic/semanticMatcher.ts`
- Test: `__tests__/semanticMatcher.test.ts`

**Interfaces:**
- Consumes: `buildRequisitoResult` de `../analyzer` (Task 3), `embed`/`cosineSim` de `./embeddingModel` (Task 5), tipos `Requisito`, `RequisitoResult`, `CriterioResult`, `UploadedDoc` de `../types`.
- Produces:
  - `export const UMBRAL_SIMILITUD_SEMANTICA = 0.5`
  - `export function splitParagraphs(texto: string): string[]`
  - `export function construirTextoConceptoCriterio(criterio: { name: string; keywords: string[]; synonyms: string[] }): string`
  - `export async function enriquecerConSemantica(req: Requisito, resultado: RequisitoResult, doc: UploadedDoc, extractorTextos?: (textos: string[]) => Promise<number[][]>): Promise<RequisitoResult>`

- [ ] **Step 1: Escribir el test (falla porque el archivo no existe todavía)**

Crear `__tests__/semanticMatcher.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  splitParagraphs,
  construirTextoConceptoCriterio,
  enriquecerConSemantica,
  UMBRAL_SIMILITUD_SEMANTICA,
} from '../lib/semantic/semanticMatcher';
import type { Requisito, RequisitoResult, UploadedDoc } from '../lib/types';

function reqFixture(): Requisito {
  return {
    id: 'politica_privacidad',
    num: '01',
    nombre: 'Política de privacidad',
    art: 'Art. 14 — Deber de información',
    desc: '',
    multa: '500 UTM',
    nivel: 'medio',
    plazo: { date: 'Vigente', urgency: 'ok' },
    legalDetail: { articulo: '', documentoEvidencia: '', exigenciaSimple: '' },
    criterios: [
      {
        name: 'Plazo de conservación de los datos',
        keywords: ['conservación', 'retención', 'plazo', 'tiempo', 'eliminar'],
        synonyms: ['período de guarda'],
        frasesLegales: [],
        validado: true,
      },
    ],
  };
}

function criterioFixture(status: 'fail' | 'warn' | 'ok') {
  return {
    name: 'Plazo de conservación de los datos',
    status,
    found: status === 'fail' ? 'No encontrado en el documento' : 'Términos: "plazo"',
    kwFound: status === 'fail' ? 0 : 1,
    kwTotal: 5,
    confianza: status === 'ok' ? ('alta' as const) : status === 'warn' ? ('media' as const) : ('baja' as const),
    validado: true,
    negaciones: [],
    frasesLegalesEncontradas: [],
    requiereRevisionManual: false,
    densidad: status === 'fail' ? 0 : 1,
    fragmentoDocumento: status === 'fail' ? '' : 'algo de contexto',
  };
}

function resultadoFixture(status: 'fail' | 'warn' | 'ok'): RequisitoResult {
  return {
    estado: status === 'ok' ? 'green' : 'red',
    cobertura: status === 'ok' ? 100 : 0,
    gap: '',
    criterios: [criterioFixture(status)],
  };
}

const doc: UploadedDoc = {
  name: 'test.txt',
  text: 'guardamos los datos hasta que el cliente solicite su baja.\notros textos irrelevantes sobre soporte técnico.',
  wordCount: 20,
  extractedFully: true,
};

// Extractor determinístico para test: el "concepto" del criterio de
// conservación es paralelo (similitud ~0.9) al párrafo que habla de guardar
// los datos hasta la baja del cliente, y ortogonal (similitud 0) a todo lo demás.
const extractorFalso = (textos: string[]): Promise<number[][]> =>
  Promise.resolve(textos.map(t => {
    if (t.includes('Plazo de conservación')) return [1, 0];
    if (t.includes('guardamos los datos hasta que el cliente solicite su baja')) return [0.9, Math.sqrt(1 - 0.81)];
    return [0, 1];
  }));

const extractorOrtogonal = (textos: string[]): Promise<number[][]> =>
  Promise.resolve(textos.map(t => (t.includes('Plazo de conservación') ? [1, 0] : [0, 1])));

describe('splitParagraphs', () => {
  it('separa por saltos de línea y descarta vacíos', () => {
    expect(splitParagraphs('uno\n\ndos\n   \ntres')).toEqual(['uno', 'dos', 'tres']);
  });

  it('parte bloques muy largos en fragmentos más chicos por oración', () => {
    const largo = 'a'.repeat(300) + '. ' + 'b'.repeat(300) + '.';
    const out = splitParagraphs(largo);
    expect(out.length).toBeGreaterThan(1);
  });
});

describe('construirTextoConceptoCriterio', () => {
  it('combina nombre, keywords y sinónimos en un solo texto', () => {
    const texto = construirTextoConceptoCriterio(reqFixture().criterios[0]);
    expect(texto).toContain('Plazo de conservación de los datos');
    expect(texto).toContain('conservación');
    expect(texto).toContain('período de guarda');
  });
});

describe('enriquecerConSemantica', () => {
  it('sube un criterio "fail" a "warn" cuando hay similitud semántica sobre el umbral', async () => {
    const req = reqFixture();
    const resultado = resultadoFixture('fail');
    const enriquecido = await enriquecerConSemantica(req, resultado, doc, extractorFalso);
    const c = enriquecido.criterios[0];

    expect(c.status).toBe('warn');
    expect(c.confianza).toBe('media');
    expect(c.origenDeteccion).toBe('semantico');
    expect(c.requiereRevisionManual).toBe(true);
    expect(c.coincidenciaSemantica?.similitud).toBeGreaterThanOrEqual(UMBRAL_SIMILITUD_SEMANTICA);
    expect(c.coincidenciaSemantica?.parrafo).toContain('guardamos los datos');
  });

  it('nunca sube un criterio a "ok"', async () => {
    const req = reqFixture();
    const resultado = resultadoFixture('fail');
    const enriquecido = await enriquecerConSemantica(req, resultado, doc, extractorFalso);
    expect(enriquecido.criterios[0].status).not.toBe('ok');
  });

  it('no promueve nada cuando la similitud está por debajo del umbral', async () => {
    const req = reqFixture();
    const resultado = resultadoFixture('fail');
    const enriquecido = await enriquecerConSemantica(req, resultado, doc, extractorOrtogonal);
    expect(enriquecido.criterios[0].status).toBe('fail');
    expect(enriquecido.criterios[0].origenDeteccion).toBeUndefined();
  });

  it('no toca criterios ya "ok"', async () => {
    const req = reqFixture();
    const resultado = resultadoFixture('ok');
    const enriquecido = await enriquecerConSemantica(req, resultado, doc, extractorFalso);
    expect(enriquecido.criterios[0]).toEqual(resultado.criterios[0]);
  });

  it('mantiene "warn" existente y solo adjunta evidencia semántica adicional, sin cambiar origenDeteccion', async () => {
    const req = reqFixture();
    const resultado = resultadoFixture('warn');
    const enriquecido = await enriquecerConSemantica(req, resultado, doc, extractorFalso);
    const c = enriquecido.criterios[0];
    expect(c.status).toBe('warn');
    expect(c.origenDeteccion).toBeUndefined();
    expect(c.coincidenciaSemantica).toBeDefined();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla (el módulo no existe aún)**

Run: `npx vitest run __tests__/semanticMatcher.test.ts`
Expected: FAIL con error de módulo no encontrado (`Cannot find module '../lib/semantic/semanticMatcher'`).

- [ ] **Step 3: Implementar lib/semantic/semanticMatcher.ts**

```ts
'use client';

import type { Requisito, RequisitoResult, CriterioResult, UploadedDoc } from '../types';
import { buildRequisitoResult } from '../analyzer';
import { embed, cosineSim } from './embeddingModel';

// Similitud mínima para considerar que un párrafo del documento es una
// posible coincidencia semántica de un criterio legal. Configurable.
export const UMBRAL_SIMILITUD_SEMANTICA = 0.5;

// A partir de esta similitud, la coincidencia se muestra como "alta" en vez
// de "media" (solo afecta el texto explicativo, nunca la confianza del
// criterio, que siempre queda en 'media').
const UMBRAL_SIMILITUD_ALTA = 0.65;

// Longitud máxima (en caracteres) de un "párrafo" antes de partirlo por
// oraciones — evita mandar bloques enormes de texto a un solo embedding.
const MAX_LARGO_PARRAFO = 400;

/** Divide el texto del documento en párrafos manejables para comparar por embeddings. */
export function splitParagraphs(texto: string): string[] {
  const bloques = texto.split(/\n+/).map(b => b.trim()).filter(b => b.length > 0);
  const parrafos: string[] = [];

  for (const bloque of bloques) {
    if (bloque.length <= MAX_LARGO_PARRAFO) {
      parrafos.push(bloque);
      continue;
    }
    // Bloque muy largo (ej. PDF sin saltos de línea reales): partir por oraciones.
    const oraciones = bloque.split(/(?<=[.;])\s+/).map(o => o.trim()).filter(Boolean);
    let actual = '';
    for (const oracion of oraciones) {
      if (actual && (actual + ' ' + oracion).trim().length > MAX_LARGO_PARRAFO) {
        parrafos.push(actual.trim());
        actual = oracion;
      } else {
        actual = (actual + ' ' + oracion).trim();
      }
    }
    if (actual) parrafos.push(actual);
  }

  return parrafos;
}

/** Arma el texto que representa el concepto legal de un criterio, para embederlo. */
export function construirTextoConceptoCriterio(criterio: {
  name: string;
  keywords: string[];
  synonyms: string[];
}): string {
  return [criterio.name, ...criterio.keywords, ...criterio.synonyms].join(' ');
}

type ExtractorTextos = (textos: string[]) => Promise<number[][]>;

/**
 * Enriquece un RequisitoResult ya calculado por el motor de reglas con
 * coincidencias semánticas, solo en los criterios que las reglas no
 * confirmaron con confianza alta (status !== 'ok'). Nunca marca un criterio
 * como cumplido por sí sola — como máximo sube un 'fail' a 'warn' con
 * confianza 'media' y revisión manual obligatoria.
 */
export async function enriquecerConSemantica(
  req: Requisito,
  resultado: RequisitoResult,
  doc: UploadedDoc,
  extractorTextos: ExtractorTextos = embed,
): Promise<RequisitoResult> {
  const pendientes = resultado.criterios
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.status !== 'ok');

  if (pendientes.length === 0) return resultado;

  const parrafos = splitParagraphs(doc.text);
  if (parrafos.length === 0) return resultado;

  const [embeddingsParrafos, embeddingsCriterios] = await Promise.all([
    extractorTextos(parrafos),
    extractorTextos(pendientes.map(({ i }) => construirTextoConceptoCriterio(req.criterios[i]))),
  ]);

  const nuevosCriterios: CriterioResult[] = [...resultado.criterios];

  pendientes.forEach(({ c, i }, idx) => {
    const embCriterio = embeddingsCriterios[idx];
    let mejorSimilitud = -1;
    let mejorParrafo = '';

    embeddingsParrafos.forEach((embParrafo, pIdx) => {
      const sim = cosineSim(embCriterio, embParrafo);
      if (sim > mejorSimilitud) {
        mejorSimilitud = sim;
        mejorParrafo = parrafos[pIdx];
      }
    });

    if (mejorSimilitud < UMBRAL_SIMILITUD_SEMANTICA) return;

    const nivel: 'alto' | 'medio' = mejorSimilitud >= UMBRAL_SIMILITUD_ALTA ? 'alto' : 'medio';
    const coincidenciaSemantica = { parrafo: mejorParrafo, similitud: mejorSimilitud, nivel };

    if (c.status === 'fail') {
      nuevosCriterios[i] = {
        ...c,
        status: 'warn',
        confianza: 'media',
        requiereRevisionManual: true,
        origenDeteccion: 'semantico',
        found: `Posible coincidencia semántica (similitud ${nivel})`,
        coincidenciaSemantica,
      };
    } else {
      // Ya era 'warn' por reglas: se mantiene tal cual, solo se adjunta
      // evidencia semántica adicional para transparencia.
      nuevosCriterios[i] = { ...c, coincidenciaSemantica };
    }
  });

  return buildRequisitoResult(req, nuevosCriterios, doc);
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run __tests__/semanticMatcher.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/semantic/semanticMatcher.ts __tests__/semanticMatcher.test.ts
git commit -m "feat: enriquecimiento semantico de criterios no confirmados por reglas"
```

---

### Task 7: `hooks/useSemanticModel.ts`

**Files:**
- Create: `hooks/useSemanticModel.ts`

**Interfaces:**
- Consumes: `getModelStatus`, `subscribeModelStatus`, `EstadoModelo` de `@/lib/semantic/embeddingModel` (Task 5).
- Produces: `export function useSemanticModel(): EstadoModelo`

- [ ] **Step 1: Crear el hook**

Crear `hooks/useSemanticModel.ts`:

```ts
'use client';
import { useSyncExternalStore } from 'react';
import { getModelStatus, subscribeModelStatus, type EstadoModelo } from '@/lib/semantic/embeddingModel';

/**
 * Expone el estado del modelo de embeddings a la UI (para un indicador
 * discreto), sin bloquear el render. No dispara la carga por sí solo —
 * eso lo hace preloadEmbeddingModel() desde app/page.tsx apenas monta la app.
 */
export function useSemanticModel(): EstadoModelo {
  return useSyncExternalStore(subscribeModelStatus, getModelStatus, () => 'idle' as EstadoModelo);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/useSemanticModel.ts
git commit -m "feat: hook useSemanticModel para el indicador de estado del modelo"
```

---

### Task 8: Conectar precarga + enriquecimiento (app/page.tsx y hooks/useAppState.ts)

**Files:**
- Modify: `app/page.tsx`
- Modify: `hooks/useAppState.ts`

**Interfaces:**
- Consumes: `preloadEmbeddingModel` de `@/lib/semantic/embeddingModel` (Task 5), `enriquecerConSemantica` de `@/lib/semantic/semanticMatcher` (Task 6).

- [ ] **Step 1: Precargar el modelo apenas monta la app**

En `app/page.tsx`, cambiar el import de React de:

```tsx
'use client';
import { useAppState } from '@/hooks/useAppState';
```

a:

```tsx
'use client';
import { useEffect } from 'react';
import { useAppState } from '@/hooks/useAppState';
```

Y agregar el import del preload junto a los demás imports:

```tsx
import { preloadEmbeddingModel } from '@/lib/semantic/embeddingModel';
```

Dentro de `export default function Home() {`, justo después de `const { toasts, toast } = useToast();`, agregar:

```tsx
  // Precarga en segundo plano del modelo de análisis semántico: arranca
  // apenas se monta la app (sin importar la pantalla activa), para que ya
  // esté listo cuando el usuario ejecute su primer análisis. No bloquea
  // nada — si el modelo aún no está listo cuando el usuario analiza, el
  // motor de reglas responde igual de inmediato.
  useEffect(() => {
    preloadEmbeddingModel();
  }, []);
```

- [ ] **Step 2: Verificar que la app sigue arrancando**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Agregar el enriquecimiento en segundo plano a useAppState.ts**

En `hooks/useAppState.ts`, cambiar el import de React de:

```ts
'use client';
import { useState, useCallback } from 'react';
```

a:

```ts
'use client';
import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
```

Agregar el import de `enriquecerConSemantica` junto a los demás imports de `lib`:

```ts
import { enriquecerConSemantica } from '@/lib/semantic/semanticMatcher';
```

Después de la función `computeResults` (antes de `const DEMO_RUT = ...`), agregar:

```ts
// Enriquece los resultados con la capa semántica en segundo plano, requisito
// por requisito, sin bloquear la interfaz. Si el modelo de embeddings no
// está disponible (aún cargando cuando se llama, o falló al cargar), cada
// requisito simplemente se queda con el resultado del motor de reglas.
async function enhanceResultsInBackground(
  docs: Record<string, UploadedDoc>,
  baseResults: Record<string, RequisitoResult>,
  setResults: Dispatch<SetStateAction<Record<string, RequisitoResult>>>,
) {
  for (const req of REQUISITOS) {
    const doc = docs[req.id];
    const base = baseResults[req.id];
    if (!doc || !base || doc.scanned || !doc.text) continue;
    try {
      const enriquecido = await enriquecerConSemantica(req, base, doc);
      setResults(prev => ({ ...prev, [req.id]: enriquecido }));
    } catch {
      // Modelo de análisis semántico no disponible: este requisito se queda
      // con el resultado del motor de reglas, sin bloquear los demás.
    }
  }
}
```

- [ ] **Step 4: Disparar el enriquecimiento desde finishAnalysis**

En `hooks/useAppState.ts`, dentro de `finishAnalysis`, cambiar:

```ts
    setResults(newResults);
    setAnalyzed(true);
    setTourActive(false);
    setScreen('app');
    setActiveTab('diagnostico');
    addAuditEvent('ejecutó análisis', currentRole, currentUser);
```

por:

```ts
    setResults(newResults);
    setAnalyzed(true);
    setTourActive(false);
    setScreen('app');
    setActiveTab('diagnostico');
    addAuditEvent('ejecutó análisis', currentRole, currentUser);
    // Capa semántica: se aplica en segundo plano, sin bloquear la pantalla
    // de diagnóstico que el usuario ya está viendo con los resultados de reglas.
    void enhanceResultsInBackground(docsAislados, newResults, setResults);
```

- [ ] **Step 5: Disparar el enriquecimiento también desde demo**

En la misma función `demo`, cambiar:

```ts
    setResults(demoResults);
    setAnalyzed(true);
    setSnapshots([{
```

por:

```ts
    setResults(demoResults);
    setAnalyzed(true);
    void enhanceResultsInBackground(DEMO_DOCS, demoResults, setResults);
    setSnapshots([{
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Correr toda la suite de tests para asegurar que nada existente se rompió**

Run: `npm test`
Expected: PASS en todos los archivos de `__tests__/` (incluyendo los nuevos de las Tasks 3 y 6).

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx hooks/useAppState.ts
git commit -m "feat: disparar precarga y enriquecimiento semantico automaticos"
```

---

### Task 9: Indicador discreto en AppShell.tsx

**Files:**
- Modify: `components/AppShell.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `useSemanticModel` de `@/hooks/useSemanticModel` (Task 7).

- [ ] **Step 1: Usar el hook y renderizar el indicador**

En `components/AppShell.tsx`, agregar el import junto a los demás:

```tsx
import { useSemanticModel } from '@/hooks/useSemanticModel';
```

Dentro de `export default function AppShell({...}: AppShellProps) {`, justo después de `const canSeeRegistro = ...`, agregar:

```tsx
  const semanticStatus = useSemanticModel();
```

En el JSX, dentro de `<div className="header-right">`, ANTES de `<div className="header-role-badge">{ROLE_LABELS[role]}</div>`, agregar:

```tsx
        {semanticStatus === 'loading' && (
          <div
            className="semantic-status-badge loading"
            title="El modelo de análisis semántico local se está preparando en segundo plano"
          >
            Preparando análisis semántico…
          </div>
        )}
        {semanticStatus === 'ready' && (
          <div
            className="semantic-status-badge ready"
            title="El análisis semántico local está activo y se aplica automáticamente junto al motor de reglas"
          >
            Análisis semántico activo
          </div>
        )}
        {semanticStatus === 'error' && (
          <div
            className="semantic-status-badge error"
            title="No se pudo cargar el modelo de análisis semántico; se muestran solo los resultados del motor de reglas"
          >
            Solo motor de reglas
          </div>
        )}
```

- [ ] **Step 2: Agregar los estilos**

En `app/globals.css`, al final del archivo, agregar:

```css
/* ── Indicador discreto de la capa de análisis semántico (NLP local) ── */
.semantic-status-badge {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px;
  border-radius: 99px; font-size: 10.5px;
  font-family: var(--font-jetbrains),'JetBrains Mono',monospace;
}
.semantic-status-badge.loading {
  background: rgba(96,165,250,0.08); color: #60a5fa; border: 1px solid rgba(96,165,250,0.25);
}
.semantic-status-badge.ready {
  background: rgba(74,222,128,0.08); color: #4ade80; border: 1px solid rgba(74,222,128,0.25);
}
.semantic-status-badge.error {
  background: rgba(255,255,255,0.06); color: var(--text3); border: 1px solid rgba(255,255,255,0.12);
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/AppShell.tsx app/globals.css
git commit -m "feat: indicador discreto de estado del analisis semantico en el header"
```

---

### Task 10: Distinción visual en DiagnosticoView.tsx

**Files:**
- Modify: `components/DiagnosticoView.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `CriterioResult.origenDeteccion` y `CriterioResult.coincidenciaSemantica` (Task 4).

- [ ] **Step 1: Agregar el tag de origen semántico junto al badge del criterio**

En `components/DiagnosticoView.tsx`, dentro del `.map` de `criterios`, cambiar:

```tsx
                              <span
                                className={`confianza-dot ${c.confianza}`}
                                title={`Confianza ${c.confianza}: ${
                                  c.confianza === 'alta'
                                    ? c.frasesLegalesEncontradas?.length > 0
                                      ? 'frase legal exacta encontrada'
                                      : 'keyword con buena densidad o proximidad'
                                    : c.confianza === 'media'
                                    ? c.requiereRevisionManual
                                      ? 'término detectado en contexto negativo — revisar manualmente'
                                      : 'detectado vía sinónimo o keyword aislada'
                                    : 'no encontrado en el documento'
                                }`}
                                aria-label={`Confianza ${c.confianza}`}
                              />
                            </div>
```

por:

```tsx
                              <span
                                className={`confianza-dot ${c.confianza}`}
                                title={`Confianza ${c.confianza}: ${
                                  c.confianza === 'alta'
                                    ? c.frasesLegalesEncontradas?.length > 0
                                      ? 'frase legal exacta encontrada'
                                      : 'keyword con buena densidad o proximidad'
                                    : c.confianza === 'media'
                                    ? c.requiereRevisionManual
                                      ? 'término detectado en contexto negativo — revisar manualmente'
                                      : 'detectado vía sinónimo o keyword aislada'
                                    : 'no encontrado en el documento'
                                }`}
                                aria-label={`Confianza ${c.confianza}`}
                              />
                              {c.origenDeteccion === 'semantico' && (
                                <span
                                  className="criterio-origen-tag semantico"
                                  title="Detectado por la capa de análisis semántico (NLP), no por coincidencia exacta de palabras clave — requiere validación legal"
                                >
                                  🧠 Semántico
                                </span>
                              )}
                            </div>
```

- [ ] **Step 2: Mostrar el párrafo semántico citado**

Inmediatamente después del bloque `{/* Fragmento EXACTO del documento que respalda la detección */}` (el que contiene `{mostrarFragmento && (...)}`), agregar:

```tsx
                            {c.coincidenciaSemantica && (
                              <div className="criterio-semantico">
                                <span className="criterio-semantico-label">
                                  🧠 Posible coincidencia semántica (similitud {c.coincidenciaSemantica.nivel}) — requiere validación legal
                                </span>
                                <blockquote className="criterio-semantico-parrafo">
                                  "{c.coincidenciaSemantica.parrafo}"
                                </blockquote>
                              </div>
                            )}
```

- [ ] **Step 3: Agregar los estilos**

En `app/globals.css`, agregar (junto a los estilos de Task 9, o donde prefieras dentro de la sección de criterios):

```css
/* ── Capa de análisis semántico: distinción visual en el detalle de criterios ── */
.criterio-origen-tag.semantico {
  font-size: 10px; padding: 2px 7px; border-radius: 4px;
  background: rgba(168,85,247,0.08); color: #a855f7;
  border: 1px solid rgba(168,85,247,0.25);
  font-family: var(--font-jetbrains),'JetBrains Mono',monospace;
  flex-shrink: 0;
}
.criterio-semantico { padding-left: 26px; margin-top: 4px; }
.criterio-semantico-label {
  display: block; font-size: 9.5px; font-weight: 600; letter-spacing: 0.03em;
  text-transform: uppercase; color: #a855f7; margin-bottom: 2px;
}
.criterio-semantico-parrafo {
  margin: 0; padding: 6px 10px; border-left: 2px dashed #a855f7;
  background: rgba(168,85,247,0.05); border-radius: 0 6px 6px 0;
  font-size: 11px; font-style: italic; color: var(--text2); line-height: 1.55;
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/DiagnosticoView.tsx app/globals.css
git commit -m "feat: distinguir visualmente coincidencias semanticas en el diagnostico"
```

---

### Task 11: Verificación final end-to-end

**Files:** ninguno nuevo — solo verificación.

- [ ] **Step 1: Suite de tests completa**

Run: `npm test`
Expected: todos los tests pasan, incluyendo los nuevos de `analyzer.test.ts` y `semanticMatcher.test.ts`.

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos ni de webpack relacionados a `@xenova/transformers`.

- [ ] **Step 3: Levantar en modo desarrollo y probar manualmente**

Run: `npm run dev`

Probar en el navegador (http://localhost:3000):
1. Entrar en modo demo o con login — verificar que el indicador del header pasa de "Preparando análisis semántico…" a "Análisis semántico activo" sin que el usuario haga nada.
2. Subir un documento de política de privacidad que NO mencione ninguna de las keywords/sinónimos de "Plazo de conservación de los datos" pero sí diga algo semánticamente equivalente, por ejemplo: `"guardamos los datos hasta que el cliente solicite su baja"`.
3. Ejecutar el análisis y abrir el detalle del requisito "Política de privacidad".
4. Verificar que el criterio "Plazo de conservación de los datos" aparece como `warn` (no `fail`, nunca `ok`) con el tag "🧠 Semántico", el párrafo citado, y la nota de confianza media / revisión manual.
5. Verificar que subir el documento y ejecutar el análisis ANTES de que el indicador diga "activo" sigue mostrando el diagnóstico de reglas de inmediato (sin pantalla de carga adicional), y que el criterio semántico aparece luego, cuando el modelo termina.

- [ ] **Step 4: Commit final (si hubo ajustes durante la verificación manual)**

```bash
git add -A
git commit -m "fix: ajustes de verificacion final del analisis semantico"
```

(Omitir este paso si no hubo cambios.)
