# Clasificación de tipo de documento y endurecimiento de evidencia

**Fecha:** 2026-10-13
**Área:** `lib/analyzer.ts`, `lib/requisitos.ts`, `lib/types.ts`, `__tests__/analyzer.test.ts`

---

## Contexto y motivación

El motor de análisis clasifica como "Política de privacidad con 100% de cumplimiento del Art. 14" un plan maestro de gestión de proyecto de 9.647 palabras que *habla sobre* la Ley 21.719 sin serlo. Dos raíces del problema:

1. El motor no distingue si el documento *es* del tipo esperado o *describe* el tipo esperado. Evalúa cualquier texto contra cualquier requisito.
2. El umbral de evidencia es demasiado permisivo: una sola frase legal encontrada basta para `status = 'ok'`, y la densidad de keywords se mide en términos absolutos sin considerar el largo del documento.

---

## Principios de diseño

- **Preferir falsos negativos.** Marcar algo como "requiere revisión" es aceptable; marcar como cumplido algo que no lo está, no.
- **Explicabilidad total.** Cada conclusión debe mostrar qué regla y qué fragmento la produjeron.
- **No romper los casos buenos.** Una política de privacidad real (incluso concisa, ~400 palabras) debe seguir dando cobertura alta.
- **Consistencia interna.** Los tres cambios al umbral de evidencia siguen el mismo principio: penalizar la confianza, no excluir evidencia binariamente.

---

## Cambio 1 — Clasificación del tipo de documento (nuevo paso previo)

### Señal elegida: voz gramatical (performativa vs. normativa)

Un documento que *cumple* una obligación usa lenguaje **performativo**: declara en primera persona o en modo imperativo directo sobre sí mismo ("tratamos sus datos", "usted tiene derecho a", "la empresa responsable es"). Un documento que *describe* una obligación usa lenguaje **normativo**: habla en tercera persona sobre lo que la ley exige ("la ley exige", "el responsable debe informar", "según el artículo").

Esa distinción de voz es la señal más robusta y generalizable porque no depende de secciones ni de formatos específicos.

### Estructura de marcadores

Cada `Requisito` gana un campo `clasificacion` con dos listas de marcadores:

```typescript
clasificacion: {
  marcadoresPerformativos: string[];   // indican que el doc ES del tipo
  marcadoresNormativos: {
    tier1: string[];  // voz gramatical — señal fuerte, generalizable
    tier2: string[];  // léxico específico — señal débil, corrobora pero no decide
  };
}
```

**Tier 1 (voz gramatical — decide):** frases que describen lo que la ley exige en modo descriptivo/tercero. Ejemplos transversales a todos los tipos:
- `"la ley exige"`, `"el art."`, `"según el artículo"`, `"el responsable debe"`, `"debe informar"`, `"este artículo establece"`, `"la normativa requiere"`, `"la empresa está obligada"`, `"este documento explica"`, `"conforme a la ley"`

**Tier 2 (léxico específico — corrobora):** frases de documentos descriptivos que no generalizan a todo contexto. Solo añaden peso cuando Tier 1 ya está presente. Ejemplos para plan maestro:
- `"este plan"`, `"plan maestro"`, `"cronograma"`, `"hito"`, `"análisis de cumplimiento"`, `"etapa"`, `"equipo de proyecto"`

**Performativos para `politica_privacidad`:**

*Primera y segunda persona (el responsable declara directamente):*
- `"tratamos sus datos"`, `"tratamos tus datos"`, `"sus datos personales son tratados"`, `"usted tiene derecho a"`, `"usted puede ejercer"`, `"puede solicitar acceso"`, `"nuestros datos de contacto"`, `"la empresa responsable es"`, `"somos responsables de"`, `"recopilamos los siguientes datos"`, `"utilizamos sus datos para"`, `"conservamos sus datos"`, `"le informamos que"`, `"datos del responsable"`

