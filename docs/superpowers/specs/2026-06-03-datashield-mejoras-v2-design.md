# DataShield 21.719 — Mejoras v2: Diseño

**Fecha:** 2026-06-03  
**Estado:** Aprobado  
**Alcance:** 8 mejoras sobre la plataforma SaaS de diagnóstico Ley 21.719

---

## 1. Contexto del proyecto

DataShield 21.719 es una SPA Next.js 14 con análisis de documentos en el cliente (sin backend). Usa React state (sin localStorage), tema navy+claro, fuentes Sora + Source Serif 4.

Estructura actual: `app/page.tsx` → `hooks/useAppState.ts` → componentes (Landing, AppShell, UploadView, DiagnosticoView, AnalyzingScreen). El motor de análisis vive en `lib/analyzer.ts` + `lib/requisitos.ts`.

---

## 2. Cambios por ítem

### 2.1 Unificación de nombre (ya completo)
"CumpleData" no aparece en ningún archivo. El nombre "DataShield" ya es consistente. No requiere cambios.

### 2.2 Control de acceso por roles (RBAC)

**Nuevos tipos en `lib/types.ts`:**
```ts
export type UserRole = 'administrador' | 'visualizador' | 'auditor';
```

**LoginCard:** Agrega `<select>` con las 3 opciones antes del botón Ingresar. El rol se pasa como segundo argumento a `onLogin(rut, rol)`.

**useAppState:** Nuevo campo `role: UserRole`. Demo fija `role = 'administrador'`.

**Permisos por rol:**
| Acción | Administrador | Auditor | Visualizador |
|---|---|---|---|
| Subir documentos | ✓ | ✗ | ✗ |
| Ejecutar análisis | ✓ | ✗ | ✗ |
| Descargar informe | ✓ | ✓ | ✗ |
| Ver diagnóstico | ✓ | ✓ | ✓ |
| Ver Registro actividad | ✓ | ✓ | ✗ |
| Ver Riesgos y seguridad | ✓ | ✓ | ✓ |

**Header:** El chip de empresa se expande a `● RUT · Rol` con el rol en mayúscula inicial.

**AppShell:** Las pestañas "Registro" y "Riesgos" se muestran condicionalmente. Los botones de subir/analizar se ocultan para Visualizador y Auditor. El botón de descarga se oculta para Visualizador.

### 2.3 Registro de auditoría (Audit Log)

**Nuevo tipo en `lib/types.ts`:**
```ts
export interface AuditEvent {
  id: number;
  timestamp: string;      // ISO 8601
  rol: UserRole;
  usuario: string;        // RUT de la empresa
  accion: 'subió documento' | 'ejecutó análisis' | 'descargó informe' | 'eliminó documento';
  archivo?: string;
}
```

**useAppState:** Nuevo campo `auditLog: AuditEvent[]` (array, estado React). Helper `addAuditEvent(accion, archivo?)` crea el evento con timestamp actual.

**Registro de eventos:**
- `uploadDoc` → registra "subió documento" con nombre del archivo
- `finishAnalysis` → registra "ejecutó análisis"
- Botón descargar informe → registra "descargó informe"

**RegistroView (`components/RegistroView.tsx`):** Tabla HTML con columnas Fecha/hora | Rol | Acción | Archivo. Ordenada por timestamp descendente. Si el log está vacío, muestra estado vacío amigable.

**ActiveTab:** Se amplía a `'subir' | 'diagnostico' | 'registro' | 'riesgos'`.

### 2.4 Disclaimer legal

Banner fijo en la parte superior del contenido de `DiagnosticoView`, antes del score banner. Diseño: fondo `--yellow-bg`, borde `--yellow-border`, padding 12px 16px, borde-radius `--radius`.

Texto exacto:
> ⚠️ Este diagnóstico es orientativo y se basa en análisis automático de documentos. No reemplaza la asesoría jurídica profesional. Para validez ante la APDP, consulte con un abogado especialista en protección de datos.

### 2.5 Motor con sinónimos y nivel de confianza

**Cambio en `Criterio` (`lib/types.ts`):**
```ts
export interface Criterio {
  name: string;
  keywords: string[];
  synonyms: string[];   // nuevo — términos alternativos aceptados
  validado: boolean;    // nuevo — revisado por especialista
}
```

**Cambio en `CriterioResult`:**
```ts
export interface CriterioResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  found: string;
  kwFound: number;
  kwTotal: number;
  confianza: 'alta' | 'media' | 'baja';  // nuevo
  validado: boolean;                       // nuevo — copiado desde Criterio
}
```

**Lógica en `analyzer.ts`:**
1. Buscar keywords exactas → si ≥ 1 encontrada: `confianza = 'alta'`, `kwFound = count`
2. Si keywords = 0 pero ≥ 1 sinónimo encontrado: `confianza = 'media'`, `kwFound = 1` (crédito parcial mínimo para cobertura)
3. Si nada encontrado: `confianza = 'baja'`, `kwFound = 0`

