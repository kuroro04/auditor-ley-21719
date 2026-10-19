import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzeDocument } from '../lib/analyzer';
import type { UploadedDoc } from '../lib/types';

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

function makeDoc(text: string): Record<string, UploadedDoc> {
  const words = text.trim().split(/\s+/).length;
  return {
    politica_privacidad: {
      name: 'test.txt',
      text: text.toLowerCase(),
      wordCount: words,
      extractedFully: true,
    },
  };
}

// ── F2: Centro Médico Antofagasta ─────────────────────────────────────────────
describe('F2 — Centro Médico Antofagasta (vocabulario 19.628)', () => {
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    docs = makeDoc(loadFixture('politica-privacidad-completa.txt'));
  });

  it('criterio Base legal encuentra "base de licitud"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const baseLegal = res.criterios.find(c => c.name.includes('Base legal'));
    expect(baseLegal?.frasesLegalesEncontradas).toContain('base de licitud');
  });

  it('criterio Plazo encuentra "vigencia del tratamiento"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const plazo = res.criterios.find(c => c.name.includes('Plazo'));
    expect(plazo?.frasesLegalesEncontradas.some(f =>
      f.includes('vigencia') || f.includes('conservará')
    )).toBe(true);
  });

  it('estado global es green con vocabulario 19.628 expandido', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('green');
    expect(res.cobertura).toBeGreaterThanOrEqual(75);
  });
});

// ── F3: Escuela de Seguros ────────────────────────────────────────────────────
describe('F3 — Escuela de Seguros (formas verbales / infinitivos)', () => {
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    docs = makeDoc(loadFixture('politica-privacidad-concisa.txt'));
  });

  it('criterio ARCO encuentra frase de infinitivos "acceder, rectificar, cancelar u oponerse"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const arco = res.criterios.find(c => c.name.includes('ARCO'));
    expect(arco?.frasesLegalesEncontradas.some(f =>
      f.includes('acceder') || f.includes('rectificar')
    )).toBe(true);
  });

  it('criterio Base legal encuentra "bases de legitimación"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const base = res.criterios.find(c => c.name.includes('Base legal'));
    expect(base?.frasesLegalesEncontradas.some(f =>
      f.includes('bases de legitimación') || f.includes('consentimiento expreso')
    )).toBe(true);
  });

  it('criterio Plazo encuentra "durante el tiempo necesario"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const plazo = res.criterios.find(c => c.name.includes('Plazo'));
    expect(plazo?.frasesLegalesEncontradas).toContain('durante el tiempo necesario');
  });

  it('estado no es red (tiene evidencia suficiente)', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).not.toBe('red');
    expect(res.estado).not.toBe('wrong_type');
  });
});

// ── F4: Cencosud (tercera persona + conservará los datos) ─────────────────────
describe('F4 — Cencosud (frases de tercera persona + 19.628)', () => {
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    docs = makeDoc(loadFixture('politica-tercera-persona.txt'));
  });

  it('criterio Plazo encuentra "conservará los datos"', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const plazo = res.criterios.find(c => c.name.includes('Plazo'));
    expect(plazo?.frasesLegalesEncontradas).toContain('conservará los datos');
  });

  it('estado no es red ni wrong_type', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).not.toBe('red');
    expect(res.estado).not.toBe('wrong_type');
  });
});

// ── F5: Blog — gate bloquea antes de puntuar ──────────────────────────────────
describe('F5 — Blog: la clasificación impide puntuar aunque vocabulario aparezca', () => {
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    docs = makeDoc(loadFixture('articulo-sobre-la-ley.txt'));
  });

  it('estado es wrong_type (gate de clasificación activo)', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('wrong_type');
  });

  it('cobertura es 0 cuando wrong_type', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.cobertura).toBe(0);
  });
});
