# Plantillas Descargables + Pulido Visual Profesional — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, single-session — se ejecuta directamente, sin subagentes, porque el mismo agente que escribió el plan ya tiene todo el contenido en contexto). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el bug de caracteres corruptos en las plantillas PDF, elevar el contenido y diseño de las 10 plantillas descargables (PDF + Word) al mismo nivel profesional, y dar un pase de pulido visual a toda la app (excepto login), sin cambiar lógica de negocio.

**Architecture:** `lib/templateContent.ts` gana dos campos nuevos (`porQue` por sección, `checklist` por plantilla) que documentan el riesgo legal cubierto; `lib/pdfExport.ts` y `lib/docxTemplates.ts` (los dos renderers) se actualizan para pintar esos campos, eliminar emojis (causa del bug en jsPDF/Helvetica) y unificar tipografía/pie de página. Para el pulido visual, se extiende `components/Icons.tsx` con los íconos Lucide-style que faltan y se reemplazan emojis/SVGs inline inconsistentes en los componentes (excepto Landing/LoginCard), más ajustes de `app/globals.css` para hover/focus, skeletons y estados vacíos.

**Tech Stack:** Next.js 14 / React 18 / TypeScript existente. `jsPDF` + `jspdf-autotable` para PDF, `docx` para Word. Sin librerías nuevas.

## Global Constraints

- No usar `localStorage`; todo el estado sigue en memoria/React.
- No cambiar funcionalidad ni lógica de negocio — solo contenido de plantillas y diseño visual.
- Comentarios de código en español.
- NO tocar `components/Landing.tsx`, `components/LoginCard.tsx`, ni las reglas CSS que solo ellos usan (`.landing-*`, `.brand-*`, `.lf-*`, `.trust-*`, `.login-*`, `.pass-toggle`, `.req-icon` de LoginCard).
- Mantener paleta navy + tema claro y fuentes Sora + Source Serif 4 (sin cambios en `--font-*` ni en la paleta de colores base).
- Ningún emoji (rango Unicode fuera de WinAnsi/cp1252) en texto que se dibuje con `doc.text()` de jsPDF — es la causa raíz de "Ø=ÜË" / "Ø=ÜÌ".
- `npx tsc --noEmit`, `npm test` y `npm run build` deben pasar sin errores al final de cada tarea que toque código (no solo contenido).

---

### Task 1: Fix del bug de caracteres corruptos en PDF + test de regresión

**Files:**
- Modify: `lib/pdfExport.ts:384` y `lib/pdfExport.ts:404`
- Modify: `lib/docxTemplates.ts:94` (mismo emoji, por consistencia aunque Word no lo corrompe)
- Create: `__tests__/pdfEncoding.test.ts`

**Contexto del bug:** jsPDF con la fuente estándar `helvetica` usa la tabla de codificación WinAnsi (cp1252). Cualquier carácter fuera de ese rango (emoji, símbolos como 📋 📌 🔒) se dibuja como bytes sueltos → aparece como "Ø=ÜË" en el PDF. Ya se auditó todo `lib/pdfExport.ts` con un script Node que lista los code points >0x00FF usados en el archivo: los únicos ofensores son `📋` (línea 384) y `📌` (línea 404). El resto de símbolos usados (`—` em dash, `•` bullet) SÍ están en cp1252 y son seguros.

- [ ] **Step 1: Escribir el test de regresión que falla**

Crear `__tests__/pdfEncoding.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TEMPLATES } from '../lib/templateContent';

// jsPDF con fuentes estándar (helvetica) solo soporta WinAnsiEncoding (cp1252).
// Cualquier code point fuera de ese rango se corrompe visualmente en el PDF
// (bug reportado: "Ø=ÜË" / "Ø=ÜÌ"). Este test evita que se reintroduzcan
// emojis u otros símbolos no soportados en el código fuente de los renderers
// y en el contenido de las plantillas.
const EMOJI_OR_UNSUPPORTED = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

function assertNoUnsupportedChars(filePath: string) {
  const src = readFileSync(join(__dirname, '..', filePath), 'utf8');
  const matches = src.match(new RegExp(EMOJI_OR_UNSUPPORTED, 'gu')) ?? [];
  expect(matches, `Caracteres no soportados por jsPDF/Helvetica en ${filePath}: ${matches.join(' ')}`).toEqual([]);
}

describe('Codificación segura para PDF (sin emojis ni símbolos fuera de WinAnsi)', () => {
  it('lib/pdfExport.ts no contiene emojis ni símbolos fuera de WinAnsi', () => {
    assertNoUnsupportedChars('lib/pdfExport.ts');
  });

  it('lib/templateContent.ts no contiene emojis en el contenido de las plantillas', () => {
    assertNoUnsupportedChars('lib/templateContent.ts');
  });

  it('ninguna plantilla en TEMPLATES contiene emojis en sus campos de texto', () => {
    const offenders: string[] = [];
    for (const tpl of Object.values(TEMPLATES)) {
      const campos = [tpl.titulo, tpl.articulo, tpl.proposito, ...tpl.notas, ...tpl.checklist];
      for (const s of tpl.secciones) campos.push(s.titulo, s.porQue, s.instruccion, s.placeholder);
      for (const campo of campos) {
        if (EMOJI_OR_UNSUPPORTED.test(campo)) offenders.push(`${tpl.reqId}: "${campo.slice(0, 40)}..."`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npx vitest run __tests__/pdfEncoding.test.ts`
Expected: FAIL — 2 tests fallan (📋/📌 en `pdfExport.ts`, y `tpl.checklist`/`tpl.secciones[].porQue` no existen aún como propiedades, error de TypeScript en tiempo de ejecución del test o `undefined` en el array — se resuelve en la Tarea 2).

Nota: si el test de "ninguna plantilla..." falla por `undefined` porque `checklist`/`porQue` no existen todavía, es esperado — se corrige al completar la Tarea 2. Por ahora solo debe pasar el primer test (`lib/pdfExport.ts no contiene emojis`) una vez aplicado el Step 3.

- [ ] **Step 3: Eliminar los emojis en `lib/pdfExport.ts`**

