import { REQUISITOS } from './requisitos';
import type { UploadedDoc, RequisitoResult, CriterioResult } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES DE CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

// Palabras que niegan el concepto que les sigue dentro de la ventana
const PALABRAS_NEGACION = [
  'no', 'sin', 'nunca', 'tampoco', 'ningún', 'ninguna', 'ninguno',
  'carece', 'excepto', 'salvo', 'jamás', 'ni', 'jamas',
];

// Ventana de palabras para considerar dos términos como próximos (en el mismo párrafo/idea)
const VENTANA_PROXIMIDAD = 10;

// Umbral de densidad a partir del cual se considera que el concepto es recurrente
const UMBRAL_DENSIDAD_ALTA = 3;

// Radio en caracteres a cada lado del término encontrado para armar el
// fragmento de contexto que se le muestra al usuario como evidencia.
const RADIO_FRAGMENTO = 90;

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES INTERNAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Limpia puntuación de una palabra para comparación semántica.
 */
function limpiarPalabra(p: string): string {
  return p.replace(/[¿?¡!.,;:()"'«»\-–—]/g, '').toLowerCase();
}

/**
 * Detecta si en las 4 palabras anteriores a 'posicion' hay una negación.
 * Retorna true si el concepto está precedido por una negación.
 */
function detectarNegacion(palabras: string[], posicion: number): boolean {
  const inicio = Math.max(0, posicion - 4);
  for (let i = inicio; i < posicion; i++) {
    if (PALABRAS_NEGACION.includes(limpiarPalabra(palabras[i]))) return true;
  }
  return false;
}

/**
 * Encuentra todas las posiciones (índices de palabra) donde aparece un término
 * (que puede ser una o varias palabras) en el array de palabras del documento.
 */
function encontrarPosiciones(palabras: string[], termino: string): number[] {
  const partes = termino.toLowerCase().split(/\s+/);
  const posiciones: number[] = [];

  for (let i = 0; i <= palabras.length - partes.length; i++) {
    if (partes.every((p, j) => limpiarPalabra(palabras[i + j] ?? '') === limpiarPalabra(p))) {
      posiciones.push(i);
    }
  }
  return posiciones;
}

/**
 * Busca frases legales exactas (multi-palabra) en el texto normalizado.
 * Las frases exactas son evidencia fuerte: usan el lenguaje jurídico correcto.
 */
function buscarFrasesExactas(texto: string, frases: string[]): string[] {
  return frases.filter(f => texto.includes(f.toLowerCase()));
}

/**
 * Calcula la densidad: suma de ocurrencias de todos los términos en el texto.
 * Mayor densidad = el documento habla extensamente del concepto.
 */
function calcularDensidad(texto: string, terminos: string[]): number {
  let total = 0;
  for (const t of terminos) {
    const lower = t.toLowerCase();
    let idx = 0;
    while ((idx = texto.indexOf(lower, idx)) !== -1) {
      total++;
      idx += lower.length;
    }
  }
  return total;
}

/**
 * Extrae un fragmento EXACTO del documento (texto real, tal cual aparece)
 * alrededor de la primera aparición de 'termino'. Este fragmento es lo que
 * se le muestra al usuario como evidencia: "el documento dice: '...'".
 * Se ajusta a límites de palabra para no cortar a mitad de una palabra.
 */
function extraerFragmento(texto: string, termino: string): string {
  const idx = texto.indexOf(termino.toLowerCase());
  if (idx === -1) return '';

  let inicio = Math.max(0, idx - RADIO_FRAGMENTO);
  let fin = Math.min(texto.length, idx + termino.length + RADIO_FRAGMENTO);
  while (inicio > 0 && /\S/.test(texto[inicio - 1])) inicio--;
  while (fin < texto.length && /\S/.test(texto[fin])) fin++;

  const prefijo = inicio > 0 ? '… ' : '';
  const sufijo = fin < texto.length ? ' …' : '';
  return (prefijo + texto.slice(inicio, fin).trim() + sufijo).replace(/\s+/g, ' ');
}

/**
 * Verifica si al menos dos términos de la lista aparecen a menos de
 * VENTANA_PROXIMIDAD palabras entre sí, indicando una idea coherente.
 */
function calcularProximidad(palabras: string[], terminos: string[]): boolean {
  // Obtener la primera posición válida de cada término
  const posiciones = terminos
    .map(t => encontrarPosiciones(palabras, t)[0] ?? -1)
    .filter(p => p !== -1);

  for (let i = 0; i < posiciones.length; i++) {
    for (let j = i + 1; j < posiciones.length; j++) {
      if (Math.abs(posiciones[i] - posiciones[j]) <= VENTANA_PROXIMIDAD) return true;
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVALUACIÓN DE UN CRITERIO INDIVIDUAL
// ═══════════════════════════════════════════════════════════════════════════

interface EvaluacionCriterio {
  frasesEncontradas: string[];
  kwsValidas: string[];
  kwsNegadas: string[];
  sinonimosValidos: string[];
  densidad: number;
  proximidad: boolean;
  requiereRevisionManual: boolean;
  status: 'ok' | 'warn' | 'fail';
  confianza: 'alta' | 'media' | 'baja';
  fragmento: string;
}

/**
 * Evalúa un criterio individual contra el texto del documento.
 * Aplica detección de negaciones, proximidad, densidad y frases legales exactas.
 */
function evaluarCriterio(
  texto: string,
  palabras: string[],
  keywords: string[],
  synonyms: string[],
  frasesLegales: string[],
): EvaluacionCriterio {

  // ── 1. Frases legales exactas ──────────────────────────────────────────
  // Peso máximo: evidencia de lenguaje jurídico correcto.
  const frasesEncontradas = buscarFrasesExactas(texto, frasesLegales);

  // ── 2. Keywords: separar válidas de negadas ────────────────────────────
  // Un keyword contado como negada NO contribuye al cumplimiento.
  const kwsValidas: string[] = [];
  const kwsNegadas: string[] = [];

  for (const kw of keywords) {
    const posiciones = encontrarPosiciones(palabras, kw);
    let hayValida = false;
    let hayNegada = false;

    for (const pos of posiciones) {
      if (detectarNegacion(palabras, pos)) {
        hayNegada = true;
      } else {
        hayValida = true;
        break; // basta con una ocurrencia válida para contar
      }
    }

    if (hayValida) kwsValidas.push(kw);
    else if (hayNegada) kwsNegadas.push(kw);
  }

  // ── 3. Sinónimos (solo cuando no hay evidencia primaria) ───────────────
  // Peso menor: indican el concepto pero con lenguaje no exacto.
  const sinonimosValidos: string[] = [];
  if (kwsValidas.length === 0 && frasesEncontradas.length === 0) {
    for (const syn of synonyms) {
      const posiciones = encontrarPosiciones(palabras, syn);
      const valido = posiciones.some(pos => !detectarNegacion(palabras, pos));
      if (valido) sinonimosValidos.push(syn);
    }
  }

  // ── 4. Densidad de menciones ───────────────────────────────────────────
  // Más menciones coherentes = mayor confianza en el cumplimiento.
  const densidad = calcularDensidad(texto, [...keywords, ...frasesLegales]);

  // ── 5. Proximidad de conceptos ─────────────────────────────────────────
  // Términos juntos forman una idea coherente; dispersos son menos confiables.
  const terminosPositivos = [...kwsValidas, ...frasesEncontradas];
  const proximidad = terminosPositivos.length >= 2
    ? calcularProximidad(palabras, terminosPositivos)
    : false;

  // ── 6. ¿Requiere revisión manual? ─────────────────────────────────────
  // Solo cuando la evidencia es exclusivamente negada (posible contradicción).
  const requiereRevisionManual =
    kwsNegadas.length > 0 &&
    kwsValidas.length === 0 &&
    frasesEncontradas.length === 0 &&
    sinonimosValidos.length === 0;

  // ── 7. Determinar status ───────────────────────────────────────────────
  // ok: evidencia sólida. warn: evidencia débil o negada. fail: sin evidencia.
  const umbralOk = Math.max(1, Math.ceil(keywords.length * 0.6));
  let status: 'ok' | 'warn' | 'fail';

  if (frasesEncontradas.length > 0 || kwsValidas.length >= umbralOk) {
    status = 'ok';
  } else if (kwsValidas.length > 0 || sinonimosValidos.length > 0 || requiereRevisionManual) {
    status = 'warn';
  } else {
    status = 'fail';
  }

  // ── 8. Determinar confianza ────────────────────────────────────────────
  // Refleja qué tan segura es la detección automática.
  let confianza: 'alta' | 'media' | 'baja';

  if (frasesEncontradas.length > 0) {
    // Frase legal exacta = señal más fuerte
    confianza = 'alta';
  } else if (kwsValidas.length >= umbralOk && (densidad > UMBRAL_DENSIDAD_ALTA || proximidad)) {
    // Keywords suficientes con buena densidad o proximidad
    confianza = 'alta';
  } else if (kwsValidas.length > 0) {
    // Keywords encontradas pero sin densidad/proximidad buena
    confianza = 'media';
  } else if (sinonimosValidos.length > 0) {
    // Solo sinónimos — concepto presente pero no con lenguaje preciso
    confianza = 'media';
  } else {
    confianza = 'baja';
  }

  // Si hay revisión manual, la confianza baja al menos un nivel
  if (requiereRevisionManual && confianza === 'alta') confianza = 'media';

  // ── 9. Fragmento exacto del documento que respalda la detección ────────
  // Prioridad: frase legal exacta > keyword válida > sinónimo. Sin evidencia
  // (fail) no hay nada que citar.
  const terminoClave = frasesEncontradas[0] ?? kwsValidas[0] ?? sinonimosValidos[0] ?? null;
  const fragmento = terminoClave ? extraerFragmento(texto, terminoClave) : '';

  return {
    frasesEncontradas,
    kwsValidas,
    kwsNegadas,
    sinonimosValidos,
    densidad,
    proximidad,
    requiereRevisionManual,
    status,
    confianza,
    fragmento,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL EXPORTADA
// ═══════════════════════════════════════════════════════════════════════════

export function analyzeDocument(
  reqId: string,
  uploadedDocs: Record<string, UploadedDoc>
): RequisitoResult {
  const req = REQUISITOS.find(r => r.id === reqId)!;
  const doc = uploadedDocs[reqId];

  // Sin documento subido
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
        negaciones: [],
        frasesLegalesEncontradas: [],
        requiereRevisionManual: false,
        densidad: 0,
        fragmentoDocumento: '',
      })),
      gap: `Documento obligatorio según ${req.art}. Sin este documento su empresa queda expuesta a multas de ${req.multa}.`,
    };
  }

  // Documento escaneado: texto no extraíble
  if (doc.scanned) {
    return {
      estado: 'unanalyzable',
      cobertura: 0,
      criterios: req.criterios.map(c => ({
        name: c.name,
        status: 'fail',
        found: 'No analizable — documento escaneado',
        kwFound: 0,
        kwTotal: c.keywords.length,
        confianza: 'baja',
        validado: c.validado,
        negaciones: [],
        frasesLegalesEncontradas: [],
        requiereRevisionManual: false,
        densidad: 0,
        fragmentoDocumento: '',
      })),
      gap: `El archivo "${doc.name}" parece ser un PDF escaneado o una imagen. No es posible extraer su texto para verificar el cumplimiento. Súbalo como PDF con texto seleccionable, Word o TXT.`,
    };
  }

  const texto = doc.text.toLowerCase();
  const palabras = texto.split(/\s+/);

  const criterios: CriterioResult[] = req.criterios.map(c => {
    const ev = evaluarCriterio(texto, palabras, c.keywords, c.synonyms, c.frasesLegales);

    // ── Construir texto explicativo (campo 'found') ──────────────────────
    // Explica qué evidencia encontró el motor para este criterio.
    const partes: string[] = [];

    if (ev.frasesEncontradas.length > 0) {
      partes.push(`Frase legal: "${ev.frasesEncontradas.slice(0, 2).join('", "')}"`);
    }
    if (ev.kwsValidas.length > 0) {
      partes.push(`Términos: ${ev.kwsValidas.slice(0, 3).map(k => `"${k}"`).join(', ')}`);
    }
    if (ev.sinonimosValidos.length > 0) {
      partes.push(`Sinónimo: "${ev.sinonimosValidos.slice(0, 2).join('", "')}"`);
    }
    if (ev.kwsNegadas.length > 0) {
      partes.push(`Negado: "${ev.kwsNegadas[0]}"`);
    }
    if (ev.proximidad) partes.push('conceptos próximos');
    if (ev.densidad > 1) partes.push(`×${ev.densidad} menciones`);

    const found = partes.length > 0
      ? partes.join(' · ')
      : 'No encontrado en el documento';

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
      fragmentoDocumento: ev.fragmento,
    };
  });

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