*Tercera persona formal (el responsable se nombra a sí mismo):* Los fixtures reales muestran que las políticas redactadas en tercera persona formal ("el Usuario podrá", "Cencosud conservará") tienen CERO hits de los marcadores anteriores. Estos patrones solo aparecen en políticas, no en artículos descriptivos (verificado contra F5):
- `"el usuario podrá"`, `"el titular podrá"`, `"el usuario tendrá"`, `"el titular tendrá"` — concesión de derechos a sujeto nominado
- `"representante legal corresponde"` — identifica al responsable legal específico
- `"conservará los datos"` — compromiso de retención en nombre del responsable (ausente en blog artículo: confirmado)
- `"consiente expresamente"` — declaración de consentimiento del titular en contexto de política

*(Los performativos para cada uno de los otros 9 requisitos se definen en el plan de implementación, siguiendo el mismo patrón: primera persona, segunda persona directa, o tercera persona formal que declara el cumplimiento.)*

### Hallazgo del fixture real (Plan Maestro, 9.039 palabras)

Verificación sobre el PDF extraído revela que el plan maestro **no usa frases de tipo "la ley exige" o "el responsable debe"**. El lenguaje real del documento es:
- "diagnóstico de cumplimiento de la Ley N° 21.719"
- "obligación legal con fecha cierta"
- "brecha de cumplimiento"
- "plan maestro", "etapa", "cronograma", "hito", "factibilidad"

El documento tiene **cero marcadores performativos** y **múltiples marcadores Tier 2**. Con la lógica inicial (Tier 2 nunca decide solo), el plan maestro caería en `'dudoso'` en lugar de `'incorrecto'`. La lógica se ajusta a continuación.

### Lógica de clasificación (ajustada por fixture)

El umbral para que Tier 2 contribuya a `'incorrecto'` es **≥ 3 marcadores distintos**, no 1 ni 2 aislados. Esto mantiene el espíritu del ajuste del usuario (un marcador específico no decide) mientras cubre documentos de gestión de proyectos con vocabulario claramente distinto.

```
función clasificarDocumento(req, doc):
  texto = doc.text.toLowerCase()
  
  nPerformativos  = número de marcadores performativos encontrados (distintos)
  nNormativos_t1  = número de marcadores Tier 1 encontrados (distintos)
  nNormativos_t2  = número de marcadores Tier 2 encontrados (distintos)
  
  si nPerformativos >= 1:
    si nNormativos_t1 < nPerformativos × 3:
      → 'correcto'
    si no:
      → 'dudoso'  (señales mixtas — puede ser documento híbrido)
  
  si nPerformativos == 0:
    si nNormativos_t1 >= 2:
      → 'incorrecto'                    ← voz gramatical normativa clara
    si nNormativos_t1 == 1 Y nNormativos_t2 >= 2:
      → 'incorrecto'                    ← Tier 1 + corroboración Tier 2
    si nNormativos_t2 >= 3:
      → 'incorrecto'                    ← Tier 2 alto (≥3 distintos) sin ningún performativo
    si no:
      → 'dudoso'                        ← caso vacío o evidencia insuficiente
```

Plan Maestro bajo esta lógica: `nPerformativos=0`, `nNormativos_t1=0`, `nNormativos_t2≥5` (plan maestro, etapa, cronograma, hito, análisis de, gestión de proyecto) → **`'incorrecto'`**. ✓

Observación: el caso `nPerformativos == 0 && todo_lo_demás == 0` da `'dudoso'`, no `'incorrecto'`. El motor solo bloquea con evidencia positiva.

### Comportamiento según clasificación

| Tipo | Efecto en el análisis |
|------|----------------------|
| `'correcto'` | Flujo normal sin cambios |
| `'dudoso'` | Análisis corre completo, pero `estado` máximo es `'yellow'` aunque cobertura >= 75%. Gap advierte al usuario. |
| `'incorrecto'` | `analyzeDocument` retorna `estado: 'wrong_type'`. No se calcula cobertura ni criterios. El gap explica qué señales se encontraron y qué tipo esperaba el requisito. |

### Extensión de `RequisitoResult`