En `lib/pdfExport.ts:384`, reemplazar:

```ts
  doc.text('📋 Instrucción: Complete todos los campos marcados con [COMPLETAR] antes de usar este documento.', margin + 4, y + 8);
```

por:

```ts
  doc.text('INSTRUCCIÓN: Complete todos los campos marcados con [COMPLETAR] antes de usar este documento.', margin + 4, y + 8);
```

En `lib/pdfExport.ts:404`, reemplazar:

```ts
      const instrLines = doc.splitTextToSize(`📌 ${seccion.instruccion}`, PW - margin * 2);
```

por:

```ts
      const instrLines = doc.splitTextToSize(`» ${seccion.instruccion}`, PW - margin * 2);
```

- [ ] **Step 4: Eliminar el emoji en `lib/docxTemplates.ts` por consistencia**

En `lib/docxTemplates.ts:94`, reemplazar:

```ts
              new TextRun({ text: '📌 ', size: 18 }),
```

por:

```ts
              new TextRun({ text: '» ', size: 18 }),
```

- [ ] **Step 5: Ejecutar y confirmar que el primer test pasa**

Run: `npx vitest run __tests__/pdfEncoding.test.ts -t "pdfExport.ts no contiene"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/pdfExport.ts lib/docxTemplates.ts __tests__/pdfEncoding.test.ts
git commit -m "fix(plantillas): eliminar emojis que corrompian el texto en PDF (bug Ø=ÜË)"
```

---

### Task 2: Esquema enriquecido + contenido completo de las 10 plantillas

**Files:**
- Modify: `lib/templateContent.ts` (interfaz + las 10 entradas de `TEMPLATES`)

**Interfaces:**
- Produces: `SeccionPlantilla` gana el campo `porQue: string`. `ContenidoPlantilla` gana el campo `checklist: string[]`.
- Consumes (Task 3, Task 4): estos dos campos nuevos, más los campos ya existentes (`titulo`, `articulo`, `proposito`, `notas`, `secciones[].titulo/instruccion/placeholder/obligatorio`).

Este task reescribe el archivo completo. El criterio de aceptación es: **(a)** cada sección de las 10 plantillas tiene un `porQue` real (no una frase genérica) que explica en 1-2 frases qué riesgo legal cubre esa sección y qué pasa si se omite; **(b)** cada plantilla tiene un `checklist` de 3 a 6 ítems verificables; **(c)** todo campo `[COMPLETAR]` "pelado" (sin pista de qué poner) gana un ejemplo concreto entre paréntesis, ej. `Razón social: [COMPLETAR] (ej: Comercializadora Andina SpA)`.

- [ ] **Step 1: Actualizar las interfaces**

En `lib/templateContent.ts`, reemplazar:

```ts
export interface SeccionPlantilla {
  titulo: string;
  instruccion: string;   // Guía para quien completa el documento
  placeholder: string;  // Texto por defecto o "[COMPLETAR]"
  obligatorio: boolean;
}

export interface ContenidoPlantilla {
  reqId: string;
  titulo: string;
  articulo: string;
  proposito: string;    // Qué debe lograr este documento
  notas: string[];      // Notas legales al pie
  secciones: SeccionPlantilla[];
}
```

por:

```ts
export interface SeccionPlantilla {
  titulo: string;
  porQue: string;        // Por qué la ley exige esta sección y qué riesgo legal cubre
  instruccion: string;   // Guía para quien completa el documento
  placeholder: string;  // Texto por defecto o "[COMPLETAR]"
  obligatorio: boolean;
}

export interface ContenidoPlantilla {
  reqId: string;
  titulo: string;
  articulo: string;
  proposito: string;    // Qué debe lograr este documento
  checklist: string[];  // Verificación final antes de usar el documento
  notas: string[];      // Notas legales al pie
  secciones: SeccionPlantilla[];
}
```

- [ ] **Step 2: Añadir `porQue` a cada sección y `checklist` a cada plantilla**

Aplicar a las 10 entradas de `TEMPLATES` (`politica_privacidad`, `contrato_encargado`, `plan_brechas`, `procedimiento_arco`, `registro_actividades`, `evaluacion_impacto`, `politica_retencion`, `registro_rnpa`, `consentimiento`, `designacion_dpo`) el siguiente contenido, insertando el campo `porQue` como primera propiedad de cada objeto de `secciones` (después de `titulo`) y el campo `checklist` como propiedad nueva del objeto de plantilla (después de `proposito`, antes de `notas`):

**`politica_privacidad`** — `checklist`:
```ts
checklist: [
  '¿Publicó esta política en un lugar visible y accesible antes de recolectar datos?',
  '¿Completó los 7 campos [COMPLETAR] con información real de su empresa?',
  '¿Un responsable de privacidad revisó el texto final?',
  '¿La política está redactada en lenguaje simple, sin tecnicismos innecesarios?',
  '¿Definió un canal de contacto real y monitoreado para solicitudes ARCO?',
],
```
`porQue` por sección (en orden 1→7):
1. `'El titular debe saber exactamente quién trata sus datos y a quién reclamar. Omitir esto impide ejercer cualquier derecho ARCO y es de lo primero que fiscaliza la APDP.'`
2. `'Tratar datos sin finalidad declarada o sin base legal válida es la infracción más común y más sancionada de la Ley 21.719; cada finalidad necesita su propio fundamento legal.'`
3. `'El titular no puede evaluar el riesgo de entregar sus datos si no sabe qué tipo de datos recopila la empresa; ocultar el uso de datos sensibles agrava cualquier sanción.'`
4. `'La ley exige informar proactivamente estos derechos (Art. 11–13); no basta con que existan, el titular debe conocerlos para poder ejercerlos.'`
5. `'Guardar datos indefinidamente viola el principio de limitación del plazo de conservación (Art. 7) y aumenta el daño potencial de cualquier brecha de seguridad.'`
6. `'Enviar datos a países sin nivel adecuado de protección sin informarlo expone a la empresa a responsabilidad solidaria por el mal uso que haga el tercero.'`
7. `'Si la política cambia sin aviso, el tratamiento deja de tener el consentimiento o la información válida que lo amparaba originalmente.'`

