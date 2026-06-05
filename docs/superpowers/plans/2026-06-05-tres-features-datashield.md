# DataShield 21.719 — Tres Features: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar comparador de versiones de documentos, estadísticas comparativas por sector, y tour guiado de onboarding en la plataforma DataShield 21.719.

**Architecture:** Tres features ortogonales integradas al estado central `useAppState`. Se agregan dos nuevos tipos (`Sector`, datos de benchmark), dos nuevos componentes (`SectorComparisonCard`, `OnboardingTour`), y se extienden los componentes existentes con nuevas props. Todo en estado React, sin localStorage.

**Tech Stack:** Next.js 14, React 18, TypeScript, CSS custom properties (variables en globals.css)

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `lib/types.ts` | Modificar | + tipo `Sector` |
| `lib/sectorData.ts` | **Crear** | Datos de benchmark y opciones de sector |
| `hooks/useAppState.ts` | Modificar | + `sector`, `previousResults`, `tourActive`, `tourStep`, `advanceTour`, `skipTour` |
| `components/LoginCard.tsx` | Modificar | + selector de sector |
| `components/Landing.tsx` | Modificar | Propagar firma `onLogin` con `sector` |
| `app/page.tsx` | Modificar | Pasar `sector` y props de tour a AppShell |
| `components/SectorComparisonCard.tsx` | **Crear** | Tarjeta con barras comparativas empresa vs sector |
| `components/OnboardingTour.tsx` | **Crear** | Overlay spotlight + tooltip paso a paso |
| `components/UploadView.tsx` | Modificar | + atributos `data-tour` en grid y botón |
| `components/AppShell.tsx` | Modificar | + `data-tour` en tab, montar tour, pasar props nuevas |
| `components/DiagnosticoView.tsx` | Modificar | + banner versión global, comparación por card, SectorComparisonCard |
| `app/globals.css` | Modificar | + estilos tour, sector card, comparador de versiones |

---

## Task 1: Tipos base y datos de sector

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/sectorData.ts`

- [ ] **Step 1: Agregar tipo Sector al final de lib/types.ts**

Abrir `lib/types.ts` y agregar al final, antes del cierre del archivo:

```typescript
export type Sector = 'retail' | 'salud' | 'finanzas' | 'tecnologia' | 'otro';
```

- [ ] **Step 2: Crear lib/sectorData.ts**

```typescript
import type { Sector } from './types';

export interface SectorBenchmark {
  label: string;
  promedio: number;       // porcentaje 0-100
  descripcion: string;
}

// Datos simulados realistas del mercado chileno post Ley 21.719
export const SECTOR_DATA: Record<Sector, SectorBenchmark> = {
  retail:     { label: 'Retail / Comercio',  promedio: 58, descripcion: 'Supermercados, tiendas y comercio electrónico' },
  salud:      { label: 'Salud',              promedio: 72, descripcion: 'Clínicas, farmacias y prestadores de salud' },
  finanzas:   { label: 'Finanzas',           promedio: 81, descripcion: 'Bancos, corredoras y compañías de seguros' },
  tecnologia: { label: 'Tecnología',         promedio: 65, descripcion: 'Software, SaaS y telecomunicaciones' },
  otro:       { label: 'Sector General',     promedio: 60, descripcion: 'Promedio general de empresas chilenas' },
};