```typescript
// lib/types.ts
export interface RequisitoResult {
  estado: 'green' | 'yellow' | 'red' | 'unanalyzable' | 'wrong_type';  // nuevo valor
  cobertura: number;
  criterios: CriterioResult[];
  gap: string;
  clasificacionDocumento?: {
    tipo: 'correcto' | 'dudoso' | 'incorrecto';
    razon: string;
    performativosEncontrados: string[];
    normativosEncontrados: string[];
  };
}
```

### Extensión de `Requisito`

```typescript
// lib/types.ts
export interface ClasificacionConfig {
  marcadoresPerformativos: string[];
  marcadoresNormativos: {
    tier1: string[];
    tier2: string[];
  };
}

export interface Requisito {
  // ... campos actuales ...
  clasificacion: ClasificacionConfig;
}
```

---

## Cambio 2 — Frase legal sola no basta para 'ok'

**Situación actual (línea 217):**
```typescript
if (frasesEncontradas.length > 0 || kwsValidas.length >= umbralOk) status = 'ok';
```

Una sola frase legal encontrada, sin importar el contexto ni la densidad, produce `'ok'`.

**Nueva regla:**

```
si frasesEncontradas.length >= 1 Y kwsValidas.length >= 1:
  status = 'ok'
si frasesEncontradas.length >= 1 Y kwsValidas.length == 0:
  status = 'warn', confianza = 'alta'  ← frase fuerte pero sin soporte de keywords
si kwsValidas.length >= umbralOk:
  status = 'ok'
```

El campo `found` explicará la situación: "Frase legal encontrada pero sin keywords de soporte — requiere revisión". Explicabilidad preservada.

**Por qué es seguro para políticas concisas (~400 palabras):** una política real de 400 palabras que contiene una frase legal exacta casi siempre contiene también al menos 1 keyword válida en contexto. Si no la tiene, el `'warn'` es la señal correcta.

---

## Cambio 3 — Densidad relativa al largo del documento

**Situación actual:** `UMBRAL_DENSIDAD_ALTA = 3` menciones absolutas. En 9.600 palabras, 3 menciones de "responsable" es ruido de fondo.

**Nuevo cálculo:**

```typescript
const UMBRAL_DENSIDAD_RELATIVA = 1.0; // menciones por 1000 palabras

const densidadRelativa = doc.wordCount && doc.wordCount > 0
  ? (densidad * 1000) / doc.wordCount
  : densidad; // fallback si no hay wordCount
```

La densidad relativa reemplaza a la densidad absoluta solo en el cálculo de **confianza** — sigue siendo un factor de peso, no un gate. El campo `densidad` que se devuelve en `CriterioResult` mantiene el valor absoluto para explicabilidad; se agrega `densidadRelativa` como campo adicional o se documenta en el campo `found`.

**Tabla de confianza revisada (para el caso keywords):**

| Condición | Confianza |
|-----------|-----------|
| frasesEncontradas >= 1 AND kwsValidas >= 1 | `'alta'` |
| kwsValidas >= umbralOk AND densidadRelativa > 1.0 AND proximidad | `'alta'` |
| kwsValidas >= umbralOk AND (densidadRelativa > 1.0 OR proximidad) | `'alta'` |
| kwsValidas >= umbralOk | `'media'` |
| kwsValidas > 0 (bajo umbral) | `'media'` |
| sinonimosValidos > 0 | `'media'` |
| sin evidencia | `'baja'` |

---

## Cambio 4 — Contexto normativo como penalizador de confianza (no exclusión)

**Ajuste del diseño original:** el contexto normativo penaliza la confianza del keyword, no lo elimina. Esto es consistente con el Cambio 3 (densidad como factor de confianza, no gate binario).

**Motivación:** "debe" aparece constantemente en políticas reales en cláusulas performativas ("usted debe acreditar su identidad", "la empresa debe responder dentro de 30 días"). Excluir ese keyword del todo sería demasiado agresivo.

**Señales de contexto normativo** (ventana de 8 palabras antes del keyword):
```
"la ley", "el art.", "el artículo", "según el", "conforme al", 
"la norma", "la normativa", "exige que", "obliga a", "requiere que",
"establece que", "dispone que"
```

**Nuevo campo en `EvaluacionCriterio`:**

