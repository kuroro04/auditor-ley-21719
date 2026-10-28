// @vitest-environment jsdom
//
// La capa semántica escribe sus resultados en segundo plano. Un resultado
// que termina después de que cambió la sesión o se lanzó un análisis nuevo
// debe descartarse: si no, datos de una empresa (o de un documento ya
// reemplazado) aparecen en el diagnóstico de otra sesión u otro análisis.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RequisitoResult, UploadedDoc } from '../lib/types';

interface Pendiente {
  reqId: string;
  docName: string;
  base: RequisitoResult;
  resolver: (r: RequisitoResult) => void;
}

const { pendientes } = vi.hoisted(() => ({ pendientes: [] as Pendiente[] }));

vi.mock('@/lib/semantic/semanticMatcher', () => ({
  enriquecerConSemantica: vi.fn(
    (req: { id: string }, base: RequisitoResult, doc: UploadedDoc) =>
      new Promise<RequisitoResult>(resolver => {
        pendientes.push({ reqId: req.id, docName: doc.name, base, resolver });
      }),
  ),
}));

import { useAppState } from '../hooks/useAppState';

const MARCA_OBSOLETA = 'RESULTADO-SEMANTICO-OBSOLETO';

function obsoleto(p: Pendiente): RequisitoResult {
  return { ...p.base, gap: MARCA_OBSOLETA };
}

// Deja correr las promesas resueltas y los setState que disparan.
async function flush() {
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}

function contieneMarcaObsoleta(results: Record<string, RequisitoResult>) {
  return Object.values(results).some(r => r.gap === MARCA_OBSOLETA);
}

beforeEach(() => {
  pendientes.length = 0;
});

describe('aislamiento de la capa semántica en segundo plano', () => {
  it('logout durante el análisis: el resultado semántico tardío se descarta', async () => {
    const { result } = renderHook(() => useAppState());

    act(() => result.current.demo('administrador'));
    await flush();
    expect(pendientes.length).toBeGreaterThan(0);

    await act(async () => { await result.current.logout(); });
    pendientes.forEach(p => p.resolver(obsoleto(p)));
    await flush();

    expect(result.current.results).toEqual({});
    // Tras invalidarse, el bucle no sigue enriqueciendo los demás requisitos.
    expect(pendientes).toHaveLength(1);
  });

  it('logout y nueva sesión: el resultado de la sesión anterior no contamina la nueva', async () => {
    const { result } = renderHook(() => useAppState());

    act(() => result.current.demo('administrador'));
    await flush();
    const deLaSesionAnterior = [...pendientes];

    await act(async () => { await result.current.logout(); });
    act(() => result.current.demo('auditor'));
    await flush();
    const resultadosNuevaSesion = result.current.results;

    deLaSesionAnterior.forEach(p => p.resolver(obsoleto(p)));
    await flush();

    expect(contieneMarcaObsoleta(result.current.results)).toBe(false);
    expect(result.current.results).toEqual(resultadosNuevaSesion);
  });

  it('reemplazo de documento con un análisis viejo en curso: gana el análisis nuevo', async () => {
    const { result } = renderHook(() => useAppState());

    act(() => result.current.demo('administrador'));
    await flush();
    const viejo = pendientes.find(p => p.reqId === 'politica_privacidad');
    expect(viejo?.docName).toBe('politica_privacidad_v2.pdf');

    const docNuevo: UploadedDoc = {
      name: 'politica_privacidad_v3.pdf',
      text: 'responsable finalidad consentimiento derechos plazo de conservación',
      wordCount: 7,
      extractedFully: true,
      extractMethod: 'PDF',
      scanned: false,
    };
    act(() => result.current.uploadDoc('politica_privacidad', docNuevo, 'administrador', 'Empresa Demo S.A.'));
    act(() => result.current.finishAnalysis('administrador', 'Empresa Demo S.A.'));
    await flush();
    const resultadoReglasNuevo = result.current.results.politica_privacidad;

    // Termina el enriquecimiento del análisis VIEJO (documento v2).
    viejo!.resolver(obsoleto(viejo!));
    await flush();
    expect(result.current.results.politica_privacidad).toEqual(resultadoReglasNuevo);
    expect(contieneMarcaObsoleta(result.current.results)).toBe(false);

    // El enriquecimiento del análisis vigente (documento v3) sí se aplica.
    const nuevo = pendientes.find(p => p.reqId === 'politica_privacidad' && p.docName === 'politica_privacidad_v3.pdf');
    expect(nuevo).toBeDefined();
    const enriquecido = { ...nuevo!.base, gap: 'enriquecido-vigente' };
    nuevo!.resolver(enriquecido);
    await flush();
    expect(result.current.results.politica_privacidad).toEqual(enriquecido);
  });
});
