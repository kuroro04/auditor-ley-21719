import { describe, it, expect } from 'vitest';
import { REQUISITOS } from '@/lib/requisitos';
import { calcPct } from '@/lib/metrics';
import type { RequisitoResult } from '@/lib/types';

function makeCriterio(name: string, status: 'ok' | 'warn' | 'fail', found = 'Encontrado'): import('@/lib/types').CriterioResult {
  return {
    name,
    status,
    found,
    kwFound: status === 'ok' ? 3 : status === 'warn' ? 1 : 0,
    kwTotal: 3,
    confianza: status === 'ok' ? 'alta' : status === 'warn' ? 'media' : 'baja',
    validado: status === 'ok',
    negaciones: [],
    frasesLegalesEncontradas: [],
    requiereRevisionManual: status === 'warn',
    densidad: 1,
    origenDeteccion: 'reglas',
    kwsEnContextoNormativo: [],
    fragmentoDocumento: found,
  };
}

describe('Opción 3: Lógica del Tablero de Subsanación y Comparador de Versiones', () => {
  const mockCurrent: Record<string, RequisitoResult> = {
    politica_privacidad: {
      estado: 'green',
      cobertura: 100,
      criterios: [
        makeCriterio('Identidad y contacto del responsable de datos', 'ok'),
        makeCriterio('Finalidad y propósito del tratamiento', 'ok'),
      ],
      gap: '',
    },
    consentimiento: {
      estado: 'yellow',
      cobertura: 60,
      criterios: [
        makeCriterio('Manifestación de voluntad libre e informada', 'ok'),
        makeCriterio('Finalidades específicas delimitadas', 'warn', 'Revisión requerida'),
      ],
      gap: 'Falta delimitar finalidades específicas',
    },
    procedimiento_arco: {
      estado: 'red',
      cobertura: 20,
      criterios: [
        makeCriterio('Canal formal para recibir solicitudes', 'fail', 'No encontrado'),
      ],
      gap: 'Documento faltante',
    },
  };

  const mockPrevious: Record<string, RequisitoResult> = {
    politica_privacidad: {
      estado: 'yellow',
      cobertura: 50,
      criterios: [
        makeCriterio('Identidad y contacto del responsable de datos', 'ok'),
        makeCriterio('Finalidad y propósito del tratamiento', 'fail', 'No encontrado'),
      ],
      gap: '',
    },
    consentimiento: {
      estado: 'red',
      cobertura: 0,
      criterios: [
        makeCriterio('Manifestación de voluntad libre e informada', 'fail', 'No encontrado'),
      ],
      gap: '',
    },
    procedimiento_arco: {
      estado: 'red',
      cobertura: 0,
      criterios: [
        makeCriterio('Canal formal para recibir solicitudes', 'fail', 'No encontrado'),
      ],
      gap: '',
    },
  };

  it('clasifica correctamente los requisitos en las 3 columnas del tablero', () => {
    const faltantes = REQUISITOS.filter(r => {
      const est = mockCurrent[r.id]?.estado;
      return est === 'red' || est === 'wrong_type' || est === 'unanalyzable' || !est;
    });

    const revision = REQUISITOS.filter(r => {
      const est = mockCurrent[r.id]?.estado;
      return est === 'yellow' || est === 'pending';
    });

    const cumplidos = REQUISITOS.filter(r => {
      const est = mockCurrent[r.id]?.estado;
      return est === 'green';
    });

    // politica_privacidad es verde
    expect(cumplidos.some(r => r.id === 'politica_privacidad')).toBe(true);
    // consentimiento es amarillo
    expect(revision.some(r => r.id === 'consentimiento')).toBe(true);
    // procedimiento_arco es rojo
    expect(faltantes.some(r => r.id === 'procedimiento_arco')).toBe(true);
    // La suma de todas las columnas cubre los 10 requisitos
    expect(faltantes.length + revision.length + cumplidos.length).toBe(REQUISITOS.length);
  });

  it('calcula la evolución delta entre versiones en el comparador', () => {
    const currStats = calcPct(mockCurrent);
    const prevStats = calcPct(mockPrevious);

    const deltaPct = currStats.pct - prevStats.pct;
    // Hubo progreso positivo
    expect(deltaPct).toBeGreaterThan(0);

    // En política de privacidad mejoró de 50 a 100 (+50%)
    const deltaPol = mockCurrent.politica_privacidad.cobertura - mockPrevious.politica_privacidad.cobertura;
    expect(deltaPol).toBe(50);

    // Detecta el criterio subsanado que pasó de fail/warn a ok
    const subsanados = mockCurrent.politica_privacidad.criterios.filter((c, i) =>
      mockPrevious.politica_privacidad.criterios[i] &&
      (mockPrevious.politica_privacidad.criterios[i].status === 'fail' || mockPrevious.politica_privacidad.criterios[i].status === 'warn') &&
      c.status === 'ok'
    );
    expect(subsanados.length).toBe(1);
    expect(subsanados[0].name).toBe('Finalidad y propósito del tratamiento');
  });

  it('filtra requisitos por texto en búsqueda insensible a mayúsculas', () => {
    const buscar = (query: string) => {
      const term = query.toLowerCase();
      return REQUISITOS.filter(r =>
        r.nombre.toLowerCase().includes(term) || r.art.toLowerCase().includes(term)
      );
    };

    const resPrivacidad = buscar('privacidad');
    expect(resPrivacidad.some(r => r.id === 'politica_privacidad')).toBe(true);

    const resArt14 = buscar('art. 14');
    expect(resArt14.some(r => r.id === 'politica_privacidad')).toBe(true);
  });
});
