import { describe, it, expect } from 'vitest';
import { calcPct } from '../lib/metrics';
import { REQUISITOS } from '../lib/requisitos';
import type { RequisitoResult } from '../lib/types';

function req(estado: RequisitoResult['estado']): RequisitoResult {
  return { estado, cobertura: 0, criterios: [], gap: '' };
}

// Construye un mapa de resultados donde todos los requisitos tienen el mismo estado.
function allReq(estado: RequisitoResult['estado']): Record<string, RequisitoResult> {
  return Object.fromEntries(REQUISITOS.map(r => [r.id, req(estado)]));
}

describe('calcPct', () => {
  it('pct=100 cuando todos los requisitos son green', () => {
    const { pct } = calcPct(allReq('green'));
    expect(pct).toBe(100);
  });

  it('pct=0 cuando todos son red', () => {
    const { pct } = calcPct(allReq('red'));
    expect(pct).toBe(0);
  });

  it('analyzable + unanalyzable + wrong_type + pending == REQUISITOS.length', () => {
    const results = allReq('red');
    results[REQUISITOS[0].id] = req('unanalyzable');
    results[REQUISITOS[1].id] = req('wrong_type');
    results[REQUISITOS[2].id] = req('pending');
    const { analyzable, unanalyzable, wrong_type, pending } = calcPct(results);
    expect(analyzable + unanalyzable + wrong_type + pending).toBe(REQUISITOS.length);
  });

  it('wrong_type no infla el denominador (SEC-15)', () => {
    // Todos red → baseline de analyzable == REQUISITOS.length.
    // Convertir uno a wrong_type debe restar 1 de analyzable, no dejarlo igual.
    const base = calcPct(allReq('red')).analyzable;
    const results = allReq('red');
    results[REQUISITOS[0].id] = req('wrong_type');
    const { analyzable, wrong_type } = calcPct(results);
    expect(wrong_type).toBe(1);
    expect(analyzable).toBe(base - 1);
  });

  it('pending no infla el denominador', () => {
    const base = calcPct(allReq('red')).analyzable;
    const results = allReq('red');
    results[REQUISITOS[0].id] = req('pending');
    const { analyzable, pending } = calcPct(results);
    expect(pending).toBe(1);
    expect(analyzable).toBe(base - 1);
  });

  it('pct=0 cuando todos son no analizables (analyzable==0)', () => {
    const results = allReq('unanalyzable');
    const { pct, analyzable } = calcPct(results);
    expect(analyzable).toBe(0);
    expect(pct).toBe(0);
  });
});
