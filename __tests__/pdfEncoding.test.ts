import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TEMPLATES } from '../lib/templateContent';

// jsPDF con fuentes estándar (helvetica) solo soporta WinAnsiEncoding (cp1252).
// Cualquier code point fuera de ese rango se corrompe visualmente en el PDF
// (bug reportado: "Ø=ÜË" / "Ø=ÜÌ"). Este test evita que se reintroduzcan
// emojis u otros símbolos no soportados en el código fuente de los renderers
// y en el contenido de las plantillas.
const EMOJI_OR_UNSUPPORTED = new RegExp('[\\u{1F000}-\\u{1FFFF}\\u{2600}-\\u{27BF}\\u{2190}-\\u{21FF}\\u{2B00}-\\u{2BFF}]', 'u');

function assertNoUnsupportedChars(filePath: string) {
  const src = readFileSync(join(__dirname, '..', filePath), 'utf8');
  const matches = src.match(new RegExp(EMOJI_OR_UNSUPPORTED.source, 'gu')) ?? [];
  expect(matches, `Caracteres no soportados por jsPDF/Helvetica en ${filePath}: ${matches.join(' ')}`).toEqual([]);
}

describe('Codificación segura para PDF (sin emojis ni símbolos fuera de WinAnsi)', () => {
  it('lib/pdfExport.ts no contiene emojis ni símbolos fuera de WinAnsi', () => {
    assertNoUnsupportedChars('lib/pdfExport.ts');
  });

  it('lib/templateContent.ts no contiene emojis en el contenido de las plantillas', () => {
    assertNoUnsupportedChars('lib/templateContent.ts');
  });

  it('ninguna plantilla en TEMPLATES contiene emojis en sus campos de texto', () => {
    const offenders: string[] = [];
    for (const tpl of Object.values(TEMPLATES)) {
      const campos = [tpl.titulo, tpl.articulo, tpl.proposito, ...tpl.notas, ...tpl.checklist];
      for (const s of tpl.secciones) campos.push(s.titulo, s.porQue, s.instruccion, s.placeholder);
      for (const campo of campos) {
        if (EMOJI_OR_UNSUPPORTED.test(campo)) offenders.push(`${tpl.reqId}: "${campo.slice(0, 40)}..."`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
