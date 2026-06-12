import { REQUISITOS } from './requisitos';
import type { RequisitoResult } from './types';

// Calcula el porcentaje de cumplimiento global sobre los requisitos analizables.
// Ponderación: verde=100%, amarillo=50%, rojo/no-analizable=0%.
export function calcPct(results: Record<string, RequisitoResult>): {
  pct: number;
  green: number;
  yellow: number;
  red: number;
  unanalyzable: number;
  analyzable: number;
} {
  const unanalyzable = REQUISITOS.filter(r => results[r.id]?.estado === 'unanalyzable').length;
  const analyzable   = REQUISITOS.length - unanalyzable;
  const green        = REQUISITOS.filter(r => results[r.id]?.estado === 'green').length;
  const yellow       = REQUISITOS.filter(r => results[r.id]?.estado === 'yellow').length;
  const red          = REQUISITOS.filter(r => results[r.id]?.estado === 'red').length;
  const pct = analyzable > 0
    ? Math.round((green * 100 + yellow * 50) / (analyzable * 100) * 100)
    : 0;
  return { pct, green, yellow, red, unanalyzable, analyzable };
}
