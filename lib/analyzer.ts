import { REQUISITOS } from './requisitos';
import type { UploadedDoc, RequisitoResult, CriterioResult } from './types';

export function analyzeDocument(
  reqId: string,
  uploadedDocs: Record<string, UploadedDoc>
): RequisitoResult {
  const req = REQUISITOS.find(r => r.id === reqId)!;
  const doc = uploadedDocs[reqId];

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
      })),
      gap: `Documento obligatorio según ${req.art}. Sin este documento su empresa queda expuesta a multas de ${req.multa}.`,
    };
  }

  // Documento escaneado: no se puede analizar el contenido
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
      })),
      gap: `El archivo "${doc.name}" parece ser un PDF escaneado o una imagen. No es posible extraer su texto para verificar el cumplimiento. Súbalo como PDF con texto seleccionable, Word o TXT.`,
    };
  }

  const text = doc.text.toLowerCase();

  const criterios: CriterioResult[] = req.criterios.map(c => {
    // Paso 1: buscar keywords exactas
    const kwFoundList = c.keywords.filter(kw => text.includes(kw.toLowerCase()));

    // Paso 2: si no hay keywords, buscar sinónimos
    const synFoundList = kwFoundList.length === 0
      ? c.synonyms.filter(syn => text.includes(syn.toLowerCase()))
      : [];

    // Determinar confianza y kwFound efectivo
    let confianza: 'alta' | 'media' | 'baja';
    let kwFound: number;

    if (kwFoundList.length > 0) {
      confianza = 'alta';
      kwFound = kwFoundList.length;
    } else if (synFoundList.length > 0) {
      // Sinónimo encontrado: crédito parcial mínimo para cobertura
      confianza = 'media';
      kwFound = 1;
    } else {
      confianza = 'baja';
      kwFound = 0;
    }

    const ratio = kwFound / c.keywords.length;

    let status: 'ok' | 'warn' | 'fail';
    let found: string;

    if (ratio >= 0.6) {
      status = 'ok';
      found = `Cumple (${kwFound}/${c.keywords.length} términos)`;
    } else if (ratio >= 0.2 || confianza === 'media') {
      status = 'warn';
      found = confianza === 'media'
        ? `Sinónimo: "${synFoundList.slice(0, 2).join('", "')}"`
        : `Parcial (${kwFound}/${c.keywords.length} términos)`;
    } else {
      status = 'fail';
      found = kwFound > 0
        ? `Insuficiente (${kwFound}/${c.keywords.length} términos)`
        : 'No encontrado en el documento';
    }

    return {
      name: c.name,
      status,
      found,
      kwFound,
      kwTotal: c.keywords.length,
      confianza,
      validado: c.validado,
    };
  });

  // Score: ok=1.0, warn=0.5, fail=0.0
  const score = criterios.reduce((acc, c) => {
    if (c.status === 'ok') return acc + 1;
    if (c.status === 'warn') return acc + 0.5;
    return acc;
  }, 0);
  const cobertura = Math.round((score / criterios.length) * 100);

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
    const palabras = doc.wordCount ?? 0;
    const extraInfo = palabras < 50 && doc.extractedFully
      ? ` El documento parece muy breve (${palabras} palabras) para cubrir todos los requisitos legales.`
      : '';
    gap = `Documento insuficiente para ${req.art}. Criterios faltantes: ${criticos.join(', ')}. Riesgo de multa: ${req.multa}.${extraInfo}`;
  }

  return { estado, cobertura, criterios, gap };
}
