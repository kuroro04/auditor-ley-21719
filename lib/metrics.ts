import { REQUISITOS } from './requisitos';
import type { RequisitoResult } from './types';

// Calcula el porcentaje de cumplimiento global sobre los requisitos analizables.
// Ponderación: verde=100%, amarillo=50%, rojo=0%.
// Los estados unanalyzable, wrong_type y pending quedan fuera del denominador:
// ninguno de los tres representa un veredicto real sobre el requisito.
export function calcPct(results: Record<string, RequisitoResult>): {
  pct: number;
  green: number;
  yellow: number;
  red: number;
  unanalyzable: number;
  wrong_type: number;
  pending: number;
  analyzable: number;
} {
  const unanalyzable = REQUISITOS.filter(r => results[r.id]?.estado === 'unanalyzable').length;
  const wrong_type   = REQUISITOS.filter(r => results[r.id]?.estado === 'wrong_type').length;
  const pending      = REQUISITOS.filter(r => results[r.id]?.estado === 'pending').length;
  const analyzable   = REQUISITOS.length - unanalyzable - wrong_type - pending;
  const green        = REQUISITOS.filter(r => results[r.id]?.estado === 'green').length;
  const yellow       = REQUISITOS.filter(r => results[r.id]?.estado === 'yellow').length;
  const red          = REQUISITOS.filter(r => results[r.id]?.estado === 'red').length;
  const pct = analyzable > 0
    ? Math.round((green * 100 + yellow * 50) / (analyzable * 100) * 100)
    : 0;
  return { pct, green, yellow, red, unanalyzable, wrong_type, pending, analyzable };
}
