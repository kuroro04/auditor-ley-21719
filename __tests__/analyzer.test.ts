import { describe, it, expect } from 'vitest';
import { analyzeDocument } from '../lib/analyzer';
import type { UploadedDoc } from '../lib/types';

describe('analyzeDocument (regresión post-refactor de buildRequisitoResult)', () => {
  it('documento completo de política de privacidad da cobertura alta y estado green', () => {
    const docs: Record<string, UploadedDoc> = {
      politica_privacidad: {
        name: 'politica.txt',
        text: 'responsable rut domicilio contacto finalidad propósito consentimiento base legal '
          + 'acceso rectificación cancelación oposición derechos arco conservación retención plazo eliminar',
        wordCount: 25,
        extractedFully: true,
      },
    };
    const res = analyzeDocument('politica_privacidad', docs);
    expect(res.estado).toBe('green');
    expect(res.cobertura).toBeGreaterThanOrEqual(75);
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