El campo `kwFound` se usa solo para el ratio de cobertura. Los sinónimos solo elevan el resultado mínimamente (ratio = 1/total) para evitar penalizar criterios donde el documento usa terminología alternativa válida.

**UI en DiagnosticoView:** Cada `criterio-item` muestra dos elementos adicionales a la derecha de `criterio-found`:
1. Chip de confianza: `Alta ●` (verde) / `Media ◐` (amarillo) / `Baja ○` (gris)
2. Badge de validación: `Validado ✓` (verde) o `Pendiente ⏳` (gris)

### 2.6 Indicador de validación legal

El badge de validación (descrito en 2.5 UI) usa el campo `validado` de cada `Criterio`. En `requisitos.ts`, los criterios de los primeros 4 requisitos (`politica_privacidad`, `registro_actividades`, `procedimiento_arco`, `contrato_encargado`) se marcan como `validado: true` por estar más consolidados doctrinariamente. Los 6 restantes quedan como `validado: false`.

### 2.7 Gestión de sesión con timeout

**Hook `hooks/useSessionTimeout.ts`:**
```ts
useSessionTimeout(onWarn: () => void, onExpire: () => void, idleMinutes = 2)
```
- Escucha eventos: `mousemove`, `keydown`, `click`, `scroll`
- Cualquier evento reinicia el timer
- A los `idleMinutes * 60 - 60` segundos → llama `onWarn()`
- A los `idleMinutes * 60` segundos → llama `onExpire()`
- Limpia los event listeners al desmontar

**SessionTimeoutModal (`components/SessionTimeoutModal.tsx`):**
- Modal centrado, fondo oscuro semitransparente
- Countdown visible en segundos (60 → 0)
- Dos botones: "Continuar sesión" / "Cerrar sesión"
- "Continuar sesión" reinicia el timer y cierra el modal

**Integración en `app/page.tsx`:**
- El hook solo se activa cuando `screen === 'app'`
- `onWarn` → muestra el modal
- `onExpire` → `state.logout()`

### 2.8 Sección de riesgos y seguridad

**RiesgosView (`components/RiesgosView.tsx`):** 4 secciones en grid de 2 columnas (responsive a 1):

**Riesgos legales** (nivel alto/medio):
- Cambios normativos APDP · alto · Monitoreo continuo de regulación
- Responsabilidad por diagnóstico incorrecto · alto · Disclaimer legal obligatorio
- Interpretación errónea por usuario · medio · Capacitación y documentación clara

**Riesgos de ciberseguridad** (nivel alto/medio):
- Acceso no autorizado a datos · alto · RBAC + MFA + sesión con timeout
- Carga de archivos maliciosos · alto · Validación MIME + límite 10 MB
- Criterios de análisis desactualizados · medio · Proceso de actualización trimestral

**Riesgos del proyecto** (nivel medio/bajo):
- Baja adopción en PYMEs · medio · UX simplificada + modo demo
- Ausencia de abogado en equipo · alto · Alianza con firma legal especializada
- Costos de infraestructura · bajo · Procesamiento local (sin servidor)

**Controles implementados** (siempre verde):
- Control de acceso por roles (RBAC) ✓
- Registro de auditoría completo ✓
- Procesamiento local (datos no salen del browser) ✓
- Validación de archivos (tipo + tamaño) ✓
- Gestión de sesión con timeout ✓
- Disclaimer legal visible ✓
- Headers HTTP seguros (CSP, HSTS, X-Frame) ✓
- Análisis OWASP Top 10 considerado ✓

---

## 3. Archivos a crear

| Ruta | Descripción |
|---|---|
| `components/RegistroView.tsx` | Vista de audit log |
| `components/RiesgosView.tsx` | Vista de riesgos y controles |
| `components/SessionTimeoutModal.tsx` | Modal de expiración de sesión |
| `hooks/useSessionTimeout.ts` | Hook de inactividad |

## 4. Archivos a modificar

| Ruta | Cambios |
|---|---|
| `lib/types.ts` | +UserRole, +AuditEvent, +campos en Criterio/CriterioResult, ampliar ActiveTab |
| `lib/requisitos.ts` | +synonyms[], +validado a los 50 criterios existentes |
| `lib/analyzer.ts` | Lógica de sinónimos + campo confianza |
| `hooks/useAppState.ts` | +role, +auditLog[], +addAuditEvent |
| `components/LoginCard.tsx` | +selector de rol |
| `components/AppShell.tsx` | +tabs condicionales, +role en header, +RiesgosView |
| `components/DiagnosticoView.tsx` | +disclaimer, +chips confianza, +badges validado |
| `app/page.tsx` | +SessionTimeoutModal, +pasar auditLog props |

## 5. Restricciones

- Sin localStorage — todo en estado React
- Sin cambios al tema visual (navy + claro, Sora + Source Serif 4)
- Código comentado en español
- Compatible con `npm run dev` sin errores
- Demo usa rol Administrador por defecto