**`contrato_encargado`** — `checklist`:
```ts
checklist: [
  '¿Firmó este contrato (o cláusula) con TODOS los proveedores que procesan datos personales en su nombre?',
  '¿Verificó que el encargado cuenta con las medidas de seguridad declaradas en la cláusula 6?',
  '¿Definió qué pasa con los datos al terminar el contrato (devolución o destrucción)?',
  '¿El representante legal de ambas partes firmó el documento?',
],
```
`porQue` (1→7):
1. `'El Art. 25 exige identificar con precisión quién es responsable y quién es encargado; sin esto no hay forma de determinar quién responde ante una infracción.'`
2. `'Un encargado solo puede tratar los datos que el contrato autorice expresamente; sin este detalle, cualquier uso adicional es tratamiento ilícito.'`
3. `'Sin un plazo y un destino final de los datos, el encargado podría conservarlos indefinidamente incluso después de terminar el servicio.'`
4. `'El encargado no tiene autonomía legal sobre los datos; si actúa fuera de instrucciones documentadas, pasa a ser responsable solidario del mal uso.'`
5. `'El personal del encargado accede a datos de personas con las que no tiene relación directa; sin esta cláusula no existe obligación legal de reserva.'`
6. `'El Art. 25 exige que el encargado ofrezca garantías suficientes de seguridad; sin especificarlas, el responsable no puede acreditar que evaluó ese riesgo.'`
7. `'Si el encargado subcontrata sin autorización, los datos terminan en manos de un tercero que el responsable nunca evaluó ni controló.'`

**`plan_brechas`** — `checklist`:
```ts
checklist: [
  '¿Los datos de contacto del Coordinador de respuesta están actualizados y disponibles 24/7?',
  '¿Todo el equipo sabe qué hacer en las primeras horas tras detectar un incidente?',
  '¿Conoce el canal oficial de notificación a la APDP (apdp.cl)?',
  '¿Existe una plantilla lista para comunicar la brecha a los titulares afectados?',
  '¿Este plan se revisó en los últimos 12 meses?',
],
```
`porQue` (1→5):
1. `'Sin una definición clara de qué es una "brecha", el equipo puede no reconocer un incidente real como tal y perder el plazo de 72 horas sin darse cuenta.'`
2. `'Ante una brecha real, la falta de responsables designados es la causa más común de que la notificación a la APDP se retrase o simplemente no ocurra.'`
3. `'El plazo de 72 horas corre desde que la empresa "tiene conocimiento" del incidente; por eso se exige un procedimiento de detección y clasificación rápido y documentado.'`
4. `'El Art. 40 obliga a notificar dentro de 72 horas con un contenido mínimo específico; no cumplir el plazo o el contenido es sancionable aunque la brecha se haya contenido bien.'`
5. `'Cuando el riesgo es alto para las personas, ocultarles la brecha les impide protegerse (cambiar claves, alertar a su banco) y agrava la responsabilidad de la empresa.'`

**`procedimiento_arco`** — `checklist`:
```ts
checklist: [
  '¿El canal de recepción de solicitudes ARCO está publicado en su política de privacidad?',
  '¿El proceso de verificación de identidad no es tan invasivo que disuada al titular de ejercer su derecho?',
  '¿Puede demostrar la fecha de recepción de cada solicitud (folio, correo, sistema)?',
  '¿El plazo de 30 días hábiles está monitoreado activamente (alertas, calendario)?',
],
```
`porQue` (1→5):
1. `'Si no existe un canal claro y conocido, los titulares no pueden ejercer sus derechos y la empresa no puede demostrar que ofrece un medio de acceso real.'`
2. `'Responder a la persona equivocada es en sí mismo una filtración de datos; verificar identidad protege tanto al titular real como a la empresa.'`
3. `'Sin un registro con fecha de ingreso, la empresa no puede demostrar ante la APDP que respondió dentro del plazo legal de 30 días hábiles.'`
4. `'El derecho de acceso (Art. 11) exige entregar información específica y completa; un proceso improvisado normalmente omite alguno de los puntos exigidos por ley.'`
5. `'Corregir o eliminar datos en un solo sistema pero no en otros (CRM, backups, planillas) deja el dato inexacto o indebido circulando, lo que sigue siendo una infracción.'`

**`registro_actividades`** — `checklist`:
```ts
checklist: [
  '¿El registro incluye TODAS las actividades de tratamiento de la empresa, no solo las principales?',
  '¿Se actualiza cada vez que se incorpora un nuevo sistema, proveedor o finalidad?',
  '¿Está disponible para entregarlo a la APDP en caso de fiscalización?',
],
```
`porQue` (1→4):
1. `'El registro (Art. 16) debe permitir a la APDP identificar sin ambigüedad quién es responsable de cada tratamiento que fiscalice.'`
2. `'Sin inventariar cada actividad, la empresa no puede saber -ni demostrar- qué datos trata, para qué y con qué base legal: es la base de cualquier auditoría.'`
3. `'El registro debe evidenciar que cada actividad tiene una protección proporcional a su riesgo; de lo contrario no sirve como prueba de cumplimiento.'`
4. `'Un registro desactualizado no refleja la realidad del tratamiento y pierde valor como evidencia ante una fiscalización.'`

**`evaluacion_impacto`** — `checklist`:
```ts
checklist: [
  '¿Esta evaluación se hizo ANTES de iniciar el tratamiento de alto riesgo, no después?',
  '¿Se identificaron riesgos concretos para los titulares, no solo riesgos para la empresa?',
  '¿El riesgo residual final es aceptable, o requiere consulta previa a la APDP?',
  '¿Fue aprobada formalmente por el responsable o el DPO?',
],
```
`porQue` (1→5):
1. `'El Art. 38 exige entender la naturaleza y escala exacta del tratamiento antes de evaluar si es riesgoso; sin esta descripción no hay evaluación real, solo un trámite de papel.'`
2. `'La ley prohíbe tratar más datos de los necesarios; esta sección obliga a justificar que no existe una alternativa menos invasiva.'`
3. `'Sin listar los riesgos concretos para las personas, la EIPD no cumple su función preventiva y la empresa avanza a ciegas con un tratamiento de alto riesgo.'`
4. `'Identificar un riesgo sin mitigarlo no cumple el Art. 38; si el riesgo residual sigue siendo alto, la ley exige consultar a la APDP antes de continuar.'`
5. `'Sin una aprobación formal del responsable o del DPO, la EIPD es solo un borrador técnico sin valor como evidencia de diligencia debida.'`