```typescript
kwsEnContextoNormativo: string[]; // keywords válidas halladas en contexto normativo
```

Un keyword en contexto normativo:
- **Sigue contando** en `kwsValidas` (para `status`)
- **Contribuye negativamente a confianza**: si la mayoría de las keywords válidas están en contexto normativo, la confianza sube un nivel menos de lo que subiría normalmente (alta → media, media se mantiene)
- **Aparece en `found`** como "Términos en contexto normativo: 'X'" para explicabilidad

**Regla de penalización:**

```
si kwsEnContextoNormativo.length > kwsValidas.length / 2:
  confianza -= 1 nivel (alta→media, media se mantiene en media)
```

---

## Corpus de regresión

Los tests viven en `__tests__/documentClassification.test.ts`. Los bloques marcados con `describe.skip` se activan en cuanto el fixture esté en `__tests__/fixtures/`.

### Formato requerido para los fixtures que proveerá el usuario

- **Codificación:** UTF-8, sin BOM
- **Formato:** texto plano (`.txt`)
- **Contenido:** el texto del documento tal como lo produciría el pipeline de extracción — sin metadatos del PDF, sin encabezados de página, sin números de página. Si el documento original es PDF, pegar el texto seleccionable; si es Word, el texto sin formato.
- **Sin transformación:** no aplicar `.toLowerCase()` ni limpiar caracteres — el test lo hace internamente.
- **Nombres exactos:**

| Fixture | Archivo | Estado |
|---------|---------|--------|
| F1 — Plan Maestro (9.039 palabras) | `__tests__/fixtures/plan-maestro-proyecto.txt` | ✅ DISPONIBLE |
| F2 — Política completa (Centro Médico Antofagasta, ~1.625 palabras) | `__tests__/fixtures/politica-privacidad-completa.txt` | ✅ DISPONIBLE |
| F3 — Política concisa (Escuela de Seguros, ~776 palabras) | `__tests__/fixtures/politica-privacidad-concisa.txt` | ✅ DISPONIBLE |
| F4 — Política en tercera persona (Cencosud/Jumbo, ~1.578 palabras) | `__tests__/fixtures/politica-tercera-persona.txt` | ✅ DISPONIBLE |
| F5 — Artículo de blog descriptivo (~1.961 palabras) | `__tests__/fixtures/articulo-sobre-la-ley.txt` | ✅ DISPONIBLE |
| F6 — RAT en slot incorrecto | `__tests__/fixtures/rat-documento.txt` | ⏳ PENDIENTE |
| F7 — Contrato con cláusula | `__tests__/fixtures/contrato-con-clausula-privacy.txt` | ⏳ PENDIENTE |

### Fixture 1 — Plan Maestro de Gestión de Proyecto
**Estado:** ✅ DISPONIBLE (9.039 palabras, extraído del PDF del proyecto)
**Clasificación esperada para `politica_privacidad`:** `'incorrecto'`
**Resultado esperado:** `estado: 'wrong_type'`, cobertura 0
**Señal detectada:** cero performativos, ≥5 marcadores Tier 2 (plan maestro, etapa, cronograma, hito, análisis de, gestión de proyecto)

### Fixture 2 — Política completa, Centro Médico Antofagasta (~1.625 palabras)
**Estado:** ✅ DISPONIBLE
**Clasificación esperada:** `'correcto'`
**Resultado esperado (post-implementación + vocabulario 19.628):** `estado: 'green'`, cobertura >= 75%
**Baseline actual:** `estado: 'yellow'`, cobertura 70% — causa: vocabulario 19.628 en tres criterios (ver Tarea de Vocabulario)
**Criterio crítico (Cambio 2):** ningún criterio con `frasesLegalesEncontradas.length > 0` y `kwFound === 0` tiene `status === 'ok'`
**Criterios que fallan con motor actual:**
- *Finalidad:* kw=1/4 — usa "finalidades" (plural) y verbos como "El Centro tratará sus datos"
- *Base legal:* kw=2/4 — usa "Base de Licitud" (19.628) en lugar de "base legal" (21.719)  
- *Plazo:* kw=1/5 — solo "tiempo"; usa "Vigencia del tratamiento de datos" (19.628) y "La información se conservará" (verbo futuro)

