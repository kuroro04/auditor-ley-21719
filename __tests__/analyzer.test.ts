import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzeDocument } from '../lib/analyzer';
import type { UploadedDoc } from '../lib/types';

describe('analyzeDocument (regresión post-refactor de buildRequisitoResult)', () => {
  it('política real (Centro Médico) alcanza estado green', () => {
    const texto = readFileSync(
      join(__dirname, 'fixtures', 'politica-privacidad-completa.txt'),
      'utf-8',
    );
    const words = texto.trim().split(/\s+/).length;
    const docs: Record<string, UploadedDoc> = {
      politica_privacidad: {
        name: 'politica-centro-medico.txt',
        text: texto.toLowerCase(),
        wordCount: words,
        extractedFully: true,
      },
    };
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('green');
    expect(res.cobertura).toBeGreaterThanOrEqual(75);
    expect(res.clasificacionDocumento?.tipo).toBe('correcto');
    expect(res.criterios).toHaveLength(5);
  });

  it('sin documento subido da estado red y cobertura 0', () => {
    const res = analyzeDocument('politica_privacidad', {});
    expect(res.estado).toBe('red');
    expect(res.cobertura).toBe(0);
    expect(res.gap).toMatch(/Sin este documento/);
  });

  it('documento escaneado da estado unanalyzable', () => {
    const docs: Record<string, UploadedDoc> = {
      politica_privacidad: { name: 'escaneado.pdf', text: '', scanned: true },
    };
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('unanalyzable');
  });
});