**`politica_retencion`** — `checklist`:
```ts
checklist: [
  '¿La tabla de plazos cubre TODAS las categorías de datos que trata la empresa (clientes, empleados, marketing, proveedores)?',
  '¿Existe un responsable designado para ejecutar las eliminaciones?',
  '¿El método de destrucción es realmente irreversible (no solo "mover a la papelera")?',
  '¿Se revisó esta política en los últimos 12 meses?',
],
```
`porQue` (1→4):
1. `'Sin un responsable designado, ningún proceso de eliminación se ejecuta en la práctica aunque esté escrito en el papel.'`
2. `'El Art. 7 exige un límite temporal claro para cada categoría de dato; conservarlos "indefinidamente por si acaso" es en sí mismo una infracción.'`
3. `'Los plazos no se cumplen solos: sin una auditoría periódica, los datos vencidos simplemente se acumulan sin que nadie los elimine.'`
4. `'Eliminar un registro de la base de datos pero dejarlo en un respaldo o en papel sin destruir no constituye una eliminación real ante la ley.'`

**`registro_rnpa`** — `checklist`:
```ts
checklist: [
  '¿Ya completó la inscripción en el portal oficial www.apdp.cl?',
  '¿Guardó el número de inscripción y el comprobante como evidencia?',
  '¿Hay una persona responsable de verificar la vigencia periódicamente?',
],
```
`porQue` (1→3):
1. `'El Art. 55 hace obligatoria la inscripción en el RNPA para operar legalmente como responsable de tratamiento; sin ella, la empresa está en incumplimiento aunque el resto de sus documentos estén perfectos.'`
2. `'Guardar el comprobante es la única forma de acreditar ante la APDP que la inscripción existe y está vigente.'`
3. `'Las inscripciones pueden requerir renovación o actualización; sin un responsable asignado, la empresa puede quedar inscrita con datos obsoletos sin darse cuenta.'`

**`consentimiento`** — `checklist`:
```ts
checklist: [
  '¿El texto de consentimiento es específico para cada finalidad (no uno genérico para todo)?',
  '¿El mecanismo de obtención queda registrado con fecha, hora y versión del texto?',
  '¿Existe un canal simple y sin fricción para retirar el consentimiento?',
  '¿El consentimiento no es condición obligatoria para un servicio que no lo requiere?',
],
```
`porQue` (1→4):
1. `'El Art. 12 exige que el consentimiento sea informado; un texto ambiguo o técnico invalida el consentimiento obtenido, sea cual sea la finalidad.'`
2. `'Sin un mecanismo verificable (checkbox, firma, log), la empresa no puede demostrar que el titular efectivamente consintió, lo que equivale a no tener consentimiento.'`
3. `'El titular puede retirar su consentimiento en cualquier momento; si no existe un canal simple para hacerlo, el tratamiento posterior es ilícito.'`
4. `'Sin evidencia con fecha y versión del texto aceptado, la empresa no puede probar ante una fiscalización que el consentimiento fue válido en el momento en que se obtuvo.'`

**`designacion_dpo`** — `checklist`:
```ts
checklist: [
  '¿El DPO cuenta con conocimientos especializados en protección de datos (formación o experiencia acreditable)?',
  '¿Se comunicó formalmente la designación a la APDP?',
  '¿El DPO tiene garantías explícitas de independencia (no recibe instrucciones sobre sus funciones)?',
  '¿La designación está firmada por el representante legal?',
],
```
`porQue` (1→5):
1. `'El Art. 49 exige que el DPO sea identificable y contactable; sin sus datos formalizados, ni la APDP ni los titulares pueden dirigirse a él.'`
2. `'Sin funciones explícitas, el DPO puede quedar reducido a un cargo nominal sin ejercer control real sobre el cumplimiento de la ley.'`
3. `'El Art. 49 exige que el DPO actúe sin instrucciones sobre sus funciones; sin esta garantía formal, la empresa puede presionarlo y anular su rol protector.'`
4. `'La designación del DPO debe comunicarse formalmente a la APDP; sin evidencia de esa comunicación, la empresa no puede acreditar que cumplió esta obligación.'`
5. `'Sin la firma del representante legal, la designación no tiene validez jurídica dentro de la organización.'`

- [ ] **Step 3: Agregar ejemplos concretos a los campos `[COMPLETAR]` que no tienen pista**

Reemplazar en TODO el archivo (aplican a las apariciones textuales exactas, pueden repetirse en varias plantillas — usar reemplazo global de cada patrón):

| Buscar (texto exacto) | Reemplazar por |
|---|---|
| `Razón social: [COMPLETAR]` | `Razón social: [COMPLETAR] (ej: Comercializadora Andina SpA)` |
| `RUT: [COMPLETAR]` | `RUT: [COMPLETAR] (ej: 76.123.456-7)` |
| `Domicilio: [COMPLETAR]` | `Domicilio: [COMPLETAR] (ej: Av. Apoquindo 1234, Las Condes, Santiago)` |
| `Correo de privacidad: [COMPLETAR]` | `Correo de privacidad: [COMPLETAR] (ej: privacidad@suempresa.cl)` |
| `Teléfono: [COMPLETAR]` | `Teléfono: [COMPLETAR] (ej: +56 2 2345 6789)` |
| `Representante legal: [COMPLETAR]` | `Representante legal: [COMPLETAR] (ej: Juan Pérez Soto)` |
| `Correo electrónico: [COMPLETAR]` | `Correo electrónico: [COMPLETAR] (ej: contacto@suempresa.cl)` |

Estos 7 patrones cubren la mayoría de campos "pelados" repetidos en `politica_privacidad` (sección 1), `contrato_encargado` (sección 1), `registro_actividades` (sección 1) y otras. Además, aplicar estos reemplazos puntuales (no repetidos, uno por plantilla):

