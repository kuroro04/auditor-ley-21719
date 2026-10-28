/**
 * Corpus de regresión para clasificación de tipo de documento y endurecimiento
 * de evidencia (spec: docs/superpowers/specs/2026-10-13-clasificacion-tipo-documento-design.md)
 *
 * Estado de fixtures:
 *   plan-maestro-proyecto.txt          ✅ DISPONIBLE
 *   politica-privacidad-completa.txt   ✅ DISPONIBLE (Centro Médico Antofagasta)
 *   politica-privacidad-concisa.txt    ✅ DISPONIBLE (Escuela de Seguros)
 *   politica-tercera-persona.txt       ✅ DISPONIBLE (Cencosud/Jumbo)
 *   articulo-sobre-la-ley.txt          ✅ DISPONIBLE (blog normativo)
 *   rat-documento.txt                  ⏳ PENDIENTE
 *   contrato-con-clausula-privacy.txt  ⏳ PENDIENTE
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import { analyzeDocument } from '../lib/analyzer';
import type { UploadedDoc } from '../lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fixturesPath(name: string): string {
  return join(__dirname, 'fixtures', name);
}

function loadFixture(name: string): string {
  return readFileSync(fixturesPath(name), 'utf-8');
}

function fixtureExists(name: string): boolean {
  return existsSync(fixturesPath(name));
}

function docFrom(text: string, name = 'test.txt', reqId = 'politica_privacidad'): Record<string, UploadedDoc> {
  const words = text.trim().split(/\s+/).length;
  return {
    [reqId]: { name, text: text.toLowerCase(), wordCount: words, extractedFully: true },
  };
}

// ── FIXTURE 1: Plan Maestro de Gestión de Proyecto ───────────────────────────
// Documento real: 9.039 palabras. HABLA SOBRE la Ley 21.719, no es una política.
// Esperado: wrong_type (post-implementación) / actualmente: falso positivo verde/amarillo

describe('Fixture 1 — Plan Maestro (documento normativo/académico)', () => {
  let texto: string;
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    texto = loadFixture('plan-maestro-proyecto.txt');
    docs = docFrom(texto, 'DataShield_21719_Plan_Maestro_1.pdf');
  });

  it('[POST-IMPL] clasifica como wrong_type para politica_privacidad', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('wrong_type');
  });

  it('[POST-IMPL] clasifica como wrong_type para registro_actividades (y demás requisitos)', () => {
    const docsRAT = docFrom(texto, 'DataShield_21719_Plan_Maestro_1.pdf', 'registro_actividades');
    const res = analyzeDocument('registro_actividades', docsRAT);
    expect(res.estado).toBe('wrong_type');
    expect(res.cobertura).toBe(0);
    expect(res.clasificacionDocumento?.tipo).toBe('incorrecto');
  });

  it('[POST-IMPL] cobertura es 0 cuando wrong_type', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.cobertura).toBe(0);
  });

  it('[POST-IMPL] clasificacionDocumento.tipo es incorrecto con 0 performativos', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.clasificacionDocumento?.tipo).toBe('incorrecto');
    expect(res.clasificacionDocumento?.performativosEncontrados).toHaveLength(0);
  });

});

// ── FIXTURE 2: Política de privacidad completa — Centro Médico Antofagasta ───
// ~700 palabras. Lenguaje mixto: primera y segunda persona.
// Cita Ley 19.628 (no 21.719) — esto es lo que van a subir los usuarios reales.
// Esperado: correcto + green >= 75%

describe('Fixture 2 — Política completa, Centro Médico Antofagasta', () => {
  let texto: string;
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    texto = loadFixture('politica-privacidad-completa.txt');
    docs = docFrom(texto, 'politica-centro-medico.txt');
  });

  it('[POST-IMPL] clasificacionDocumento.tipo es correcto', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.clasificacionDocumento?.tipo).toBe('correcto');
  });

  it('[POST-IMPL] estado es green y cobertura >= 75%', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('green');
    expect(res.cobertura).toBeGreaterThanOrEqual(75);
  });

  it('[POST-IMPL] Cambio 2: ningún criterio con frase legal y sin keyword tiene status ok', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const soloFraseSinKw = res.criterios.filter(
      c => c.frasesLegalesEncontradas.length > 0 && c.kwFound === 0 && c.status === 'ok'
    );
    expect(soloFraseSinKw).toHaveLength(0);
  });

  // ── Baseline actual ───────────────────────────────────────────────────────
  it('[BASELINE] cobertura y estado actuales (pre-implementación)', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    // Documenta el comportamiento actual sin assertions fuertes
    console.log(`F2 baseline: estado=${res.estado} cobertura=${res.cobertura}%`);
    res.criterios.forEach(c => console.log(`  ${c.name}: ${c.status} (kw=${c.kwFound}, frases=${c.frasesLegalesEncontradas.length})`));
    expect(res.cobertura).toBeGreaterThanOrEqual(0); // siempre pasa
  });
});

// ── FIXTURE 3: Política concisa — Escuela de Seguros ─────────────────────────
// ~400 palabras. Primera persona plural ("recopilamos", "utilizamos").
// Cita Ley 19.628. Caso de mayor riesgo para el Cambio 2.
// Esperado: correcto + green o yellow (no red)

describe('Fixture 3 — Política concisa, Escuela de Seguros de Chile', () => {
  let texto: string;
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    texto = loadFixture('politica-privacidad-concisa.txt');
    docs = docFrom(texto, 'politica-escuela-seguros.txt');
  });

  it('[POST-IMPL] clasificacionDocumento.tipo es correcto', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.clasificacionDocumento?.tipo).toBe('correcto');
  });

  it('[POST-IMPL] estado no es red (tiene evidencia suficiente)', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).not.toBe('red');
  });

  it('[POST-IMPL] Cambio 3: confianza no cae a baja en criterios con evidencia', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    const confianzaBajaConEvidencia = res.criterios.filter(
      c => c.status !== 'fail' && c.confianza === 'baja'
    );
    expect(confianzaBajaConEvidencia).toHaveLength(0);
  });

  // ── Baseline actual ───────────────────────────────────────────────────────
  it('[BASELINE] cobertura y estado actuales (pre-implementación)', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    console.log(`F3 baseline: estado=${res.estado} cobertura=${res.cobertura}%`);
    res.criterios.forEach(c => console.log(`  ${c.name}: ${c.status} (kw=${c.kwFound}, frases=${c.frasesLegalesEncontradas.length})`));
    expect(res.cobertura).toBeGreaterThanOrEqual(0);
  });
});

// ── FIXTURE 4: Política en tercera persona — Cencosud/Jumbo ──────────────────
// Política íntegra en tercera persona ("el Usuario podrá", "el Usuario tendrá").
// Jamás usa "usted". Debe clasificar correcto — es el falso negativo que el
// clasificador no debe producir.
// Esperado: correcto + green o yellow (no red, no wrong_type)

describe('Fixture 4 — Política en tercera persona, Cencosud/Jumbo', () => {
  let texto: string;
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    texto = loadFixture('politica-tercera-persona.txt');
    docs = docFrom(texto, 'politica-cencosud.txt');
  });

  it('[POST-IMPL] clasificacionDocumento.tipo NO es incorrecto (no falso negativo)', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.clasificacionDocumento?.tipo).not.toBe('incorrecto');
  });

  it('[POST-IMPL] estado no es wrong_type', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).not.toBe('wrong_type');
  });

  it('[POST-IMPL] estado no es red (tiene evidencia suficiente)', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).not.toBe('red');
  });

  // ── Baseline actual ───────────────────────────────────────────────────────
  it('[BASELINE] cobertura y estado actuales (pre-implementación)', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    console.log(`F4 baseline: estado=${res.estado} cobertura=${res.cobertura}%`);
    res.criterios.forEach(c => console.log(`  ${c.name}: ${c.status} (kw=${c.kwFound}, frases=${c.frasesLegalesEncontradas.length})`));
    expect(res.cobertura).toBeGreaterThanOrEqual(0);
  });
});

// ── FIXTURE 5: Artículo de blog sobre cómo redactar una política ─────────────
// Texto normativo/descriptivo: explica QUÉ debe contener una política de privacidad.
// Contiene prácticamente todo el vocabulario del checklist pero NO es una política.
// Cita la Ley 21.719. Debe clasificar incorrecto.
// Esperado: wrong_type

describe('Fixture 5 — Artículo de blog (normativo, no es una política)', () => {
  let texto: string;
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    texto = loadFixture('articulo-sobre-la-ley.txt');
    docs = docFrom(texto, 'articulo-blog.txt');
  });

  it('[POST-IMPL] clasifica como wrong_type', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('wrong_type');
  });

  it('[POST-IMPL] clasificacionDocumento.tipo es incorrecto', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.clasificacionDocumento?.tipo).toBe('incorrecto');
  });

});

// ── FIXTURE 6: RAT en slot de politica_privacidad — PENDIENTE ────────────────
describe.skip('Fixture 6 — RAT en slot incorrecto [PENDIENTE: rat-documento.txt]', () => {
  let texto: string;
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    if (!fixtureExists('rat-documento.txt')) return;
    texto = loadFixture('rat-documento.txt');
    docs = docFrom(texto, 'RAT.xlsx');
  });

  it('[POST-IMPL] no clasifica como correcto para politica_privacidad', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.clasificacionDocumento?.tipo).not.toBe('correcto');
  });
});

// ── FIXTURE 7: Contrato con cláusula de privacidad — PENDIENTE ───────────────
describe.skip('Fixture 7 — Contrato con cláusula [PENDIENTE: contrato-con-clausula-privacy.txt]', () => {
  let texto: string;
  let docs: Record<string, UploadedDoc>;

  beforeAll(() => {
    if (!fixtureExists('contrato-con-clausula-privacy.txt')) return;
    texto = loadFixture('contrato-con-clausula-privacy.txt');
    docs = docFrom(texto, 'contrato.docx');
  });

  it('[POST-IMPL] no alcanza estado green', () => {
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).not.toBe('green');
  });
});

// ── Tests sintéticos de regresión de umbral ───────────────────────────────────

describe('Regresión de umbral — Cambio 2 (frase legal sola no basta para ok)', () => {
  it('[POST-IMPL] frase legal sin keyword → warn, no ok', () => {
    const texto = `
      Informamos que el titular puede ejercer derechos sobre sus datos.
      Usted tiene derecho a solicitar información. Le informamos que sus datos son tratados.
    `;
    const docs = docFrom(texto);
    const res = analyzeDocument('politica_privacidad', docs);
    const conFragaseSinKw = res.criterios.filter(
      c => c.frasesLegalesEncontradas.length > 0 && c.kwFound === 0 && c.status === 'ok'
    );
    expect(conFragaseSinKw).toHaveLength(0);
  });
});

describe('Regresión de umbral — Cambio 3 (densidad relativa)', () => {
  it('[POST-IMPL] mismo count de keywords en doc largo da confianza igual o menor que en doc corto', () => {
    const base = 'responsable rut domicilio';
    const relleno = 'texto irrelevante sobre gestión empresarial sin relevancia alguna';
    const textoCorto = Array(20).fill(relleno).join(' ') + ' ' + base;
    const textoLargo = Array(600).fill(relleno).join(' ') + ' ' + base;

    const docsCorto: Record<string, UploadedDoc> = {
      politica_privacidad: { name: 'corto.txt', text: textoCorto.toLowerCase(), wordCount: textoCorto.split(/\s+/).length, extractedFully: true },
    };
    const docsLargo: Record<string, UploadedDoc> = {
      politica_privacidad: { name: 'largo.txt', text: textoLargo.toLowerCase(), wordCount: textoLargo.split(/\s+/).length, extractedFully: true },
    };

    const resCorto = analyzeDocument('politica_privacidad', docsCorto);
    const resLargo = analyzeDocument('politica_privacidad', docsLargo);

    const criterioCorto = resCorto.criterios.find(c => c.name.includes('Identidad'));
    const criterioLargo = resLargo.criterios.find(c => c.name.includes('Identidad'));

    const mapaConfianza: Record<string, number> = { alta: 2, media: 1, baja: 0 };
    if (criterioCorto && criterioLargo) {
      expect(mapaConfianza[criterioLargo.confianza]).toBeLessThanOrEqual(mapaConfianza[criterioCorto.confianza]);
    }
  });
});
