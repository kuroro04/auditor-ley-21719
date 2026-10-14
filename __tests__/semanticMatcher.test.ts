import { describe, it, expect } from 'vitest';
import {
  splitParagraphs,
  construirTextoConceptoCriterio,
  enriquecerConSemantica,
  UMBRAL_SIMILITUD_SEMANTICA,
} from '../lib/semantic/semanticMatcher';
import type { Requisito, RequisitoResult, UploadedDoc } from '../lib/types';

function reqFixture(): Requisito {
  return {
    id: 'politica_privacidad',
    num: '01',
    nombre: 'Política de privacidad',
    art: 'Art. 14 — Deber de información',
    desc: '',
    multa: '500 UTM',
    nivel: 'medio',
    plazo: { date: 'Vigente', urgency: 'ok' },
    legalDetail: { articulo: '', documentoEvidencia: '', exigenciaSimple: '' },
    criterios: [
      {
        name: 'Plazo de conservación de los datos',
        keywords: ['conservación', 'retención', 'plazo', 'tiempo', 'eliminar'],
        synonyms: ['período de guarda'],
        frasesLegales: [],
        validado: true,
      },
    ],
    clasificacion: {
      marcadoresPerformativos: ['los datos se conservarán durante'],
      marcadoresNormativos: { tier1: ['la ley exige'], tier2: [] },
    },
  };
}

function criterioFixture(status: 'fail' | 'warn' | 'ok') {
  return {
    name: 'Plazo de conservación de los datos',
    status,
    found: status === 'fail' ? 'No encontrado en el documento' : 'Términos: "plazo"',
    kwFound: status === 'fail' ? 0 : 1,
    kwTotal: 5,
    confianza: status === 'ok' ? ('alta' as const) : status === 'warn' ? ('media' as const) : ('baja' as const),
    validado: true,
    negaciones: [],
    frasesLegalesEncontradas: [],
    requiereRevisionManual: false,
    densidad: status === 'fail' ? 0 : 1,
    kwsEnContextoNormativo: [],
    fragmentoDocumento: status === 'fail' ? '' : 'algo de contexto',
  };
}

function resultadoFixture(status: 'fail' | 'warn' | 'ok'): RequisitoResult {
  return {
    estado: status === 'ok' ? 'green' : 'red',
    cobertura: status === 'ok' ? 100 : 0,
    gap: '',
    criterios: [criterioFixture(status)],
  };
}

const doc: UploadedDoc = {
  name: 'test.txt',
  text: 'guardamos los datos hasta que el cliente solicite su baja.\notros textos irrelevantes sobre soporte técnico.',
  wordCount: 20,
  extractedFully: true,
};

// Extractor determinístico para test: el "concepto" del criterio de
// conservación es paralelo (similitud ~0.9) al párrafo que habla de guardar
// los datos hasta la baja del cliente, y ortogonal (similitud 0) a todo lo demás.
const extractorFalso = (textos: string[]): Promise<number[][]> =>
  Promise.resolve(textos.map(t => {
    if (t.includes('Plazo de conservación')) return [1, 0];
    if (t.includes('guardamos los datos hasta que el cliente solicite su baja')) return [0.9, Math.sqrt(1 - 0.81)];
    return [0, 1];
  }));

const extractorOrtogonal = (textos: string[]): Promise<number[][]> =>
  Promise.resolve(textos.map(t => (t.includes('Plazo de conservación') ? [1, 0] : [0, 1])));

describe('splitParagraphs', () => {
  it('separa por saltos de línea y descarta vacíos', () => {
    expect(splitParagraphs('uno\n\ndos\n   \ntres')).toEqual(['uno', 'dos', 'tres']);
  });

  it('parte bloques muy largos en fragmentos más chicos por oración', () => {
    const largo = 'a'.repeat(300) + '. ' + 'b'.repeat(300) + '.';
    const out = splitParagraphs(largo);
    expect(out.length).toBeGreaterThan(1);
  });
});

describe('construirTextoConceptoCriterio', () => {
  it('usa el nombre del criterio como texto del concepto', () => {
    const texto = construirTextoConceptoCriterio(reqFixture().criterios[0]);
    expect(texto).toBe('Plazo de conservación de los datos');
  });
});

describe('enriquecerConSemantica', () => {
  it('sube un criterio "fail" a "warn" cuando hay similitud semántica sobre el umbral', async () => {
    const req = reqFixture();
    const resultado = resultadoFixture('fail');
    const enriquecido = await enriquecerConSemantica(req, resultado, doc, extractorFalso);
    const c = enriquecido.criterios[0];

    expect(c.status).toBe('warn');
    expect(c.confianza).toBe('media');
    expect(c.origenDeteccion).toBe('semantico');
    expect(c.requiereRevisionManual).toBe(true);
    expect(c.coincidenciaSemantica?.similitud).toBeGreaterThanOrEqual(UMBRAL_SIMILITUD_SEMANTICA);
    expect(c.coincidenciaSemantica?.parrafo).toContain('guardamos los datos');
  });

  it('nunca sube un criterio a "ok"', async () => {
    const req = reqFixture();
    const resultado = resultadoFixture('fail');
    const enriquecido = await enriquecerConSemantica(req, resultado, doc, extractorFalso);
    expect(enriquecido.criterios[0].status).not.toBe('ok');
  });

  it('no promueve nada cuando la similitud está por debajo del umbral', async () => {
    const req = reqFixture();
    const resultado = resultadoFixture('fail');
    const enriquecido = await enriquecerConSemantica(req, resultado, doc, extractorOrtogonal);
    expect(enriquecido.criterios[0].status).toBe('fail');
    expect(enriquecido.criterios[0].origenDeteccion).toBeUndefined();
  });

  it('no toca criterios ya "ok"', async () => {
    const req = reqFixture();
    const resultado = resultadoFixture('ok');
    const enriquecido = await enriquecerConSemantica(req, resultado, doc, extractorFalso);
    expect(enriquecido.criterios[0]).toEqual(resultado.criterios[0]);
  });

  it('mantiene "warn" existente y solo adjunta evidencia semántica adicional, sin cambiar origenDeteccion', async () => {
    const req = reqFixture();
    const resultado = resultadoFixture('warn');
    const enriquecido = await enriquecerConSemantica(req, resultado, doc, extractorFalso);
    const c = enriquecido.criterios[0];
    expect(c.status).toBe('warn');
    expect(c.origenDeteccion).toBeUndefined();
    expect(c.coincidenciaSemantica).toBeDefined();
  });
});
