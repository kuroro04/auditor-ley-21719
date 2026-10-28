import { REQUISITOS } from './requisitos';
import type { UploadedDoc, RequisitoResult, CriterioResult, Requisito, ClasificacionConfig, ClasificacionDocumentoResult } from './types';

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

// Marcadores de contexto normativo: indican que un keyword aparece en un
// párrafo descriptivo ("la ley exige que…"), no en una declaración performativa.
const MARCADORES_CONTEXTO_NORMATIVO = [
  'la ley', 'el art.', 'el artículo', 'según el', 'conforme al',
  'la norma', 'la normativa', 'exige que', 'obliga a', 'requiere que',
  'establece que', 'dispone que',
];

// ═══════════════════════════════════════════════════════════════════════════
// CLASIFICACIÓN DEL TIPO DE DOCUMENTO (paso previo a la evaluación)
// ═══════════════════════════════════════════════════════════════════════════

// Marcadores transversales de documentos de gestión, académicos o planes de proyecto.
// Ningún documento operativo de cumplimiento real (política, RAT, contrato) los contiene
// como vocabulario principal sin declaraciones en primera persona.
const MARCADORES_PROYECTO_O_GESTION = [
  'plan maestro', 'cronograma', 'etapa', 'hito',
  'análisis de cumplimiento', 'gestión de proyecto', 'equipo de proyecto',
  'diagnóstico de cumplimiento', 'brecha de cumplimiento',
  'taller integrador', 'instituto profesional', 'vicerrectoría académica',
  'asignatura', 'docente', 'carta gantt', 'malla pert', 'edt / wbs',
  'diccionario wbs', 'criterios de éxito', 'evaluación smart',
];

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
  // Se combinan los marcadores Tier 2 específicos del requisito con los marcadores
  // universales de planes de proyectos e informes académicos.
  const tier2Combinados = Array.from(new Set([
    ...config.marcadoresNormativos.tier2,
    ...MARCADORES_PROYECTO_O_GESTION,
  ]));
  const normativosTier2 = tier2Combinados.filter(m =>
    texto.includes(m.toLowerCase())
  );

  const nPerf = performativosEncontrados.length;
  const nT1   = normativosTier1.length;
  const nT2   = normativosTier2.length;

  let tipo: 'correcto' | 'dudoso' | 'incorrecto';
  let razon: string;

  if (nPerf >= 1) {
    if (nT2 >= 3 && nT2 > nPerf * 2) {
      tipo  = 'incorrecto';
      razon = `El documento contiene vocabulario predominante de gestión o proyecto (${nT2} marcadores: ${normativosTier2.slice(0, 3).join(', ')}), lo que indica que es un informe o plan y no el documento operativo.`;
    } else if (nT1 >= nPerf * 3) {
      tipo  = 'dudoso';
      razon = `Señales mixtas: ${nPerf} performativo${nPerf > 1 ? 's' : ''} pero ${nT1} marcador${nT1 > 1 ? 'es' : ''} normativos Tier 1 — posible documento híbrido.`;
    } else {
      tipo  = 'correcto';
      razon = `Documento con voz performativa (${nPerf} marcador${nPerf > 1 ? 'es' : ''} encontrado${nPerf > 1 ? 's' : ''}).`;
    }
  } else if (nT1 >= 2) {
    tipo  = 'incorrecto';
    razon = `El documento usa lenguaje normativo (${nT1} marcadores Tier 1: describe lo que "la ley exige" o "el responsable debe") sin declarar cumplimiento en primera persona.`;
  } else if (nT1 === 1 && nT2 >= 2) {
    tipo  = 'incorrecto';
    razon = `Lenguaje normativo combinado con vocabulario de gestión/consultoría (${nT1} Tier 1 + ${nT2} Tier 2).`;
  } else if (nT2 >= 3) {
    tipo  = 'incorrecto';
    razon = `Vocabulario específico de documentos de gestión/proyecto (${nT2} marcadores Tier 2: ${normativosTier2.slice(0, 3).join(', ')}) sin ningún marcador performativo.`;
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
  kwsEnContextoNormativo: string[];
  sinonimosValidos: string[];
  densidad: number;
  densidadRelativa?: number;
  proximidad: boolean;
  requiereRevisionManual: boolean;
  status: 'ok' | 'warn' | 'fail';
  confianza: 'alta' | 'media' | 'baja';
  fragmento: string;
}

