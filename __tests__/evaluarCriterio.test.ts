import { describe, it, expect } from 'vitest';
import { evaluarCriterio } from '../lib/analyzer';

function ctx(text: string) {
  const texto = text.toLowerCase();
  return { texto, palabras: texto.split(/\s+/) };
}

// ─── Cambio 2: frase legal sola → warn; frase + keyword → ok ─────────────

describe('evaluarCriterio — Cambio 2', () => {
  it('frase legal sin keywords válidos → warn (no ok)', () => {
    const { texto, palabras } = ctx('Período de guarda cumplido legalmente.');
    const ev = evaluarCriterio(texto, palabras, ['conservación', 'retención'], [], ['período de guarda']);
    expect(ev.frasesEncontradas.length).toBeGreaterThan(0);
    expect(ev.kwsValidas.length).toBe(0);
    expect(ev.status).toBe('warn');
    // Hallazgo 5: spec dice confianza='alta' para frase sola sin keywords
    expect(ev.confianza).toBe('alta');
  });

  it('frase legal + al menos un keyword → ok', () => {
    const { texto, palabras } = ctx('Período de guarda de conservación de datos.');
    const ev = evaluarCriterio(texto, palabras, ['conservación', 'retención'], [], ['período de guarda']);
    expect(ev.frasesEncontradas.length).toBeGreaterThan(0);
    expect(ev.kwsValidas.length).toBeGreaterThan(0);
    expect(ev.status).toBe('ok');
  });

  it('keywords ≥ umbralOk sin frase → ok (sin cambio respecto a comportamiento anterior)', () => {
    // umbralOk = ceil(5 * 0.6) = 3
    const { texto, palabras } = ctx('conservación retención plazo tiempo eliminar datos');
    const ev = evaluarCriterio(texto, palabras, ['conservación', 'retención', 'plazo', 'tiempo', 'eliminar'], [], []);
    expect(ev.status).toBe('ok');
  });
});

// ─── Cambio 3: densidadRelativa ──────────────────────────────────────────

describe('evaluarCriterio — Cambio 3', () => {
  it('densidadRelativa se incluye en resultado cuando wordCount > 0', () => {
    const { texto, palabras } = ctx('conservación retención plazo');
    const ev = evaluarCriterio(texto, palabras, ['conservación', 'retención', 'plazo'], [], [], 100);
    expect(ev.densidadRelativa).toBeDefined();
    // densidad ≈ 3 hits, wordCount=100 → densidadRelativa = 30
    expect(ev.densidadRelativa!).toBeGreaterThan(0);
  });

  it('densidadRelativa undefined cuando no se pasa wordCount', () => {
    const { texto, palabras } = ctx('conservación datos');
    const ev = evaluarCriterio(texto, palabras, ['conservación'], [], []);
    expect(ev.densidadRelativa).toBeUndefined();
  });

  it('confianza baja de alta a media cuando densidadRelativa < 1.0 (solo keywords, sin frase)', () => {
    // Setup: 3 keywords in proximity → confianza='alta' sin Cambio 3
    // wordCount=10000 → densidadRelativa ≈ 3*1000/10000 = 0.3 < 1.0 → alta→media
    const { texto, palabras } = ctx('conservación retención plazo mas texto');
    const ev = evaluarCriterio(
      texto, palabras,
      ['conservación', 'retención', 'plazo'],
      [], [],
      10000,
    );
    // densidadRelativa = (densidad)*1000/10000 < 1.0 → confianza reducida
    expect(ev.densidadRelativa).toBeDefined();
    expect(ev.densidadRelativa!).toBeLessThan(1.0);
    expect(ev.confianza).not.toBe('alta');
  });

  it('confianza permanece alta cuando hay frase legal aunque densidadRelativa < 1.0', () => {
    // Hallazgo 7: Cambio 3 solo aplica "cuando solo hay keywords sin frase"
    // frase + kw en doc largo → alta, NO media
    const { texto, palabras } = ctx('período de guarda cumplido conservación de datos');
    const ev = evaluarCriterio(
      texto, palabras,
      ['conservación', 'retención'],
      [],
      ['período de guarda'],
      10000,
    );
    expect(ev.frasesEncontradas.length).toBeGreaterThan(0);
    expect(ev.kwsValidas.length).toBeGreaterThan(0);
    expect(ev.densidadRelativa!).toBeLessThan(1.0);
    // Spec: frase+kw → confianza 'alta' incondicional (no penalizar por densidad)
    expect(ev.confianza).toBe('alta');
  });
});

// ─── Cambio 4: kwsEnContextoNormativo ─────────────────────────────────

describe('evaluarCriterio — Cambio 4', () => {
  it('resultado incluye kwsEnContextoNormativo como array', () => {
    const { texto, palabras } = ctx('conservación de datos del responsable');
    const ev = evaluarCriterio(texto, palabras, ['conservación'], [], []);
    expect(Array.isArray(ev.kwsEnContextoNormativo)).toBe(true);
  });

  it('keyword dentro de ventana de 8 palabras de un marcador normativo → en kwsEnContextoNormativo', () => {
    // "la ley" (marcador) + 2 palabras + "conservación" (keyword)
    const { texto, palabras } = ctx('la ley exige conservación de datos personales siempre');
    const ev = evaluarCriterio(texto, palabras, ['conservación'], [], []);
    expect(ev.kwsEnContextoNormativo).toContain('conservación');
  });

  it('keyword a más de 8 palabras de marcadores normativos → NO en kwsEnContextoNormativo', () => {
    // "la ley" at start, then 9+ filler words, then "conservación"
    const { texto, palabras } = ctx('la ley aplica en este caso y aquí también finalmente conservación');
    // la(0) ley(1) aplica(2) en(3) este(4) caso(5) y(6) aquí(7) también(8) finalmente(9) conservación(10)
    // "la ley" at position 0, "conservación" at position 10 → distance=10 > 8
    const ev = evaluarCriterio(texto, palabras, ['conservación'], [], []);
    expect(ev.kwsEnContextoNormativo).not.toContain('conservación');
  });

  it('confianza baja de alta a media cuando mayoría de kws está en contexto normativo', () => {
    // "la ley exige conservación retención plazo" → all 3 kws within 8 words of "la ley"
    const { texto, palabras } = ctx('la ley exige conservación retención plazo de datos');
    // umbralOk = ceil(4 * 0.6) = 3; kws: ['conservación','retención','plazo','eliminar']
    // kwsValidas = ['conservación','retención','plazo'] (3 ≥ umbralOk → ok)
    // All 3 are within 8 words of "la ley" → kwsEnContextoNormativo.length(3) > kwsValidas.length(3)/2 = 1.5 → true
    const ev = evaluarCriterio(
      texto, palabras,
      ['conservación', 'retención', 'plazo', 'eliminar'],
      [], [],
      100,
    );
    expect(ev.kwsEnContextoNormativo.length).toBeGreaterThan(ev.kwsValidas.length / 2);
    expect(ev.confianza).not.toBe('alta');
  });
});