- En `plan_brechas`, sección 2, placeholder: reemplazar `'Coordinador de respuesta (DPO o responsable designado):\nNombre: [COMPLETAR]\nCargo: [COMPLETAR]\nContacto: [COMPLETAR]\n\n'` por `'Coordinador de respuesta (DPO o responsable designado):\nNombre: [COMPLETAR] (ej: María González Rojas)\nCargo: [COMPLETAR] (ej: Gerente de Operaciones)\nContacto: [COMPLETAR] (ej: maria.gonzalez@suempresa.cl / +56 9 8765 4321)\n\n'`.
- En `evaluacion_impacto`, sección 1, placeholder: reemplazar `'Nombre del tratamiento: [COMPLETAR]\n'` por `'Nombre del tratamiento: [COMPLETAR] (ej: Sistema de videovigilancia con reconocimiento facial en sucursales)\n'`.
- En `evaluacion_impacto`, sección 5, placeholder: reemplazar `'Elaborado por: [COMPLETAR]\nCargo: [COMPLETAR]\nFecha de elaboración: [COMPLETAR]\nAprobado por (DPO o responsable): [COMPLETAR]\nFecha de aprobación: [COMPLETAR]'` por `'Elaborado por: [COMPLETAR] (ej: Equipo de Cumplimiento)\nCargo: [COMPLETAR] (ej: Analista de Riesgos)\nFecha de elaboración: [COMPLETAR] (ej: 15 de marzo de 2026)\nAprobado por (DPO o responsable): [COMPLETAR] (ej: nombre del DPO)\nFecha de aprobación: [COMPLETAR]'`.
- En `registro_rnpa`, sección 2, placeholder: reemplazar `'Número de inscripción RNPA: [COMPLETAR]\nFecha de inscripción: [COMPLETAR]\nFecha de vencimiento (si aplica): [COMPLETAR]\n'` por `'Número de inscripción RNPA: [COMPLETAR] (ej: RNPA-2026-0001234)\nFecha de inscripción: [COMPLETAR] (ej: 10 de enero de 2026)\nFecha de vencimiento (si aplica): [COMPLETAR]\n'`.
- En `designacion_dpo`, sección 1, placeholder: reemplazar `'Nombre completo: [COMPLETAR]\nRUT: [COMPLETAR]\nCargo dentro de la empresa (si es interno): [COMPLETAR]\n'` por `'Nombre completo: [COMPLETAR] (ej: Andrea Muñoz Silva)\nRUT: [COMPLETAR] (ej: 15.678.234-5)\nCargo dentro de la empresa (si es interno): [COMPLETAR] (ej: Jefa de Cumplimiento Normativo)\n'`.
- En `designacion_dpo`, sección 4, placeholder: reemplazar `'Fecha de notificación a la APDP: [COMPLETAR]\n'` por `'Fecha de notificación a la APDP: [COMPLETAR] (ej: 20 de enero de 2026)\n'`.

- [ ] **Step 4: Verificar que el archivo compila**

Run: `npx tsc --noEmit`
Expected: sin errores. Si aparece un error de "Property 'porQue' is missing" o similar, revisar que las 10 plantillas (todas las secciones) tengan el campo agregado.

- [ ] **Step 5: Ejecutar el test de regresión de codificación**

Run: `npx vitest run __tests__/pdfEncoding.test.ts`
Expected: PASS — los 3 tests ahora pasan (los campos `checklist`/`porQue` ya existen y no contienen emojis).

- [ ] **Step 6: Commit**

```bash
git add lib/templateContent.ts
git commit -m "feat(plantillas): agregar porQue legal y checklist de verificacion a las 10 plantillas"
```

---

### Task 3: Renderer PDF profesional (`lib/pdfExport.ts` → `generarPlantillaPDF`)

**Files:**
- Modify: `lib/pdfExport.ts` (función `generarPlantillaPDF`, líneas ~305-474)

**Interfaces:**
- Consumes: `ContenidoPlantilla.checklist: string[]`, `SeccionPlantilla.porQue: string` (de la Tarea 2).

- [ ] **Step 1: Agregar el bloque "Por qué la ley lo exige" dentro de cada sección**

En `lib/pdfExport.ts`, dentro del `for (const seccion of tpl.secciones)`, después del bloque de instrucción (que ya quedó sin emoji tras la Tarea 1) y antes de "Contenido placeholder", insertar:

```ts
    // Recuadro "Por qué la ley lo exige": explica el riesgo legal que cubre la sección
    if (seccion.porQue) {
      checkY(16);
      doc.setFillColor(247, 248, 252);
      doc.setDrawColor(...C.lightGray);
      const porQueLines = doc.splitTextToSize(seccion.porQue, PW - margin * 2 - 8);
      const boxH = porQueLines.length * 4.2 + 8;
      doc.roundedRect(margin, y, PW - margin * 2, boxH, 1.5, 1.5, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.navy2);
      doc.text('POR QUÉ LA LEY LO EXIGE', margin + 4, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.text2);
      doc.text(porQueLines, margin + 4, y + 9.5);
      y += boxH + 5;
    }
```

- [ ] **Step 2: Agregar la sección de checklist antes de las notas legales**

En `lib/pdfExport.ts`, justo antes del bloque `// ── Notas legales ──`, insertar:

```ts
  // ── Checklist de verificación ──
  checkY(20);
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(margin, y, PW - margin * 2, 8, 2, 2, 'FD');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text);
  doc.text('Antes de usar este documento, confirme que:', margin + 4, y + 5.5);
  y += 13;
  for (const item of tpl.checklist) {
    checkY(8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text2);
    // Casilla de verificación dibujada (cuadro vacío) + texto del ítem
    doc.setDrawColor(...C.gray);
    doc.rect(margin, y - 3, 3.5, 3.5);
    const itemLines = doc.splitTextToSize(item, PW - margin * 2 - 8);
    doc.text(itemLines, margin + 6, y);
    y += itemLines.length * 4.5 + 3;
  }
  y += 6;
```