// Ventana en palabras para considerar un keyword como "en contexto normativo"
const VENTANA_NORMATIVA = 8;

function enContextoNormativo(palabras: string[], kw: string): boolean {
  const posicionesKw = encontrarPosiciones(palabras, kw);
  if (posicionesKw.length === 0) return false;
  for (const marker of MARCADORES_CONTEXTO_NORMATIVO) {
    const posicionesMarker = encontrarPosiciones(palabras, marker);
    for (const posKw of posicionesKw) {
      for (const posMarker of posicionesMarker) {
        if (Math.abs(posKw - posMarker) <= VENTANA_NORMATIVA) return true;
      }
    }
  }
  return false;
}

/**
 * Evalúa un criterio individual contra el texto del documento.
 * Aplica detección de negaciones, proximidad, densidad y frases legales exactas.
 */
export function evaluarCriterio(
  texto: string,
  palabras: string[],
  keywords: string[],
  synonyms: string[],
  frasesLegales: string[],
  wordCount?: number,
): EvaluacionCriterio {

  // ── 1. Frases legales exactas ──────────────────────────────────────────
  const frasesEncontradas = buscarFrasesExactas(texto, frasesLegales);

  // ── 2. Keywords: separar válidas de negadas ────────────────────────────
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
        break;
      }
    }

    if (hayValida) kwsValidas.push(kw);
    else if (hayNegada) kwsNegadas.push(kw);
  }

  // ── Cambio 4: detectar keywords en contexto normativo ─────────────────
  // Un keyword válido que aparece junto a "la ley", "según el", etc. es
  // probable que esté en una oración descriptiva, no performativa.
  const kwsEnContextoNormativo = kwsValidas.filter(kw => enContextoNormativo(palabras, kw));

  // ── 3. Sinónimos (solo cuando no hay evidencia primaria) ───────────────
  const sinonimosValidos: string[] = [];
  if (kwsValidas.length === 0 && frasesEncontradas.length === 0) {
    for (const syn of synonyms) {
      const posiciones = encontrarPosiciones(palabras, syn);
      const valido = posiciones.some(pos => !detectarNegacion(palabras, pos));
      if (valido) sinonimosValidos.push(syn);
    }
  }

  // ── 4. Densidad de menciones ───────────────────────────────────────────
  const densidad = calcularDensidad(texto, [...keywords, ...frasesLegales]);

  // ── Cambio 3: densidad relativa al tamaño del documento ───────────────
  const densidadRelativa = wordCount && wordCount > 0
    ? densidad * 1000 / wordCount
    : undefined;

  // ── 5. Proximidad de conceptos ─────────────────────────────────────────
  const terminosPositivos = [...kwsValidas, ...frasesEncontradas];
  const proximidad = terminosPositivos.length >= 2
    ? calcularProximidad(palabras, terminosPositivos)
    : false;

  // ── 6. ¿Requiere revisión manual? ─────────────────────────────────────
  const requiereRevisionManual =
    kwsNegadas.length > 0 &&
    kwsValidas.length === 0 &&
    frasesEncontradas.length === 0 &&
    sinonimosValidos.length === 0;

  // ── 7. Determinar status (Cambio 2 aplicado) ──────────────────────────
  // Cambio 2: frase legal SOLA ya no alcanza para 'ok'; requiere frase + kw.
  const umbralOk = Math.max(1, Math.ceil(keywords.length * 0.6));
  let status: 'ok' | 'warn' | 'fail';

  if ((frasesEncontradas.length > 0 && kwsValidas.length >= 1) || kwsValidas.length >= umbralOk) {
    status = 'ok';
  } else if (frasesEncontradas.length > 0 || kwsValidas.length > 0 || sinonimosValidos.length > 0 || requiereRevisionManual) {
    status = 'warn';
  } else {
    status = 'fail';
  }

  // ── 8. Determinar confianza ────────────────────────────────────────────
  let confianza: 'alta' | 'media' | 'baja';

  if (frasesEncontradas.length > 0 && kwsValidas.length >= 1) {
    // Frase + keyword: señal fuerte, confianza alta incondicional
    confianza = 'alta';
  } else if (frasesEncontradas.length > 0 && kwsValidas.length === 0) {
    // Cambio 2: frase sola sin keywords → warn pero confianza alta (señal semántica exacta)
    confianza = 'alta';
  } else if (kwsValidas.length >= umbralOk && (densidad > UMBRAL_DENSIDAD_ALTA || proximidad)) {
    confianza = 'alta';
  } else if (kwsValidas.length > 0) {
    confianza = 'media';
  } else if (sinonimosValidos.length > 0) {
    confianza = 'media';
  } else {
    confianza = 'baja';
  }

  if (requiereRevisionManual && confianza === 'alta') confianza = 'media';

  // Cambio 3: densidad relativa baja → reducir confianza, pero solo cuando NO hay frase legal.
  // Frase+kw (o frase sola) ya implica lenguaje jurídico exacto; penalizar densidad en ese
  // caso viola la tabla del spec (frase+kw → confianza 'alta' incondicional).
  if (densidadRelativa !== undefined && densidadRelativa < 1.0 && confianza === 'alta' && frasesEncontradas.length === 0) {
    confianza = 'media';
  }

  // Cambio 4: mayoría de kws en contexto normativo → reducir confianza
  if (kwsEnContextoNormativo.length > kwsValidas.length / 2 && confianza === 'alta') {
    confianza = 'media';
  }

  // ── 9. Fragmento exacto del documento ─────────────────────────────────
  const terminoClave = frasesEncontradas[0] ?? kwsValidas[0] ?? sinonimosValidos[0] ?? null;
  const fragmento = terminoClave ? extraerFragmento(texto, terminoClave) : '';

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
        kwsEnContextoNormativo: [],
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
        kwsEnContextoNormativo: [],
        fragmentoDocumento: '',
      })),
      gap: `El archivo "${doc.name}" parece ser un PDF escaneado o una imagen. No es posible extraer su texto para verificar el cumplimiento. Súbalo como PDF con texto seleccionable, Word o TXT.`,
    };
  }

  // Documento rehidratado desde backend sin texto en memoria
  if (doc.pending) {
    return {
      estado: 'pending',
      cobertura: 0,
      criterios: req.criterios.map(c => ({
        name: c.name,
        status: 'fail',
        found: 'Documento registrado en el servidor — re-suba para nuevo análisis',
        kwFound: 0,
        kwTotal: c.keywords.length,
        confianza: 'baja',
        validado: c.validado,
        negaciones: [],
        frasesLegalesEncontradas: [],
        requiereRevisionManual: false,
        densidad: 0,
        kwsEnContextoNormativo: [],
        fragmentoDocumento: '',
      })),
      gap: `El documento "${doc.name}" está registrado en el servidor. Puede volver a subirlo localmente para ejecutar un nuevo diagnóstico.`,
    };
  }

  const texto = doc.text.toLowerCase();
  const palabras = texto.split(/\s+/);

  // ── Clasificación del tipo de documento ──────────────────────────────────
  // Paso previo: verificar que el documento ES del tipo esperado (no habla SOBRE él).
  const clasificacionDocumento = clasificarDocumento(req.clasificacion, texto);

  if (clasificacionDocumento.tipo === 'incorrecto') {
    return {
      estado: 'wrong_type',
      cobertura: 0,
      criterios: req.criterios.map(c => ({
        name: c.name,
        status: 'fail',
        found: 'Tipo de documento incorrecto — no se evaluó el contenido',
        kwFound: 0,
        kwTotal: c.keywords.length,
        confianza: 'baja',
        validado: c.validado,
        negaciones: [],
        frasesLegalesEncontradas: [],
        requiereRevisionManual: false,
        densidad: 0,
        kwsEnContextoNormativo: [],
        fragmentoDocumento: '',
      })),
      gap: `El documento "${doc.name}" no parece ser un(a) ${req.nombre.toLowerCase()}. ${clasificacionDocumento.razon}`,
      clasificacionDocumento,
    };
  }

  const criterios: CriterioResult[] = req.criterios.map(c => {
    const ev = evaluarCriterio(texto, palabras, c.keywords, c.synonyms, c.frasesLegales, doc.wordCount);

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
      kwsEnContextoNormativo: ev.kwsEnContextoNormativo,
      densidadRelativa: ev.densidadRelativa,
      fragmentoDocumento: ev.fragmento,
    };
  });

  const resultado = buildRequisitoResult(req, criterios, doc);

  // Dudoso → cap: si el motor dice 'green', lo baja a 'yellow' (revisión recomendada).
  const estadoFinal = clasificacionDocumento.tipo === 'dudoso' && resultado.estado === 'green'
    ? 'yellow'
    : resultado.estado;

  let gapFinal = resultado.gap;
  if (clasificacionDocumento.tipo === 'dudoso' && resultado.estado === 'green') {
    gapFinal = `Cumplimiento de criterios (${resultado.cobertura}%), pero se mantiene en revisión preventiva: ${clasificacionDocumento.razon}`;
  }

  return { ...resultado, estado: estadoFinal, gap: gapFinal, clasificacionDocumento };
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
  // La capa semántica nunca puede, por sí sola, llevar un requisito a "Cumple":
  // sus coincidencias valen 0.5 en la cobertura (status 'warn'), así que sin
  // este freno un requisito podría cruzar el 75% solo con similitudes coseno
  // sin validar. Si hay cualquier criterio de origen semántico, el resultado se
  // queda como máximo en 'yellow' (revisión pendiente), sin importar la cobertura.
  const tieneEvidenciaSemantica = criterios.some(c => c.origenDeteccion === 'semantico');

  let estado: 'green' | 'yellow' | 'red';
  let gap: string;

  if (cobertura >= 75 && !tieneEvidenciaSemantica) {
    estado = 'green';
    const warnItems = criterios.filter(c => c.status === 'warn');
    gap = warnItems.length > 0
      ? `Documento en cumplimiento (${cobertura}%). Puede reforzar: ${warnItems.map(c => c.name).slice(0, 2).join(', ')}.`
      : `Su documento cumple todos los criterios del ${req.art}.`;
  } else if (cobertura >= 35) {
    estado = 'yellow';
    const faltantes = criterios.filter(c => c.status !== 'ok').map(c => c.name).slice(0, 3);
    gap = `Cumplimiento parcial (${cobertura}%) del ${req.art}. Debe agregar o corregir: ${faltantes.join(', ')}.`;
    if (tieneEvidenciaSemantica && cobertura >= 75) {
      // Alcanzó el umbral de "verde" pero parte de la evidencia es una coincidencia
      // semántica sin confirmar por reglas — nunca se sube a "Cumple" solo por eso.
      const criteriosSemanticos = criterios.filter(c => c.origenDeteccion === 'semantico').map(c => c.name);
      gap = `Cumplimiento aparente (${cobertura}%) del ${req.art}, pero se mantiene en revisión porque incluye coincidencias semánticas sin validar en: ${criteriosSemanticos.join(', ')}. Requiere validación legal antes de considerarse cumplido.`;
    }
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
