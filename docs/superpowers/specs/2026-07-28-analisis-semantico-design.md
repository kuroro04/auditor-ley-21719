# Análisis semántico (NLP local) como capa complementaria — Diseño

Fecha: 2026-07-28
Rama: `analisis-semantico`

## Objetivo

Agregar una capa de análisis semántico (embeddings + similitud coseno) que corre
automáticamente junto al motor de reglas de `lib/analyzer.ts`, sin botón ni
activación manual, para detectar posibles coincidencias en criterios que el
motor de reglas no encontró o encontró con confianza baja/media. Esta capa
NUNCA marca un criterio como cumplido por sí sola: siempre deriva a revisión
manual con nivel de confianza medio.

## Principio de arquitectura

- Todo corre en el navegador del cliente. Los documentos jamás salen del
  dispositivo del usuario (ni al servidor de la app ni a servicios externos).
- El modelo de embeddings (`Xenova/all-MiniLM-L6-v2`, cuantizado, ~23MB) se
  **auto-hospeda** en `public/models/Xenova/all-MiniLM-L6-v2/`. Se descarga una
  única vez desde Hugging Face **durante el setup/build del proyecto** (no en
  tiempo de ejecución del navegador del usuario) y queda versionado/servido
  como asset estático. Esto mantiene el CSP actual sin cambios: ninguna
  dependencia del análisis semántico realiza llamadas de red externas desde
  el navegador del usuario, ni para documentos ni para el modelo.
- El motor de reglas sigue siendo el análisis principal y explicable; no se
  degrada ni se reemplaza.

## Archivos nuevos

- `lib/semantic/embeddingModel.ts`: singleton de carga perezosa del modelo
  (dynamic import, sin SSR), pub/sub de estado (`idle → loading → ready` o
  `error`), función `embed(textos: string[]): Promise<number[][]>`,
  `cosineSim(a: number[], b: number[]): number`, `preloadEmbeddingModel()`
  (idempotente), `getModelStatus()`, `subscribeModelStatus(cb)`.
- `lib/semantic/semanticMatcher.ts`: `splitParagraphs(texto)`,
  `construirTextoConceptoCriterio(criterio)`, y
  `enriquecerConSemantica(req, resultado, doc)` que:
  1. Identifica criterios con `status !== 'ok'`.
  2. Calcula embeddings de párrafos del documento y del "texto concepto" de
     cada criterio pendiente (memoizando embeddings de criterios, ya que no
     cambian entre documentos).
  3. Si la similitud máxima ≥ `UMBRAL_SIMILITUD_SEMANTICA` (0.5, configurable),
     adjunta evidencia semántica.
  4. Devuelve un `RequisitoResult` recalculado vía `buildRequisitoResult()`.
- `hooks/useSemanticModel.ts`: hook con `useSyncExternalStore` para exponer el
  estado del modelo a la UI sin bloquear el render.

## Archivos modificados

- `lib/analyzer.ts`: extraer el bloque final (cálculo de `cobertura`, `estado`,
  `gap`) a una función exportada `buildRequisitoResult(req, criterios, doc)`
  reutilizable por el enriquecimiento semántico. Sin cambios de comportamiento
  del motor de reglas.
- `lib/types.ts`: agregar a `CriterioResult` los campos opcionales:
  - `origenDeteccion?: 'reglas' | 'semantico'`
  - `coincidenciaSemantica?: { parrafo: string; similitud: number; nivel: 'alto' | 'medio' }`
- `hooks/useAppState.ts`: después de `finishAnalysis` y `demo` (que ya calculan
  resultados de reglas de forma síncrona e inmediata, sin cambios), disparar en
  segundo plano `enriquecerConSemantica` para cada requisito con documento
  analizable. Si el modelo no está listo, espera a que lo esté (o al error) sin
  bloquear la pantalla. Actualiza `results` por requisito a medida que cada
  enriquecimiento termina.
- `app/page.tsx`: llamar `preloadEmbeddingModel()` en un `useEffect` de montaje
  (una sola vez, apenas arranca la app, sin importar la pantalla activa).
- `components/AppShell.tsx`: indicador discreto de estado del modelo usando
  `useSemanticModel()` ("preparando análisis semántico…" /
  "análisis semántico activo" / oculto si hay error, con nota discreta
  "solo reglas" en ese caso).
