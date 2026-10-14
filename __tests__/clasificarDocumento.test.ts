import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { clasificarDocumento } from '../lib/analyzer';
import { REQUISITOS } from '../lib/requisitos';

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8').toLowerCase();
}

const configPP = REQUISITOS.find(r => r.id === 'politica_privacidad')!.clasificacion;

describe('clasificarDocumento — politica_privacidad', () => {
  it('F1 Plan Maestro → incorrecto (0 performativos, ≥3 tier2)', () => {
    const texto = loadFixture('plan-maestro-proyecto.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.tipo).toBe('incorrecto');
    expect(res.performativosEncontrados).toHaveLength(0);
  });

  it('F2 Centro Médico → correcto (tiene performativos)', () => {
    const texto = loadFixture('politica-privacidad-completa.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.tipo).toBe('correcto');
    expect(res.performativosEncontrados.length).toBeGreaterThan(0);
  });

  it('F3 Escuela de Seguros → correcto (tiene performativos)', () => {
    const texto = loadFixture('politica-privacidad-concisa.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.tipo).toBe('correcto');
  });

  it('F4 Cencosud (tercera persona) → correcto (performativos de tercera persona formal)', () => {
    const texto = loadFixture('politica-tercera-persona.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.tipo).toBe('correcto');
    const marcadoresTerceraPersona = [
      'el usuario podrá', 'el usuario tendrá', 'representante legal corresponde',
      'conservará los datos', 'consiente expresamente',
    ];
    const encontrados = res.performativosEncontrados.filter(m =>
      marcadoresTerceraPersona.includes(m)
    );
    expect(encontrados.length).toBeGreaterThan(0);
  });

  it('F5 Artículo de blog → incorrecto (0 performativos)', () => {
    const texto = loadFixture('articulo-sobre-la-ley.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.tipo).toBe('incorrecto');
    expect(res.performativosEncontrados).toHaveLength(0);
  });

  it('razon explica la clasificación y no está vacía', () => {
    const texto = loadFixture('plan-maestro-proyecto.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(res.razon.length).toBeGreaterThan(10);
  });

  it('resultado incluye normativosEncontrados como array', () => {
    const texto = loadFixture('plan-maestro-proyecto.txt');
    const res = clasificarDocumento(configPP, texto);
    expect(Array.isArray(res.normativosEncontrados)).toBe(true);
  });
});