export const SECTORES_OPCIONES: { value: Sector; label: string; desc: string }[] = [
  { value: 'retail',     label: 'Retail / Comercio',    desc: 'Tiendas, supermercados, e-commerce' },
  { value: 'salud',      label: 'Salud',                desc: 'Clínicas, farmacias, isapres' },
  { value: 'finanzas',   label: 'Finanzas',             desc: 'Bancos, seguros, AFP' },
  { value: 'tecnologia', label: 'Tecnología',           desc: 'Software, SaaS, telecomunicaciones' },
  { value: 'otro',       label: 'Otro sector',          desc: 'Industria, servicios, educación...' },
];
```

- [ ] **Step 3: Verificar tipos**

```
npx tsc --noEmit
```

Esperado: 0 errores (los dos archivos nuevos son independientes).

- [ ] **Step 4: Commit**

```
git add lib/types.ts lib/sectorData.ts
git commit -m "feat: tipo Sector y datos de benchmark por sector"
```

---

## Task 2: Estado global extendido

**Files:**
- Modify: `hooks/useAppState.ts`

- [ ] **Step 1: Actualizar import de tipos**

Reemplazar la línea de import de tipos al inicio del archivo:

```typescript
import type { Screen, ActiveTab, UploadedDoc, RequisitoResult, UserRole, AuditEvent, Sector } from '@/lib/types';
```

- [ ] **Step 2: Agregar nuevas variables de estado**

Dentro de `useAppState()`, inmediatamente después de `const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);`, agregar:

```typescript
const [sector, setSector]                   = useState<Sector>('otro');
const [previousResults, setPreviousResults] = useState<Record<string, RequisitoResult>>({});
const [tourActive, setTourActive]           = useState(false);
const [tourStep, setTourStep]               = useState(0);
```

- [ ] **Step 3: Reemplazar callback login**

```typescript
const login = useCallback((rut: string, selectedRole: UserRole, selectedSector: Sector = 'otro') => {
  setCompanyName(rut);
  setRole(selectedRole);
  setSector(selectedSector);
  setTourActive(true);
  setTourStep(0);
  setScreen('app');
  setActiveTab('subir');
}, []);
```

- [ ] **Step 4: Reemplazar callback demo**

```typescript
const demo = useCallback(() => {
  setCompanyName('Empresa Demo S.A.');
  setRole('administrador');
  setSector('tecnologia');
  setUploadedDocs(DEMO_DOCS);
  setTourActive(true);
  setTourStep(0);
  setScreen('app');
  setActiveTab('subir');
}, []);
```

- [ ] **Step 5: Reemplazar callback logout**

```typescript
const logout = useCallback(() => {
  setCompanyName('');
  setRole('administrador');
  setSector('otro');
  setUploadedDocs({});
  setResults({});
  setPreviousResults({});
  setAnalyzed(false);
  setScreen('landing');
  setActiveTab('subir');
  setAuditLog([]);
  setTourActive(false);
  setTourStep(0);
  auditCounter = 0;
}, []);
```

- [ ] **Step 6: Reemplazar callback startAnalysis**

```typescript
const startAnalysis = useCallback(() => {
  // Guardar resultados actuales como "versión anterior" antes de re-analizar
  if (analyzed) {
    setPreviousResults(results);
  }
  setScreen('analyzing');
}, [analyzed, results]);
```

- [ ] **Step 7: Agregar acciones del tour (después de switchTab)**

```typescript
const advanceTour = useCallback(() => {
  setTourStep(prev => {
    if (prev >= 2) {
      setTourActive(false);
      return 0;
    }
    return prev + 1;
  });
}, []);

const skipTour = useCallback(() => {
  setTourActive(false);
  setTourStep(0);
}, []);
```

- [ ] **Step 8: Actualizar el return del hook**

Reemplazar el bloque `return { ... }` al final:

```typescript
return {
  screen, activeTab, companyName, role, sector, uploadedDocs, results,
  previousResults, analyzed, auditLog, tourActive, tourStep,
  login, demo, logout, uploadDoc, startAnalysis, finishAnalysis,
  switchTab, logDownload, advanceTour, skipTour,
};
```

- [ ] **Step 9: Verificar tipos**

```
npx tsc --noEmit
```

Habrá errores en componentes que aún no reciben las nuevas props (AppShell, DiagnosticoView). Eso es esperado. Lo importante es que `useAppState.ts` compile sin errores propios.

- [ ] **Step 10: Commit**

```
git add hooks/useAppState.ts
git commit -m "feat: extender estado con sector, previousResults y tour"
```

---

## Task 3: Selector de sector en login y propagación

**Files:**
- Modify: `components/LoginCard.tsx`
- Modify: `components/Landing.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Actualizar LoginCard.tsx**

Agregar imports al inicio:

```typescript
import { SECTORES_OPCIONES } from '@/lib/sectorData';
import type { Sector } from '@/lib/types';
```

Cambiar la firma de `onLogin` en la interfaz:

```typescript
interface LoginCardProps {
  onLogin: (rut: string, role: UserRole, sector: Sector) => void;
  onDemo: () => void;
  onToast: (msg: string, type: 'yellow' | 'blue') => void;
}
```

Agregar estado local de sector después del estado `role`:

```typescript
const [sector, setSector] = useState<Sector>('otro');
```

Cambiar la llamada en `handleLogin`:

```typescript
onLogin(rut.trim(), role, sector);
```