- `components/DiagnosticoView.tsx`: distinguir visualmente criterios con
  `origenDeteccion === 'semantico'`: badge/ícono distinto, nota
  "Posible coincidencia semántica — requiere validación legal", párrafo citado
  y nivel de similitud (alto/medio). Los criterios con `warn` ya existente que
  además tengan `coincidenciaSemantica` muestran el párrafo como evidencia
  adicional, sin cambiar su badge de origen.
- `next.config.mjs`: agregar fallbacks de webpack (`fs`, `path`, `crypto` en
  `false`, alias `sharp: false`) para que `@xenova/transformers` bundle
  limpio en el cliente. Sin cambios al CSP.
- `package.json`: agregar dependencia `@xenova/transformers`.
- `scripts/fetch-embedding-model.mjs` (nuevo, dev-time): descarga los archivos
  del modelo desde Hugging Face hacia `public/models/...` durante el setup.
  Se documenta en README como paso único de instalación (`npm run
  fetch-model` o similar). No se ejecuta nunca desde el navegador del usuario.

## Regla de aplicación semántica

Aplica solo a criterios con `status !== 'ok'` (equivalente a "no encontrado" o
"confianza baja/media", ya que `confianza === 'alta'` implica `status ===
'ok'` en el motor actual):

- **`fail` → coincidencia semántica encontrada:** sube a `status: 'warn'`,
  `confianza: 'media'`, `requiereRevisionManual: true`,
  `origenDeteccion: 'semantico'`, se adjunta `coincidenciaSemantica`. Nunca
  sube a `ok`.
- **`warn` ya existente (evidencia débil de reglas) → coincidencia semántica
  también encontrada:** se mantiene `status: 'warn'` y `origenDeteccion:
  'reglas'`, pero se adjunta `coincidenciaSemantica` como evidencia
  corroborante adicional.
- **Sin coincidencia semántica (similitud < umbral):** el criterio queda
  exactamente como lo dejó el motor de reglas.

## Robustez y manejo de errores

- Si el usuario ejecuta el análisis antes de que el modelo termine de cargar:
  ve el resultado de reglas de inmediato (comportamiento actual sin cambios);
  el enriquecimiento semántico llega asíncronamente en cuanto el modelo esté
  listo, actualizando `results` sin loaders bloqueantes ni re-renders
  disruptivos.
- Si el modelo falla al cargar (`try/catch` en `embeddingModel.ts`): el estado
  pasa a `error`, se registra una sola vez (sin reintentos infinitos), la app
  sigue funcionando solo con reglas, y el indicador discreto lo refleja
  ("análisis semántico no disponible — se muestran solo resultados de
  reglas").
- No se usa `localStorage` para documentos; los documentos siguen en estado de
  React / el repositorio por-tenant existente (`lib/tenant/repository.ts`),
  sin cambios. El caché del modelo (pesos ya descargados) lo maneja el propio
  navegador vía Cache Storage estándar de `@xenova/transformers`, no
  documentos.

## Testing

- `lib/semantic/semanticMatcher.ts`: pruebas unitarias con un embedder mockeado
  (determinístico) para: `splitParagraphs` (casos de texto con/ sin saltos de
  línea), la regla de promoción `fail → warn` sobre el umbral, la no-promoción
  bajo el umbral, y que un `warn` existente nunca se degrada.
- `lib/analyzer.ts`: verificar que `buildRequisitoResult` extraído produce
  exactamente los mismos resultados que antes de la refactorización (test de
  regresión con los casos existentes).
- No se agregan tests de integración con el modelo real (descarga pesada); se
  mockea el embedder en todos los tests automatizados.

## Fuera de alcance (YAGNI)

- Offload a Web Worker del cómputo de embeddings (posible mejora futura si
  documentos muy grandes generan jank perceptible; no es necesario para el
  tamaño típico de documentos de cumplimiento).
- Ajuste de umbral por el usuario final vía UI (queda como constante en código,
  fácil de tunear, pero sin control expuesto en la interfaz por ahora).
- Aplicar la capa semántica a criterios ya `ok`: no aporta valor y viola el
  principio de "nunca sube automáticamente a cumplido".