- [ ] **Step 3: Ejecutar el proyecto y generar una plantilla de prueba**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/pdfExport.ts
git commit -m "feat(plantillas): renderizar porQue legal y checklist de verificacion en PDF"
```

---

### Task 4: Renderer Word profesional (`lib/docxTemplates.ts`)

**Files:**
- Modify: `lib/docxTemplates.ts`

**Interfaces:**
- Consumes: `ContenidoPlantilla.checklist: string[]`, `SeccionPlantilla.porQue: string` (de la Tarea 2).

- [ ] **Step 1: Agregar el párrafo "Por qué la ley lo exige" dentro de cada sección**

En `lib/docxTemplates.ts`, dentro del `for (const seccion of tpl.secciones)`, inmediatamente después del bloque `if (seccion.instruccion) { ... }` y antes de "Convertir placeholder en líneas del documento", insertar:

```ts
    if (seccion.porQue) {
      children.push(
        new Paragraph({
          spacing: { after: 160 },
          shading: { fill: 'F7F8FC' },
          children: [
            new TextRun({ text: 'Por qué la ley lo exige: ', bold: true, size: 17, color: '1A2F5A' }),
            new TextRun({ text: seccion.porQue, size: 17, color: '4A5880' }),
          ],
        }),
      );
    }
```

- [ ] **Step 2: Agregar la sección de checklist antes de las notas legales**

En `lib/docxTemplates.ts`, antes de `children.push(separador());` (el separador final, previo a "Notas legales:"), insertar:

```ts
  // Checklist de verificación final
  children.push(
    new Paragraph({
      text: 'Antes de usar este documento, confirme que:',
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 300, after: 100 },
    }),
  );
  for (const item of tpl.checklist) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: '☐ ', bold: true, size: 20 }),
          new TextRun({ text: item, size: 19 }),
        ],
      }),
    );
  }