Insertar el selector de sector después del `</div>` del grupo de rol (después del `</div>` que cierra `className="form-group"` del rol):

```tsx
<div className="form-group">
  <label className="form-label">Sector de su empresa</label>
  <select
    className="form-input form-select"
    value={sector}
    onChange={e => setSector(e.target.value as Sector)}
  >
    {SECTORES_OPCIONES.map(s => (
      <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 2: Actualizar Landing.tsx**

Agregar `Sector` al import de tipos:

```typescript
import type { UserRole, Sector } from '@/lib/types';
```

Cambiar la interfaz `LandingProps`:

```typescript
interface LandingProps {
  onLogin: (rut: string, role: UserRole, sector: Sector) => void;
  onDemo: () => void;
  onToast: (msg: string, type: 'yellow' | 'blue') => void;
}
```

(El JSX de `Landing` no cambia; `LoginCard` ya recibe `onLogin` y lo pasa al handler correcto.)

- [ ] **Step 3: Actualizar page.tsx — callback onLogin en Landing**

Reemplazar el callback `onLogin` en `<Landing>`:

```tsx
onLogin={(rut, role, sector) => {
  state.login(rut, role, sector);
  toast('✓ Bienvenido. Suba sus documentos para comenzar el diagnóstico.', 'blue');
}}
```

- [ ] **Step 4: Verificar tipos**

```
npx tsc --noEmit
```

Esperado: errores solo en AppShell (aún sin las nuevas props). LoginCard/Landing/page.tsx deben compilar limpios.

- [ ] **Step 5: Commit**

```
git add components/LoginCard.tsx components/Landing.tsx app/page.tsx
git commit -m "feat: selector de sector en login"
```

---

## Task 4: Componente SectorComparisonCard

**Files:**
- Create: `components/SectorComparisonCard.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Crear components/SectorComparisonCard.tsx**

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { SECTOR_DATA } from '@/lib/sectorData';
import type { Sector } from '@/lib/types';

interface SectorComparisonCardProps {
  sector: Sector;
  companyCumplimiento: number;
}