### Fixture 3 — Política concisa, Escuela de Seguros de Chile (~776 palabras)
**Estado:** ✅ DISPONIBLE
**Clasificación esperada:** `'correcto'`
**Resultado esperado:** `estado: 'yellow'` o `'green'` — ambos aceptables; `'red'` no aceptable
**Baseline actual:** `estado: 'yellow'`, cobertura 70%
**Criterios que fallan con motor actual:**
- *Identidad:* kw=2/5 — usa "RUT" y la sección "12. Contacto" pero no "responsable" ni "domicilio" exactos
- *Base legal:* kw=2/4 — usa "Bases de legitimación", "Consentimiento expreso", "Interés legítimo" — mezcla 19.628 y vocabulario generalista
- *ARCO:* kw=1/6 — usa infinitivos ("Acceder, rectificar, cancelar u oponerse") no los sustantivos del checklist; solo "derechos" (de sección "8. Derechos de los titulares") cuenta

### Fixture 4 — Política en tercera persona, Cencosud/Jumbo (~1.578 palabras)
**Estado:** ✅ DISPONIBLE
**Clasificación esperada:** `'correcto'` — el clasificador no debe bloquear políticas en tercera persona formal
**Resultado esperado:** `estado: 'yellow'` o `'green'`, tipo `!== 'incorrecto'`, `estado !== 'wrong_type'`
**Baseline actual:** `estado: 'yellow'`, cobertura 70%
**Gap de clasificación:** con los marcadores performativos originales (solo 1ª/2ª persona), F4 tendría CERO hits → caería en `'dudoso'`. La adición de marcadores de tercera persona formal resuelve este caso.
**Performativos que sí aparecen en F4:** "el usuario podrá" ✓, "el usuario tendrá" ✓, "representante legal corresponde" ✓, "conservará los datos" ✓, "consiente expresamente" ✓ — ninguno de estos aparece en F5 (blog).

### Fixture 5 — Artículo de blog descriptivo (~1.961 palabras)
**Estado:** ✅ DISPONIBLE
**Clasificación esperada:** `'incorrecto'`
**Resultado esperado:** `estado: 'wrong_type'`
**Baseline actual (falso positivo):** `estado: 'green'`, cobertura 90% — confirma el bug
**Señales que lo delatan:** cero performativos (ni 1ª, ni 2ª, ni 3ª persona formal); múltiples Tier 1 implícitos (habla sobre "la ley", "la empresa debe"); vocabulario incluye "responsable del tratamiento" y todas las keywords porque las EXPLICA.

### Fixture 6 — RAT en slot de Política de Privacidad
**Estado:** ⏳ PENDIENTE — Registro de Actividades de Tratamiento real
**Resultado esperado:** `clasificacionDocumento.tipo !== 'correcto'`, `estado !== 'green'`

### Fixture 7 — Contrato con cláusula de privacidad
**Estado:** ⏳ PENDIENTE — contrato con una sola cláusula de datos
**Resultado esperado:** `estado !== 'green'`

### Casos de regresión adicionales recomendados

Si al buscar material encuentras alguno de estos, son valiosos:

| Caso | Archivo sugerido | Por qué importa |
|------|-----------------|-----------------|
| Aviso de privacidad muy breve (< 200 palabras, tipo "pop-up de cookies") | `aviso-privacidad-brevísimo.txt` | Verifica que sea `'dudoso'`, no `'incorrecto'` |
| Política en tercera persona formal ("El usuario podrá solicitar...") | variante del Fixture 2 o 3 | El clasificador no debe penalizar la voz en tercera persona |
| Política de privacidad interna de empleados (RRHH) | `politica-privacidad-rrhh.txt` | Performativos distintos ("el trabajador tiene derecho"); verifica generalización |
| Reglamento interno de datos | `reglamento-interno.txt` | Parecido a RAT; lenguaje normativo interno |

---

## Tarea de vocabulario — Compatibilidad con Ley 19.628

### Motivación

