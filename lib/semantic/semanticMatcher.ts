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
  // El nombre del criterio ya es una frase en lenguaje natural (ej. "Plazo de
  // conservación de los datos"). Concatenar keywords y sinónimos sueltos aquí
  // degrada la calidad del embedding con all-MiniLM-L6-v2 (modelo de sentence
  // embeddings, no bag-of-words): medido contra el modelo real, la version
  // "sopa de palabras" da menor similitud con párrafos relevantes que con
  // párrafos irrelevantes. Se mantiene la firma con keywords/synonyms por si
  // una futura mejora de calibración los necesita, pero hoy no se usan.
  return criterio.name;
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