export default function SectorComparisonCard({ sector, companyCumplimiento }: SectorComparisonCardProps) {
  const benchmark    = SECTOR_DATA[sector];
  const delta        = companyCumplimiento - benchmark.promedio;
  const empresaRef   = useRef<HTMLDivElement>(null);
  const promedioRef  = useRef<HTMLDivElement>(null);

  // Animar barras desde 0 al valor real al montar
  useEffect(() => {
    const t = setTimeout(() => {
      if (empresaRef.current)  empresaRef.current.style.width  = `${companyCumplimiento}%`;
      if (promedioRef.current) promedioRef.current.style.width = `${benchmark.promedio}%`;
    }, 150);
    return () => clearTimeout(t);
  }, [companyCumplimiento, benchmark.promedio]);

  return (
    <div className="sector-card">
      <div className="sector-card-header">
        <h3>Comparación con su sector</h3>
        <span className="sector-badge">{benchmark.label}</span>
      </div>

      <div className="sector-stat">
        <div className="sector-stat-label">Su empresa</div>
        <div className="sector-bar-track">
          <div ref={empresaRef} className="sector-bar empresa" style={{ width: 0 }} />
          <span className="sector-bar-pct">{companyCumplimiento}%</span>
        </div>
      </div>

      <div className="sector-stat">
        <div className="sector-stat-label">Promedio {benchmark.label}</div>
        <div className="sector-bar-track">
          <div ref={promedioRef} className="sector-bar promedio" style={{ width: 0 }} />
          <span className="sector-bar-pct">{benchmark.promedio}%</span>
        </div>
      </div>

      <div className={`sector-delta ${delta >= 0 ? 'positivo' : 'negativo'}`}>
        {delta >= 0 ? '▲' : '▼'}{' '}
        {Math.abs(delta)} puntos porcentuales{' '}
        {delta >= 0 ? 'sobre' : 'bajo'} el promedio del sector
      </div>

      <p className="sector-desc">{benchmark.descripcion}</p>
    </div>
  );
}
```

- [ ] **Step 2: Agregar estilos al final de globals.css**

```css
/* ── SECTOR COMPARISON CARD ── */
.sector-card {
  background: var(--white); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 20px 24px;
  margin-bottom: 16px; box-shadow: var(--shadow);
  animation: fadeInUp 0.4s var(--ease-out) both;
}
.sector-card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.sector-card-header h3 { font-size: 14px; font-weight: 600; color: var(--text); margin: 0; }
.sector-badge {
  font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
  background: var(--blue-dim); color: var(--blue);
  padding: 3px 10px; border-radius: 20px;
  border: 1px solid rgba(37,99,235,0.18);
}
.sector-stat { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.sector-stat-label { font-size: 12px; color: var(--text2); width: 160px; flex-shrink: 0; }
.sector-bar-track {
  flex: 1; height: 10px; background: var(--surface);
  border-radius: 5px; position: relative;
}
.sector-bar {
  height: 10px; border-radius: 5px; position: absolute; top: 0; left: 0;
  transition: width 0.9s var(--ease-out);
}
.sector-bar.empresa  { background: var(--blue); }
.sector-bar.promedio { background: var(--border2); }
.sector-bar-pct {
  position: absolute; right: -42px; top: 50%; transform: translateY(-50%);
  font-size: 11px; font-weight: 700; color: var(--text2); white-space: nowrap;
}
.sector-delta {
  font-size: 12px; font-weight: 600; padding: 7px 12px;
  border-radius: 8px; margin-top: 14px;
}
.sector-delta.positivo { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
.sector-delta.negativo { background: var(--red-bg);   color: var(--red);   border: 1px solid var(--red-border); }
.sector-desc { font-size: 11px; color: var(--text3); margin-top: 8px; }
```

- [ ] **Step 3: Verificar tipos**

```
npx tsc --noEmit
```

Esperado: SectorComparisonCard compila sin errores.

- [ ] **Step 4: Commit**

```
git add components/SectorComparisonCard.tsx app/globals.css
git commit -m "feat: SectorComparisonCard con barras animadas"
```

---

## Task 5: Componente OnboardingTour

**Files:**
- Create: `components/OnboardingTour.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Crear components/OnboardingTour.tsx**

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';

interface TourStep {
  target: string;        // valor de data-tour del elemento
  titulo: string;
  descripcion: string;
  posicionAbajo: boolean; // true = tooltip bajo el elemento, false = encima
}

const PASOS: TourStep[] = [
  {
    target: 'upload-zone',
    titulo: 'Suba sus documentos actuales',
    descripcion: 'Aquí cargue los documentos de su empresa — política de privacidad, registros, contratos. Cada uno corresponde a un requisito de la Ley 21.719.',
    posicionAbajo: true,
  },
  {
    target: 'analyze-btn',
    titulo: 'Presione Analizar',
    descripcion: 'Presione Analizar para revisar su cumplimiento. El sistema lee el contenido real de sus documentos y los contrasta automáticamente con los criterios legales.',
    posicionAbajo: false,
  },
  {
    target: 'tab-diagnostico',
    titulo: 'Revise su diagnóstico',
    descripcion: 'Aquí encontrará su diagnóstico completo: qué requisitos cumple, qué brechas tiene, y un informe PDF para presentar al directorio.',
    posicionAbajo: true,
  },
];

interface SpotlightRect { top: number; left: number; width: number; height: number; }
interface TooltipPos    { top: number; left: number; }

interface OnboardingTourProps {
  tourStep: number;
  onNext: () => void;
  onSkip: () => void;
}

export default function OnboardingTour({ tourStep, onNext, onSkip }: OnboardingTourProps) {
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos]       = useState<TooltipPos>({ top: 160, left: 200 });
  const paso = PASOS[tourStep];

  const calcularPosicion = useCallback(() => {
    if (!paso) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${paso.target}"]`);
    if (!el) return;

    const rect    = el.getBoundingClientRect();
    const PADDING = 8;
    const TOOLTIP_W = 308;

    setSpotlightRect({
      top:    rect.top    - PADDING,
      left:   rect.left   - PADDING,
      width:  rect.width  + PADDING * 2,
      height: rect.height + PADDING * 2,
    });

    const left = Math.min(
      Math.max(16, rect.left),
      window.innerWidth - TOOLTIP_W - 16
    );

    setTooltipPos(
      paso.posicionAbajo
        ? { top: rect.bottom + PADDING + 14, left }
        : { top: Math.max(16, rect.top - 190), left }
    );
  }, [paso]);

  useEffect(() => {
    calcularPosicion();
    window.addEventListener('resize', calcularPosicion);
    return () => window.removeEventListener('resize', calcularPosicion);
  }, [calcularPosicion]);

  if (!paso) return null;

  return (
    <>
      {/* Spotlight: box-shadow gigante oscurece todo el viewport menos el recorte */}
      {spotlightRect && (
        <div
          className="tour-spotlight"
          style={{
            top:    spotlightRect.top,
            left:   spotlightRect.left,
            width:  spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      )}

      {/* Tooltip posicionado cerca del elemento */}
      <div className="tour-tooltip" key={tourStep} style={{ top: tooltipPos.top, left: tooltipPos.left }}>
        <div className="tour-step-indicator">Paso {tourStep + 1} de {PASOS.length}</div>
        <div className="tour-titulo">{paso.titulo}</div>
        <p className="tour-desc">{paso.descripcion}</p>
        <div className="tour-actions">
          <button className="tour-btn-skip" onClick={onSkip}>Saltar tour</button>
          <button className="tour-btn-next" onClick={onNext}>
            {tourStep < PASOS.length - 1 ? 'Siguiente →' : 'Empezar →'}
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Agregar estilos del tour al final de globals.css**

```css
/* ── ONBOARDING TOUR ── */
.tour-spotlight {
  position: fixed; z-index: 1001;
  background: transparent; border-radius: 10px; pointer-events: none;
  /* La sombra gigante oscurece todo el viewport salvo el elemento señalado */
  box-shadow: 0 0 0 4px #60a5fa, 0 0 0 9999px rgba(15,30,61,0.72);
  transition: top 0.35s var(--ease-out), left 0.35s var(--ease-out),
              width 0.35s var(--ease-out), height 0.35s var(--ease-out);
}
.tour-tooltip {
  position: fixed; z-index: 1002; width: 308px;
  background: var(--white); border-radius: 14px; padding: 20px;
  box-shadow: 0 8px 32px rgba(15,30,61,0.2), 0 2px 8px rgba(15,30,61,0.1);
  animation: cardIn 0.25s var(--ease-out) both;
}
.tour-step-indicator {
  font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--blue); margin-bottom: 6px;
}
.tour-titulo {
  font-family: 'Source Serif 4', serif;
  font-size: 16px; font-weight: 700; color: var(--text);
  margin-bottom: 6px; line-height: 1.3;
}
.tour-desc {
  font-size: 13px; color: var(--text2); line-height: 1.55; margin-bottom: 16px;
}
.tour-actions { display: flex; justify-content: space-between; align-items: center; }
.tour-btn-skip {
  font-size: 12px; color: var(--text3); background: none; border: none;
  cursor: pointer; padding: 6px 8px; border-radius: 6px;
  transition: color 0.2s var(--ease-out), background 0.2s var(--ease-out);
}
.tour-btn-skip:hover { color: var(--text2); background: var(--surface); }
.tour-btn-next {
  background: var(--navy); color: #fff; border: none; border-radius: 8px;
  padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background 0.2s var(--ease-out), transform 0.15s var(--ease-out);
}
.tour-btn-next:hover  { background: var(--navy2); transform: translateY(-1px); }
.tour-btn-next:active { transform: translateY(0); }
@media (prefers-reduced-motion: reduce) {
  .tour-spotlight, .tour-tooltip { transition: none; animation: none; }
}
```

- [ ] **Step 3: Verificar tipos**

```
npx tsc --noEmit
```

Esperado: OnboardingTour compila sin errores.

- [ ] **Step 4: Commit**

```
git add components/OnboardingTour.tsx app/globals.css
git commit -m "feat: OnboardingTour con spotlight y tooltip posicionado dinámicamente"
```

---

## Task 6: Atributos data-tour, AppShell y page.tsx

**Files:**
- Modify: `components/UploadView.tsx`
- Modify: `components/AppShell.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Agregar data-tour a UploadView**

En `components/UploadView.tsx`, en el `<div className="req-upload-grid">`:

```tsx
<div className="req-upload-grid" data-tour="upload-zone">
```

En el `<button className="btn-analyze"`:

```tsx
<button
  className="btn-analyze"
  data-tour="analyze-btn"
  disabled={count === 0}
  onClick={onStartAnalysis}
>
```

En el `<div className="role-lock-btn"` (caso sin acceso):

```tsx
<div className="role-lock-btn" data-tour="analyze-btn" title={...}>
```

- [ ] **Step 2: Actualizar imports y interfaz de AppShell.tsx**

Cambiar el import de tipos para incluir `Sector`:

```typescript
import type { ActiveTab, AuditEvent, UploadedDoc, RequisitoResult, UserRole, Sector } from '@/lib/types';
```

Agregar import de `OnboardingTour` al inicio:

```typescript
import OnboardingTour from './OnboardingTour';
```

Reemplazar la interfaz `AppShellProps` completa:

```typescript
interface AppShellProps {
  companyName: string;
  role: UserRole;
  sector: Sector;
  auditLog: AuditEvent[];
  activeTab: ActiveTab;
  uploadedDocs: Record<string, UploadedDoc>;
  results: Record<string, RequisitoResult>;
  previousResults: Record<string, RequisitoResult>;
  analyzed: boolean;
  tourActive: boolean;
  tourStep: number;
  onSwitchTab: (tab: ActiveTab) => void;
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onStartAnalysis: () => void;
  onLogout: () => void;
  onDownload: () => void;
  onAdvanceTour: () => void;
  onSkipTour: () => void;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}
```

Actualizar la destructuración del componente:

```typescript
export default function AppShell({
  companyName, role, sector, auditLog, activeTab, uploadedDocs, results,
  previousResults, analyzed, tourActive, tourStep,
  onSwitchTab, onUpload, onStartAnalysis, onLogout, onDownload,
  onAdvanceTour, onSkipTour, onToast,
}: AppShellProps) {
```

- [ ] **Step 3: Agregar data-tour al tab de diagnóstico**

Localizar el div del tab diagnóstico y agregar el atributo:

```tsx
<div
  data-tour="tab-diagnostico"
  className={`nav-tab${activeTab === 'diagnostico' ? ' active' : ''}`}
  onClick={() => onSwitchTab('diagnostico')}
>
```

- [ ] **Step 4: Pasar nuevas props a DiagnosticoView en AppShell**

Reemplazar el bloque que renderiza `DiagnosticoView`:

```tsx
{activeTab === 'diagnostico' && analyzed && (
  <DiagnosticoView
    results={results}
    previousResults={previousResults}
    uploadedDocs={uploadedDocs}
    companyName={companyName}
    sector={sector}
    role={role}
    onUpload={onUpload}
    onDownload={onDownload}
    onToast={(msg, type) => onToast(msg, type)}
  />
)}
```

- [ ] **Step 5: Montar OnboardingTour al final del JSX de AppShell**

Antes del `</div>` de cierre (el que envuelve todo el componente), agregar:

```tsx
      {/* Tour guiado de onboarding — aparece en el primer acceso */}
      {tourActive && (
        <OnboardingTour
          tourStep={tourStep}
          onNext={onAdvanceTour}
          onSkip={onSkipTour}
        />
      )}
    </div>
  );
```

- [ ] **Step 6: Actualizar page.tsx — props de AppShell**

Reemplazar el bloque `<AppShell ...>` completo:

```tsx
{state.screen === 'app' && (
  <AppShell
    companyName={state.companyName}
    role={state.role}
    sector={state.sector}
    auditLog={state.auditLog}
    activeTab={state.activeTab}
    uploadedDocs={state.uploadedDocs}
    results={state.results}
    previousResults={state.previousResults}
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
    onDownload={() => {
      state.logDownload(state.role, state.companyName);
      toast('📊 Generando informe PDF — funcionalidad en producción', 'blue');
    }}
    onAdvanceTour={state.advanceTour}
    onSkipTour={state.skipTour}
    onToast={toast}
  />
)}
```

- [ ] **Step 7: Verificar tipos**

```
npx tsc --noEmit
```

Esperado: errores solo en DiagnosticoView (aún sin las nuevas props). AppShell/UploadView/page.tsx deben compilar limpios.

- [ ] **Step 8: Commit**

```
git add components/UploadView.tsx components/AppShell.tsx app/page.tsx
git commit -m "feat: conectar tour y nuevas props en AppShell"
```

---

## Task 7: Comparador de versiones y sector en DiagnosticoView

**Files:**
- Modify: `components/DiagnosticoView.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Actualizar imports y props de DiagnosticoView**

Cambiar el import de tipos:

```typescript
import type { RequisitoResult, UploadedDoc, UserRole, Sector } from '@/lib/types';
```

Agregar import de `SectorComparisonCard`:

```typescript
import SectorComparisonCard from './SectorComparisonCard';
```

Reemplazar la interfaz `DiagnosticoViewProps`:

```typescript
interface DiagnosticoViewProps {
  results: Record<string, RequisitoResult>;
  previousResults: Record<string, RequisitoResult>;
  uploadedDocs: Record<string, UploadedDoc>;
  companyName: string;
  sector: Sector;
  role: UserRole;
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onDownload: () => void;
  onToast: (msg: string, type: 'green' | 'blue' | 'yellow') => void;
}
```

Actualizar la destructuración:

```typescript
export default function DiagnosticoView({
  results, previousResults, uploadedDocs, companyName, sector, role,
  onUpload, onDownload, onToast,
}: DiagnosticoViewProps) {
```

- [ ] **Step 2: Calcular pct previo para el banner global**

Después de la línea `const pct = analyzable > 0 ? ... : 0;`, agregar:

```typescript
// Métricas de la versión anterior (solo si existe un snapshot previo)
const hasPrevResults = Object.keys(previousResults).length > 0;
const prevGreen   = hasPrevResults ? REQUISITOS.filter(r => previousResults[r.id]?.estado === 'green').length : 0;
const prevYellow  = hasPrevResults ? REQUISITOS.filter(r => previousResults[r.id]?.estado === 'yellow').length : 0;
const prevAnalyz  = hasPrevResults ? REQUISITOS.filter(r => previousResults[r.id]?.estado !== 'unanalyzable').length : 0;
const prevPct     = prevAnalyz > 0
  ? Math.round((prevGreen * 100 + prevYellow * 50) / (prevAnalyz * 100) * 100)
  : 0;
const versionDelta = pct - prevPct;
```

- [ ] **Step 3: Insertar banner de comparación de versiones en score-info**

Dentro del `<div className="score-info">`, inmediatamente después del `<p>{desc}</p>` y antes del bloque `{unanalyzable > 0 && ...}`, agregar:

```tsx
{hasPrevResults && (
  <div className="score-version-compare">
    <span className="score-version-prev">Versión anterior: {prevPct}%</span>
    <span className="score-version-arrow">→</span>
    <span className="score-version-curr">Versión actual: {pct}%</span>
    <span className={`score-version-delta ${versionDelta >= 0 ? 'positivo' : 'negativo'}`}>
      {versionDelta >= 0 ? '+' : ''}{versionDelta}%
    </span>
  </div>
)}
```

- [ ] **Step 4: Insertar SectorComparisonCard después del score banner**

En el JSX, después del `</div>` de cierre del score banner (el que tiene className="score-banner") y antes del `<div className="section-hdr">`, insertar:

```tsx
{/* Comparación con el sector */}
<SectorComparisonCard sector={sector} companyCumplimiento={pct} />
```

- [ ] **Step 5: Agregar banner de versión por requisito en brecha cards**

En el `.map()` de brechas, dentro de la función map, **antes del `return`**, agregar:

```typescript
const prevRes            = previousResults[r.id];
const covDelta           = prevRes ? res.cobertura - prevRes.cobertura : 0;
const criteriosMejorados = prevRes
  ? res.criterios.filter((c, i) =>
      prevRes.criterios[i] &&
      (prevRes.criterios[i].status === 'fail' || prevRes.criterios[i].status === 'warn') &&
      c.status === 'ok'
    )
  : [];
```

Luego dentro del `{isOpen && (<div className="brecha-body">`, justo antes del `{isScanned ? (`, agregar:

```tsx
{prevRes && (
  <div className="version-comparison-banner">
    <div className="version-comparison-scores">
      <span className="version-prev-pct">Versión anterior: {prevRes.cobertura}%</span>
      <span className="version-arrow">→</span>
      <span className="version-curr-pct">Versión nueva: {res.cobertura}%</span>
      <span className={`version-delta ${covDelta >= 0 ? 'positivo' : 'negativo'}`}>
        {covDelta >= 0 ? '+' : ''}{covDelta}%
      </span>
    </div>
    {criteriosMejorados.length > 0 && (
      <div className="version-criterios-nuevos">
        {criteriosMejorados.map((c, i) => (
          <div key={i} className="version-criterio-check">
            <span className="check-verde-anim">✓</span>
            <span>{c.name}</span>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 6: Agregar estilos de comparación de versiones al final de globals.css**

```css
/* ── COMPARADOR DE VERSIONES ── */
.score-version-compare {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: 12px; margin-top: 10px;
  background: rgba(255,255,255,0.07); border-radius: 8px; padding: 7px 12px;
}
.score-version-prev  { color: rgba(255,255,255,0.5); }
.score-version-arrow { color: rgba(255,255,255,0.3); }
.score-version-curr  { color: rgba(255,255,255,0.85); font-weight: 600; }
.score-version-delta {
  font-weight: 700; padding: 2px 8px; border-radius: 10px;
}
.score-version-delta.positivo { background: rgba(74,222,128,0.2); color: #4ade80; }
.score-version-delta.negativo { background: rgba(248,113,113,0.2); color: #f87171; }

.version-comparison-banner {
  background: rgba(37,99,235,0.05); border: 1px solid rgba(37,99,235,0.15);
  border-radius: 8px; padding: 10px 12px; margin-bottom: 10px;
}
.version-comparison-scores {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px;
}
.version-prev-pct { color: var(--text3); }
.version-arrow    { color: var(--text3); }
.version-curr-pct { color: var(--text); font-weight: 600; }
.version-delta {
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;
}
.version-delta.positivo { background: var(--green-bg); color: var(--green); }
.version-delta.negativo { background: var(--red-bg);   color: var(--red); }
.version-criterios-nuevos {
  display: flex; flex-direction: column; gap: 4px; margin-top: 8px;
}
.version-criterio-check {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--green); font-weight: 500;
}
.check-verde-anim {
  display: inline-block; font-weight: 700;
  animation: checkIn 0.4s var(--ease-out) both;
}
@keyframes checkIn {
  from { transform: scale(0) rotate(-30deg); opacity: 0; }
  to   { transform: scale(1) rotate(0deg);   opacity: 1; }
}
```

- [ ] **Step 7: Verificar tipos — debe quedar en 0 errores**

```
npx tsc --noEmit
```

Esperado: **0 errores**.

- [ ] **Step 8: Commit**

```
git add components/DiagnosticoView.tsx app/globals.css
git commit -m "feat: comparador de versiones y tarjeta sectorial en DiagnosticoView"
```

---

## Task 8: Verificación final

**Files:** ninguno nuevo

- [ ] **Step 1: TypeScript limpio**

```
npx tsc --noEmit
```

Esperado: 0 errores, 0 warnings.

- [ ] **Step 2: Arrancar el servidor**

```
npm run dev
```

Esperado: servidor en http://localhost:3000 sin errores en consola.

- [ ] **Step 3: Verificar Feature 3 — Tour guiado**

1. Abrir http://localhost:3000
2. Ingresar con cualquier RUT/correo
3. **Verificar:** spotlight aparece sobre el grid de carga (upload-zone)
4. Click "Siguiente" → spotlight se mueve al botón Analizar
5. Click "Siguiente" → spotlight se mueve al tab "Mi diagnóstico"
6. Click "Empezar →" → tour desaparece, app queda normal
7. Salir (Salir), reingresar → tour vuelve a aparecer
8. Ingresar con "Ver demostración" → tour también aparece
9. Verificar "Saltar tour" cierra el tour desde cualquier paso

- [ ] **Step 4: Verificar Feature 2 — Comparación sectorial**

1. Ingresar con sector "Finanzas"
2. Subir cualquier documento y ejecutar análisis
3. Navegar a "Mi diagnóstico"
4. **Verificar:** tarjeta "Comparación con su sector" aparece con barras animadas
5. **Verificar:** badge muestra "Finanzas", promedio = 81%
6. **Verificar:** delta calcula correctamente (positivo/negativo según pct empresa)

- [ ] **Step 5: Verificar Feature 1 — Comparador de versiones**

1. Entrar en modo demo → ejecutar análisis → ver diagnóstico (anotar pct)
2. Ir a "Subir documentos" → reemplazar un documento
3. Ejecutar análisis nuevamente
4. En diagnóstico: **verificar** banner "Versión anterior: X% → Versión actual: Y% (+Z%)" en el score banner
5. Expandir una brecha card → **verificar** banner de comparación por requisito
6. Si algún criterio mejoró → **verificar** checkmark verde animado (✓)

- [ ] **Step 6: Commit final de cierre**

```
git add .
git commit -m "feat: DataShield 21.719 — comparador versiones, sector, tour guiado"
```