Los documentos reales que los usuarios subirán hasta diciembre de 2026 citan la Ley 19.628. El análisis de baseline muestra que F2, F3 y F4 quedan en `'yellow'` (70%) porque el motor usa terminología 21.719 mientras las políticas usan terminología 19.628. Con el gap abierto, la plataforma reporta "cumplimiento parcial" a todos los usuarios durante justo el período de mayor uso.

Los sinónimos en `sinonimos.ts` **no resuelven este problema**: el motor solo los evalúa cuando `kwsValidas === 0 AND frasesEncontradas === 0`. Como las políticas reales siempre tienen al menos 1 keyword, los sinónimos se saltan. El mecanismo correcto para criterios con keywords existentes es **agregar frases 19.628 a `lib/frasesLegales.ts`**.

### Principios de la expansión

1. **Adición, nunca reemplazo.** Las frases 21.719 permanecen. El motor entiende ambos registros.
2. **Verbos además de sustantivos.** El análisis muestra que F3 usa infinitivos ("acceder, rectificar, cancelar u oponerse") donde el checklist espera sustantivos ("acceso", "rectificación"). La expansión cubre las formas verbales.
3. **Tests propios, separados de los de clasificación.** El archivo `__tests__/vocabularyRegression.test.ts` cubre específicamente estas adiciones.

### Adiciones a `lib/frasesLegales.ts` (para `politica_privacidad`)

El mecanismo que activa las frases legales: cualquier frase encontrada + ≥1 keyword → `status: 'ok'` (Cambio 2). Las adiciones deben cumplir: presentes en políticas reales, ausentes en el blog artículo (F5), o bien irrelevantes si F5 ya queda bloqueado por `'wrong_type'`.

**Criterio "Finalidad y propósito del tratamiento":**
- `"finalidades del tratamiento"` — plural, F3: "4. Finalidad del tratamiento / Los datos personales serán utilizados para"
- `"datos personales serán utilizados para"` — forma verbal pasiva, literal en F3
- `"tratará sus datos personales"` — forma verbal futura, F2: "El Centro tratará sus datos personales"

**Criterio "Base legal (consentimiento / interés legítimo)":**
- `"base de licitud"` — término exacto 19.628, F2: "IV. Base de Licitud del Tratamiento"
- `"bases de legitimación"` — variante doctrinal, F3: "5. Bases de legitimación"
- `"consentimiento expreso del titular"` — forma completa, F3 literal
- `"interés legítimo"` — aparece en F3: "Interés legítimo en la mejora de procesos"

**Criterio "Derechos ARCO del titular":**
- `"acceder, rectificar, cancelar u oponerse"` — fórmula literal 19.628, F3 literal; el blog usa sustantivos ("acceso, rectificación"), no esta fórmula verbal
- `"revocar su consentimiento"` — F3: "Revocar su consentimiento en cualquier momento"
- `"solicitar la eliminación"` — F3: "Solicitar la eliminación o portabilidad de sus datos"

**Criterio "Plazo de conservación de los datos":**
- `"conservará los datos"` — F4: "Cencosud Retail S.A. conservará los datos del Usuario"; ausente en blog (verificado)
- `"durante el tiempo necesario"` — F3: "conservados durante el tiempo necesario para cumplir las finalidades"
- `"vigencia del tratamiento"` — F2: sección "II. Vigencia del tratamiento de datos"
- `"serán conservados durante"` — forma pasiva frecuente en 19.628

**Criterio "Identidad y contacto del responsable de datos":**
Sin cambios — F2 ya alcanza `ok` con motor actual (kw=3/5, frases=3).

### Adiciones a `lib/sinonimos.ts` (para casos de cero keywords)

Solo son útiles cuando ningún keyword se encuentra. Cubren edge cases: políticas muy informales o con vocabulario completamente distinto.

