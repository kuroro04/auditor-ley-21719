# DataShield 21.719 — Tres nuevas features

**Fecha:** 2026-06-05  
**Estado:** Aprobado

---

## 1. Contexto

Aplicación Next.js 14 de diagnóstico de cumplimiento Ley 21.719 chilena. State manejado en `useAppState` (React puro, sin localStorage). Tema navy + claro, fuentes Sora + Source Serif 4. Componentes principales: `AppShell`, `DiagnosticoView`, `UploadView`, `LoginCard`.

---

## 2. Feature 1 — Comparador de versiones de documentos

### Objetivo
Cuando se re-sube un documento ya analizado y se vuelve a ejecutar el análisis, mostrar la comparación de cumplimiento entre la versión anterior y la nueva.

### Cambios de tipos (`lib/types.ts`)
- `UploadedDoc` recibe campo opcional `versions?: UploadedDoc[]` con historial de versiones anteriores.
- Estado global recibe `previousResults: Record<string, RequisitoResult>` — snapshot de `results` antes de re-analizar.

### Cambios de estado (`hooks/useAppState.ts`)
- `startAnalysis()`: si `analyzed === true` (hay resultados previos), guardar `results` en `previousResults` antes de iniciar.
- `uploadDoc()`: si ya existe un doc para ese `reqId`, agregar el doc anterior al array `uploadedDocs[reqId].versions`.
- Exponer `previousResults` en el retorno del hook.

### UI (`components/DiagnosticoView.tsx`)
- En el score banner global: si `previousResults` tiene datos, mostrar "Antes: X% → Ahora: Y% (+Z%)" con color verde/rojo según delta.
- En cada brecha card: si `previousResults[r.id]` existe, mostrar banner de comparación de cobertura con los criterios que mejoraron marcados con ✓ verde animado (keyframe `checkIn`).

---

## 3. Feature 2 — Estadísticas comparativas del sector

### Objetivo
Mostrar en el diagnóstico cómo se compara la empresa vs. el promedio de su sector industrial.

### Tipos nuevos
```ts
export type Sector = 'retail' | 'salud' | 'finanzas' | 'tecnologia' | 'otro';
```

### Datos simulados (`lib/sectorData.ts`)
| Sector     | Promedio (%) | Descripción          |
|------------|-------------|----------------------|
| retail     | 58          | Comercio minorista   |
| salud      | 72          | Clínicas y farmacias |
| finanzas   | 81          | Bancos y seguros     |
| tecnologia | 65          | Software y SaaS      |
| otro       | 60          | Sector general       |

### Cambios de estado
- `sector: Sector` en `useAppState` (default `'otro'`).
- `login(rut, role, sector)` y `demo()` fijan el sector.

### UI
- `LoginCard`: selector de sector (mismo estilo que selector de rol).
- `Landing` y `page.tsx`: propagar `sector` en `onLogin`.
- Nuevo componente `SectorComparisonCard`: tarjeta insertada en `DiagnosticoView` después del score banner. Muestra dos barras horizontales: empresa (azul) vs promedio sector (gris), con etiquetas de porcentaje.

---

## 4. Feature 3 — Onboarding / Tour guiado

### Objetivo
La primera vez que un usuario entra (login o demo), mostrar un tour de 3 pasos con tooltips que señalan zonas clave de la UI.

### Cambios de estado
- `tourActive: boolean` y `tourStep: number` (0–2) en `useAppState`.
- `login()` y `demo()` fijan `tourActive = true`, `tourStep = 0`.
- Acción `advanceTour()` incrementa `tourStep`; si supera 2, fija `tourActive = false`.
- Acción `skipTour()` fija `tourActive = false`.

### Pasos del tour
| Paso | Mensaje | Target (`data-tour`) |
|------|---------|----------------------|
| 0 | "Suba aquí sus documentos actuales" | `upload-zone` — grid de carga en `UploadView` |
| 1 | "Presione Analizar para revisar su cumplimiento" | `analyze-btn` — botón analizar en `UploadView` |
| 2 | "Revise su diagnóstico y qué le falta" | `tab-diagnostico` — tab en `AppShell` |

### UI (`components/OnboardingTour.tsx`)
- Overlay `position: fixed, inset: 0` semitransparente (navy 60% opacidad).
- Tooltip `position: fixed` posicionado con `getBoundingClientRect()` del target via `document.querySelector('[data-tour="..."]')`.
- Tooltip con título, descripción, paso X/3, botones "Siguiente" y "Saltar tour".
- Integrado en `AppShell` sobre todos los demás elementos.
- Respetar `prefers-reduced-motion` (sin transiciones si está activo).

---

## 5. Archivos a modificar / crear

| Archivo | Acción |
|---|---|
| `lib/types.ts` | + `Sector`, + `versions[]` en `UploadedDoc`, + `previousResults` |
| `lib/sectorData.ts` | **Nuevo** — datos y tipo por sector |
| `hooks/useAppState.ts` | + `sector`, `previousResults`, `tourActive`, `tourStep`, `advanceTour`, `skipTour` |
| `components/LoginCard.tsx` | + selector de sector; `onLogin` recibe sector |
| `components/Landing.tsx` | propagar sector en `onLogin` |
| `app/page.tsx` | propagar sector a `state.login` |
| `components/DiagnosticoView.tsx` | + banner comparación + `SectorComparisonCard` |
| `components/SectorComparisonCard.tsx` | **Nuevo** |
| `components/OnboardingTour.tsx` | **Nuevo** |
| `components/AppShell.tsx` | + `data-tour` attrs + montar `OnboardingTour` + tour props |
| `components/UploadView.tsx` | + `data-tour` attrs en grid y botón analizar |
| `app/globals.css` | + estilos tour, comparación versiones, sector card, check animado |

---

## 6. Restricciones

- Sin localStorage ni sessionStorage.
- Mantener tema navy + claro, Sora + Source Serif 4.
- Todo compatible con `npm run dev` en Windows/OneDrive.
