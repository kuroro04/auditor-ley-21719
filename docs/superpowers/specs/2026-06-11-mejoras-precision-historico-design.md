# DataShield 21.719 — Mejoras de Precisión e Historial
**Fecha:** 2026-06-11  
**Estado:** Aprobado

---

## Contexto

El motor de análisis de DataShield detecta cumplimiento mediante búsqueda de palabras clave en documentos subidos. La crítica principal es que puede generar falsos positivos (keyword encontrada sin cumplimiento real) y falsos negativos (término equivalente no reconocido). Además no hay seguimiento de la evolución del cumplimiento en el tiempo.

---

## Hallazgos de exploración

Antes de diseñar se exploró el estado actual del código:

- **`lib/analyzer.ts`** ya implementa detección de sinónimos (líneas 53–65) y calcula `confianza: 'alta' | 'media' | 'baja'`.
- **`lib/requisitos.ts`** ya contiene arrays `synonyms[]` para los 10 requisitos.
- **`lib/types.ts`** ya define `confianza` en `CriterioResult`.
- La UI (`DiagnosticoView.tsx`) **no muestra** el campo `confianza` al usuario.
- No existe estado ni componente de historial.
- `recharts` no está instalado — se usará SVG puro.

---

## Mejora 1 — Diccionario de sinónimos en archivo separado

### Problema
Los sinónimos están embebidos inline en `requisitos.ts`, lo que dificulta su mantenimiento y expansión.

### Solución
Crear `lib/sinonimos.ts` con un diccionario estructurado:

```ts
export const SINONIMOS: Record<string, Record<string, string[]>> = {
  politica_privacidad: {
    'Identidad y contacto del responsable de datos': [
      'controlador', 'data controller', 'encargado del tratamiento',
      'representante legal', 'titular del tratamiento',
    ],
    'Finalidad y propósito del tratamiento': [
      'motivo del tratamiento', 'uso de datos', 'razón del tratamiento',
      'para qué se usan los datos',
    ],
    // ... (todos los criterios de los 10 requisitos)
  },
  // ... (9 requisitos restantes)
};
```

`lib/requisitos.ts` importa `SINONIMOS` y popula `synonyms[]` de cada criterio desde el diccionario. El analyzer no cambia.

### Invariante
El orden de los criterios en `REQUISITOS` es determinístico (definido por el array). El matching por nombre de criterio es robusto frente a reordenamientos.

---

## Mejora 2 — Indicador visual de confianza

### Problema
El campo `confianza` existe en los datos pero es invisible al usuario, eliminando la transparencia del análisis automático.

### Solución
En `DiagnosticoView.tsx`, en cada `criterio-item`, agregar:

1. **Punto de color** junto al `criterio-found`:
   - Verde `alta`: keyword exacta hallada
   - Amarillo `media`: detectado vía sinónimo  
   - Rojo `baja`: no encontrado

2. **Nota global** encima de la lista de criterios de cada requisito:
   > *"La confianza indica qué tan segura es la detección automática. Recomendamos validación legal en criterios de confianza media o baja."*
   La nota solo aparece si el requisito tiene al menos un criterio con confianza `media` o `baja`.

### Estilos nuevos en globals.css
- `.confianza-dot` — punto circular 8×8px
- `.confianza-dot.alta` — verde `#4ade80`
- `.confianza-dot.media` — amarillo `#fcd34d`
- `.confianza-dot.baja` — rojo `#f87171`
- `.confianza-nota` — texto explicativo en gris claro

---

## Mejora 3 — Pestaña "Historial"

### Nuevo tipo en lib/types.ts

```ts
export interface HistorialSnapshot {
  fecha: string;   // ISO 8601
  pct: number;     // % cumplimiento global (0–100)
  green: number;   // cantidad requisitos verdes
  yellow: number;  // cantidad requisitos amarillos
  red: number;     // cantidad requisitos rojos
}
```

`ActiveTab` pasa de `'subir' | 'diagnostico' | 'registro' | 'riesgos'` a incluir `'historial'`.

### Cambios en useAppState.ts

- Nuevo estado: `snapshots: HistorialSnapshot[]` (inicializa en `[]`)
- `finishAnalysis` calcula y empuja un snapshot tras computar los nuevos resultados
- `logout` resetea `snapshots` a `[]`
- Exporta `snapshots`

### Nuevo componente HistorialView.tsx

**Props:** `snapshots: HistorialSnapshot[]`

**Estados renderizados:**
| Condición | UI |
|---|---|
| 0 snapshots | Estado vacío: icono + "Aún no hay análisis registrados" |
| 1 snapshot | Un punto en gráfico + mensaje "Ejecute más análisis para ver su evolución" |
| ≥2 snapshots | Gráfico SVG de línea + tabla resumen + indicador de tendencia |

**Gráfico SVG (sin dependencias):**
- Área de trazado: ancho flexible, alto fijo 200px
- Eje Y: 0%–100% con líneas de cuadrícula en 25/50/75/100%
- Eje X: etiqueta por análisis ("Análisis 1", "Análisis 2" o fecha corta)
- Línea de tendencia conectando puntos `●`
- Puntos interactivos (hover: tooltip con fecha + %)

**Indicador de tendencia** (sobre el gráfico):
- `↑ Mejoró X% desde el último análisis` — verde
- `↓ Retrocedió X% desde el último análisis` — rojo
- `→ Sin cambios` — gris

**Tabla resumen** (bajo el gráfico):
Columnas: `#` | `Fecha` | `%` | `Al día` | `Incompleto` | `Faltante`

### Cambios en AppShell.tsx

- Importa `HistorialView`
- Añade tab "Historial" en `<nav>` (visible siempre, igual que Riesgos)
- Renderiza `<HistorialView snapshots={snapshots} />` cuando `activeTab === 'historial'`
- Pasa `snapshots` como prop

---

## Archivos afectados

| Archivo | Acción |
|---|---|
| `lib/sinonimos.ts` | Crear — diccionario de sinónimos separado |
| `lib/requisitos.ts` | Modificar — importar sinónimos desde sinonimos.ts |
| `lib/types.ts` | Modificar — añadir `HistorialSnapshot`, expandir `ActiveTab` |
| `hooks/useAppState.ts` | Modificar — añadir `snapshots`, capturar en `finishAnalysis`, resetear en `logout` |
| `components/DiagnosticoView.tsx` | Modificar — renderizar `confianza`, nota explicativa |
| `components/HistorialView.tsx` | Crear — vista completa con gráfico SVG |
| `components/AppShell.tsx` | Modificar — tab Historial + prop `snapshots` |
| `app/globals.css` | Modificar — estilos confianza + historial |

---

## Restricciones confirmadas

- Sin localStorage — estado React puro
- Sin recharts ni dependencias nuevas — SVG nativo
- Tema navy + claro existente conservado (variables CSS actuales)
- Comentarios en español
- Casos borde: documento vacío, sin análisis previos, snapshot único

---

## Criterios de aceptación

1. `npm run build` pasa sin errores TypeScript
2. Los sinónimos de todos los requisitos viven en `lib/sinonimos.ts` e importan correctamente
3. Cada criterio en Mi Diagnóstico muestra un punto de color (verde/amarillo/rojo) según confianza
4. La nota explicativa aparece en requisitos con confianza media o baja
5. La pestaña Historial existe y es navegable
6. Con 0 análisis: estado vacío
7. Con 1 análisis: punto + mensaje orientador
8. Con ≥2 análisis: gráfico de línea + tabla + tendencia
9. Al hacer logout, los snapshots se borran