```

- [ ] **Step 3: Verificar que `Paragraph` soporta `shading` en la versión instalada de `docx`**

Run: `npx tsc --noEmit`
Expected: sin errores. Si `shading` no es una propiedad válida en el tipo `IParagraphOptions` de la versión de `docx` instalada, eliminar la línea `shading: { fill: 'F7F8FC' },` del Step 1 (el párrafo sigue funcionando sin el resaltado de fondo, solo pierde el color de fondo).

- [ ] **Step 4: Commit**

```bash
git add lib/docxTemplates.ts
git commit -m "feat(plantillas): renderizar porQue legal y checklist de verificacion en Word"
```

---

### Task 5: Verificación de plantillas — build + generación de prueba

**Files:** ninguno (solo comandos).

- [ ] **Step 1: Compilación completa**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 2: Suite de tests completa**

Run: `npm test`
Expected: PASS, incluyendo los 3 tests nuevos de `__tests__/pdfEncoding.test.ts`.

- [ ] **Step 3: Generar una plantilla de prueba manualmente y confirmar visualmente que no hay caracteres corruptos**

Run: `npm run dev`, entrar en modo demo, ir a "Mi diagnóstico", abrir cualquier requisito en rojo/amarillo, usar el dropdown "Generar plantilla" → "Descargar como PDF" para `politica_privacidad` (o el primer requisito con plantilla disponible). Abrir el PDF descargado y confirmar:
1. No aparece ningún "Ø=Ü..." en ninguna parte del documento.
2. Aparece el recuadro "POR QUÉ LA LEY LO EXIGE" en cada sección con texto legible.
3. Aparece la sección "Antes de usar este documento, confirme que:" con checkboxes antes de "Notas legales".
Repetir la descarga en Word y confirmar que abre sin errores en Word/LibreOffice.

---

### Task 6: Consolidar íconos (Lucide-style) para el pulido visual

**Files:**
- Modify: `components/Icons.tsx` (agregar íconos nuevos)

**Interfaces:**
- Produces: nuevos componentes exportados desde `Icons.tsx`, todos con `strokeWidth="1.5"`, `stroke={color}`, `fill="none"`, firma `{ size?: number; className?: string; color?: string }` igual a los existentes.

- [ ] **Step 1: Agregar los íconos que reemplazarán emojis/SVGs inline inconsistentes**

Al final de `components/Icons.tsx`, agregar (siguiendo exactamente el patrón de los íconos existentes, `strokeWidth="1.5"`):

```tsx
export function LockIcon({ size = 14, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 14, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function FileDownIcon({ size = 14, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M12 18v-6" /><path d="m9 15 3 3 3-3" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 14, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21.8 10A10 10 0 1 1 17 3.34" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

export function XCircleIcon({ size = 14, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" /><path d="m9 9 6 6" />
    </svg>
  );
}

export function ScaleBalanceIcon({ size = 14, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3v18" /><path d="M3 7h18" />
      <path d="m5 7 3 6a3 3 0 0 1-6 0Z" /><path d="m19 7-3 6a3 3 0 0 0 6 0Z" />
    </svg>
  );
}

export function TrendUpIcon({ size = 14, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

export function ClockIcon({ size = 14, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function SparkleIcon({ size = 14, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m7 7 1.5 1.5M17 7l-1.5 1.5M7 17l1.5-1.5M17 17l-1.5-1.5" />
    </svg>
  );
}
```

- [ ] **Step 2: Verificar que el proyecto compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/Icons.tsx
git commit -m "feat(ui): agregar iconos Lucide-style para reemplazar emojis en el pulido visual"
```

---

### Task 7: Pulido visual — reemplazo de emojis/íconos inline (excepto Landing/LoginCard)

**Files:**
- Modify: `components/DiagnosticoView.tsx`, `components/RiesgosView.tsx`, `components/TemplateDropdown.tsx`, `components/UploadView.tsx`, `components/LegalDetail.tsx`, `components/AnalyzingScreen.tsx`

**Interfaces:**
- Consumes: íconos de `components/Icons.tsx` (Task 6) — `LockIcon`, `CheckCircleIcon`, `XCircleIcon`, `ClockIcon`, `FileDownIcon`, `ScaleBalanceIcon`.

Reemplazos texto→ícono (mantener el mismo texto visible junto al ícono cuando ya existe; el objetivo es que ningún emoji quede en la UI fuera de Landing/LoginCard):

- [ ] **Step 1: `components/DiagnosticoView.tsx`**

Reemplazar el ícono de la nota de aislamiento multi-tenant (línea ~218). Cambiar el import:

```tsx
import LegalDetail from './LegalDetail';
```

por:

```tsx
import LegalDetail from './LegalDetail';
import { LockIcon } from './Icons';
```

Reemplazar:

```tsx
        <span className="tenant-isolation-icon" aria-hidden="true">🔒</span>
```

por:

```tsx
        <span className="tenant-isolation-icon"><LockIcon size={13} /></span>
```

- [ ] **Step 2: `components/RiesgosView.tsx`**

Cambiar el import:

```tsx
import { REQUISITOS } from '@/lib/requisitos';
import type { RequisitoResult } from '@/lib/types';
```

por:

```tsx
import { REQUISITOS } from '@/lib/requisitos';
import type { RequisitoResult } from '@/lib/types';
import { AlertCircleIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from './Icons';
```

Reemplazar:

```tsx
              <div className={`riesgo-plazo-urgencia ${r.plazo.urgency}`}>
                {r.plazo.urgency === 'urgent' ? '⚠ Urgente' : r.plazo.urgency === 'pronto' ? '◷ Pronto' : '✓ Vigente'}
              </div>
```

por:

```tsx
              <div className={`riesgo-plazo-urgencia ${r.plazo.urgency}`}>
                {r.plazo.urgency === 'urgent'
                  ? <><AlertCircleIcon size={11} /> Urgente</>
                  : r.plazo.urgency === 'pronto'
                    ? <><ClockIcon size={11} /> Pronto</>
                    : <><CheckCircleIcon size={11} /> Vigente</>}
              </div>
```

Reemplazar:

```tsx
              {analyzed && estado && (
                <div className={`riesgo-estado-chip ${estado}`}>
                  {estado === 'green' ? '✓ Cumple' : estado === 'yellow' ? '⚠ Parcial' : '✕ Falta'}
                </div>
              )}
```

por:

```tsx
              {analyzed && estado && (
                <div className={`riesgo-estado-chip ${estado}`}>
                  {estado === 'green'
                    ? <><CheckCircleIcon size={11} /> Cumple</>
                    : estado === 'yellow'
                      ? <><AlertCircleIcon size={11} /> Parcial</>
                      : <><XCircleIcon size={11} /> Falta</>}
                </div>
              )}
```

En `app/globals.css`, ubicar `.riesgo-plazo-urgencia` y `.riesgo-estado-chip` y agregar `display: inline-flex; align-items: center; gap: 4px;` si no lo tienen ya (verificar antes de duplicar la regla).

- [ ] **Step 3: `components/TemplateDropdown.tsx`**

Cambiar el import:

```tsx
import { useState, useRef, useEffect } from 'react';
import { TEMPLATES } from '@/lib/templateContent';
```

por:

```tsx
import { useState, useRef, useEffect } from 'react';
import { TEMPLATES } from '@/lib/templateContent';
import { FileDownIcon } from './Icons';
```

Reemplazar:

```tsx
        {loading ? <span className="spin">↻</span> : '📄'}
```

por:

```tsx
        {loading ? <span className="spin">↻</span> : <FileDownIcon size={13} />}
```

Reemplazar:

```tsx
          <button className="tpl-menu-item" onClick={handleDocx}>
            <span className="tpl-menu-icon">📝</span>
```

por:

```tsx
          <button className="tpl-menu-item" onClick={handleDocx}>
            <span className="tpl-menu-icon"><FileDownIcon size={15} /></span>
```

Reemplazar:

```tsx
          <button className="tpl-menu-item" onClick={handlePdf}>
            <span className="tpl-menu-icon">📄</span>
```

por:

```tsx
          <button className="tpl-menu-item" onClick={handlePdf}>
            <span className="tpl-menu-icon"><FileDownIcon size={15} /></span>
```

- [ ] **Step 4: `components/LegalDetail.tsx`**

Leer el archivo completo primero (49 líneas) y reemplazar cada `<span className="legal-item-icon">📜/📂/⚖/💬</span>` por el ícono equivalente de `Icons.tsx` (`FileTextIcon`, `FolderOpenIcon`, `ScaleBalanceIcon`, y para 💬 usar un ícono de mensaje — si no existe uno adecuado en `Icons.tsx`, usar `AlertCircleIcon` como aproximación semántica de "nota" o agregar un `MessageIcon` siguiendo el mismo patrón que los íconos de la Tarea 6). Verificar el resultado visualmente en `npm run dev`.

- [ ] **Step 5: `components/AnalyzingScreen.tsx`**

Leer el archivo (99 líneas) y verificar si usa algún emoji o símbolo fuera de los ya cubiertos (`✓`); `✓` es seguro para HTML/React (no pasa por jsPDF), así que NO requiere cambio salvo que se quiera unificar visualmente con `CheckCircleIcon` por consistencia de estilo. Si se reemplaza, usar el mismo patrón de las Steps anteriores.

- [ ] **Step 6: Verificar que el proyecto compila y se ve correctamente**

Run: `npx tsc --noEmit && npm run dev`
Abrir la app en modo demo y revisar visualmente: Riesgos, Mi diagnóstico (nota de aislamiento), dropdown de plantillas, ficha legal expandida. Ningún emoji debe quedar visible en estas vistas.

- [ ] **Step 7: Commit**

```bash
git add components/DiagnosticoView.tsx components/RiesgosView.tsx components/TemplateDropdown.tsx components/LegalDetail.tsx app/globals.css
git commit -m "feat(ui): reemplazar emojis por iconos Lucide-style consistentes (excepto login)"
```

---

### Task 8: Pulido visual — foco de teclado, accesibilidad y estados vacíos/hover

**Files:**
- Modify: `app/globals.css`
- Modify: `components/UploadView.tsx`, `components/RegistroView.tsx`, `components/RiesgosView.tsx` (atributos de accesibilidad)

**Contexto:** se auditó `app/globals.css` (1152 líneas) y no existe ninguna regla `:focus-visible`; la navegación por teclado depende del estilo nativo del navegador, inconsistente entre Chrome/Firefox. `HistorialView.tsx` y `RegistroView.tsx` ya tienen `.empty-state` bien resuelto — ese patrón se usa como referencia, no se toca.

- [ ] **Step 1: Agregar foco de teclado visible y consistente**

En `app/globals.css`, después de la regla `*, *::before, *::after` (o al final del bloque de reset inicial, buscar `box-sizing: border-box`), agregar:

```css
/* Foco de teclado visible y consistente en toda la app (excepto login, que no se toca) */
.app-content button:focus-visible,
.app-content a:focus-visible,
.app-content input:focus-visible,
.app-content select:focus-visible,
.app-nav .nav-tab:focus-visible,
.app-header button:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 2: Agregar `tabIndex` y `role` a los tabs de navegación no nativos**

En `components/AppShell.tsx`, cada `<div className="nav-tab...">` es clicable pero no es focuseable por teclado (`div` no recibe foco ni Enter/Space por defecto). Agregar `tabIndex={0}`, `role="tab"` y `onKeyDown` a los 5 `<div className={\`nav-tab...\`}>` (subir, diagnóstico, riesgos, registro, historial). Ejemplo para el primero (aplicar el mismo patrón a los otros 4):

Reemplazar:

```tsx
        <div className={`nav-tab${activeTab === 'subir' ? ' active' : ''}`} onClick={() => onSwitchTab('subir')}>
          <FolderOpenIcon size={14} /> Subir documentos
        </div>
```

por:

```tsx
        <div
          className={`nav-tab${activeTab === 'subir' ? ' active' : ''}`}
          role="tab"
          tabIndex={0}
          aria-selected={activeTab === 'subir'}
          onClick={() => onSwitchTab('subir')}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSwitchTab('subir'); } }}
        >
          <FolderOpenIcon size={14} /> Subir documentos
        </div>
```

Aplicar el mismo patrón (role="tab", tabIndex={0}, aria-selected, onKeyDown) a los 4 `nav-tab` restantes (`diagnostico`, `riesgos`, `registro`, `historial`), preservando cada `onSwitchTab(...)` correspondiente.

- [ ] **Step 3: Agregar `<label>` accesible al input de archivo oculto**

En `components/UploadView.tsx`, el `<input type="file" style={{ display: 'none' }} ... />` (línea ~202) no tiene `aria-label`. Reemplazar:

```tsx
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileSelected}
      />
```

por:

```tsx
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Seleccionar documento para subir"
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileSelected}
      />
```

Aplicar el mismo `aria-label="Seleccionar documento para subir"` al input equivalente en `components/DiagnosticoView.tsx` (línea ~470, dentro de `<input ref={fileInputRef} type="file" ...>`).

- [ ] **Step 4: Confirmar contraste de los badges de estado**

En `app/globals.css`, revisar las reglas `.riesgo-nivel-badge`, `.registro-role`, `.sem-mini` y `.nav-tab-badge`: todas ya usan combinaciones definidas en `:root` (`--green`/`--green-bg`, `--yellow`/`--yellow-bg`, `--red`/`--red-bg`, `--blue`/`--blue-dim`) que fueron diseñadas para AA en fondo claro — no requieren cambio. Confirmar visualmente con `npm run dev` que ningún texto queda ilegible (ej. texto gris claro sobre fondo blanco).

- [ ] **Step 5: Verificar navegación completa por teclado**

Run: `npm run dev`. En el navegador, con el mouse fuera del teclado (solo Tab/Enter/Espacio/flechas), navegar: logo → tabs → contenido → botones de acción → logout. Confirmar que el foco es visible en cada elemento y que Enter/Espacio activa los tabs.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css components/AppShell.tsx components/UploadView.tsx components/DiagnosticoView.tsx
git commit -m "feat(a11y): foco de teclado visible, tabs navegables y aria-label en inputs de archivo"
```

---

### Task 9: Verificación final del pulido visual y entregables

**Files:** ninguno (solo comandos y resumen).

- [ ] **Step 1: Build de producción**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores de TypeScript ni de build.

- [ ] **Step 2: Suite de tests**

Run: `npm test`
Expected: PASS (incluye `__tests__/multitenancy.test.ts` de 12 tests y `__tests__/pdfEncoding.test.ts` de 3 tests — 15 tests en total).

- [ ] **Step 3: Servidor de desarrollo — verificación manual completa**

Run: `npm run dev`. Verificar en el navegador (modo demo):
1. Login (NO debe verse distinto — confirmar que no se tocó).
2. Subir documentos → hover/focus en botones, estado de carga con spinner.
3. Mi diagnóstico → nota de aislamiento con ícono, plantillas descargables sin emoji.
4. Riesgos → chips de estado con íconos.
5. Registro de auditoría → tabla y sección de eventos de seguridad.
6. Historial → gráfico y estado vacío (si aplica).
Detener el servidor al terminar.

- [ ] **Step 4: Generar y abrir una plantilla PDF de prueba final**

Run: (con `npm run dev` activo) descargar la plantilla PDF de `plan_brechas` o `contrato_encargado` y confirmar que no contiene caracteres corruptos, que el recuadro "POR QUÉ LA LEY LO EXIGE" aparece en cada sección y que el checklist final aparece antes de "Notas legales".

- [ ] **Step 5: Commit final si quedara algún cambio suelto**

```bash
git status
```

Si hay cambios sin commitear, revisarlos y confirmarlos con un mensaje descriptivo. Si no hay cambios, no crear un commit vacío.

---

## Resumen de entregables para el usuario

Al completar este plan, informar:
1. Que `npm run build` y `npm run dev` funcionan sin errores.
2. Lista de las 10 plantillas mejoradas (todas ganan `porQue` por sección + `checklist` final) y el detalle de qué se corrigió en cada renderer (PDF y Word).
3. Lista de componentes con pulido visual (íconos consolidados, foco de teclado, aria-labels) — explícitamente excluyendo `Landing.tsx` y `LoginCard.tsx`.
4. Confirmación de que se generó una plantilla de prueba (PDF) y no contiene caracteres corruptos, con el test automatizado `__tests__/pdfEncoding.test.ts` como evidencia repetible.