```
politica_privacidad:
  'Identidad y contacto del responsable de datos':
    + 'razón social'         — F2: "Razón social: Centro Médico Antofagasta S.A."
    + 'domiciliada'          — F4: "domiciliada para estos efectos en Av. Kennedy"
  'Base legal (consentimiento / interés legítimo)':
    + 'base de licitud'      — 19.628 (también en frasesLegales para el caso con keyword)
    + 'bases de legitimación' — variante doctrinal
  'Derechos ARCO del titular (acceso, rectificación...)':
    + 'acceder'              — infinitivo de "acceso"
    + 'rectificar'           — infinitivo de "rectificación"
    + 'oponerse'             — infinitivo de "oposición"
  'Plazo de conservación de los datos':
    + 'conservará'           — futuro verbal
    + 'vigencia'             — sustantivo 19.628
```

### Efecto esperado tras la expansión (sobre motor actual, sin clasificación aún)

| Fixture | Antes | Después (proyectado) |
|---------|-------|----------------------|
| F2 Centro Médico | yellow 70% (2 ok + 3 warn) | green ~100% (5 ok) |
| F3 Escuela de Seguros | yellow 70% (2 ok + 3 warn) | yellow o green (3–4 ok) |
| F4 Cencosud | yellow 70% (2 ok + 3 warn) | yellow o green (3–4 ok) |
| F1 Plan Maestro | green 100% → bloqueado por clasificación como `wrong_type` | wrong_type (no puntúa) |
| F5 Blog | green 90% → bloqueado por clasificación como `wrong_type` | wrong_type (no puntúa) |

*Nota:* F3 y F4 no alcanzan necesariamente green porque algunos criterios siguen con evidencia débil incluso con 19.628. Lo importante es que dejan de ser `'red'` y que las políticas completas (F2) alcanzan `'green'`.

---

### Test existente que debe actualizarse

`__tests__/analyzer.test.ts` línea 7: el fixture actual es una cadena de keywords sin prosa. Con los cambios de clasificación, ese texto devuelve `'dudoso'` o `'wrong_type'`. El primer test debe reemplazarse por el Fixture 2 real cuando esté disponible. Los otros dos tests (sin documento, escaneado) no se ven afectados.

---

## Archivos afectados

| Archivo | Cambio | Tarea |
|---------|--------|-------|
| `lib/types.ts` | Agregar `'wrong_type'` a `RequisitoResult.estado`; agregar `ClasificacionConfig`; agregar `clasificacionDocumento?` a `RequisitoResult`; agregar `kwsEnContextoNormativo` a `CriterioResult` | Clasificación |
| `lib/requisitos.ts` | Agregar campo `clasificacion` a cada uno de los 10 `REQUISITOS` | Clasificación |
| `lib/analyzer.ts` | Nueva función `clasificarDocumento()`; modificar `evaluarCriterio()` para Cambios 2–4; modificar `analyzeDocument()` para llamar clasificación antes de evaluar criterios | Clasificación + Endurecimiento |
| `lib/frasesLegales.ts` | Agregar frases 19.628 para cuatro criterios de `politica_privacidad` (ver sección Vocabulario) | Vocabulario 19.628 |
| `lib/sinonimos.ts` | Agregar sinónimos 19.628 y formas verbales para edge cases (ver sección Vocabulario) | Vocabulario 19.628 |
| `__tests__/analyzer.test.ts` | Reemplazar fixture de keyword-soup con `politica-privacidad-completa.txt`; los otros dos tests sin cambios | Post-clasificación |
| `__tests__/documentClassification.test.ts` | Corpus de regresión: F1–F5 activos, F6–F7 en skip | Clasificación |
| `__tests__/vocabularyRegression.test.ts` (nuevo) | Tests específicos de adiciones 19.628 y formas verbales, separados del corpus de clasificación | Vocabulario 19.628 |
| `__tests__/fixtures/` | F1–F5 ya presentes; F6–F7 pendientes del usuario | — |

---

## Lo que este spec no cubre

- La UI que renderiza el estado `'wrong_type'` (mensaje de error, icono). Eso es un cambio UI separado.
- Los marcadores performativos y normativos de los requisitos 2–10. Se definen en el plan de implementación por el implementador, siguiendo la misma lógica que `politica_privacidad`.
- Ajuste del umbral `UMBRAL_SIMILITUD_SEMANTICA` en `semanticMatcher.ts`. Los cambios no tocan la capa semántica.
