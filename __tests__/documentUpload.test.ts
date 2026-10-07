import { describe, it, expect, vi } from 'vitest';
import { ApiError } from '../lib/api/client';
import { describeUploadFailure, processDocumentUpload } from '../lib/documentUpload';
import type { UploadedDoc } from '../lib/types';

const docOk: UploadedDoc = {
  name: 'politica.pdf', text: 'texto', wordCount: 1, extractedFully: true, extractMethod: 'PDF', scanned: false,
};

function archivo() {
  return new File(['contenido'], 'politica.pdf', { type: 'application/pdf' });
}

function deps(uploadImpl: () => Promise<unknown>) {
  return {
    upload: vi.fn(uploadImpl),
    extract: vi.fn(async () => docOk),
  };
}

describe('processDocumentUpload — sesión con backend', () => {
  it('si la subida es aceptada, extrae el texto y devuelve el documento', async () => {
    const d = deps(async () => ({}));
    const res = await processDocumentUpload(archivo(), 'R1', 'backend', d);
    expect(res).toEqual({ status: 'aceptado', doc: docOk });
    expect(d.upload).toHaveBeenCalledWith(expect.any(File), 'R1');
  });

  it('sube al servidor ANTES de leer el contenido localmente', async () => {
    const orden: string[] = [];
    const res = await processDocumentUpload(archivo(), 'R1', 'backend', {
      upload: async () => { orden.push('upload'); return {}; },
      extract: async () => { orden.push('extract'); return docOk; },
    });
    expect(res.status).toBe('aceptado');
    expect(orden).toEqual(['upload', 'extract']);
  });

  const casos: Array<[string, unknown, string, RegExp]> = [
    ['antivirus', new ApiError('Amenaza detectada: Eicar-Signature', 400, 'firma_detectada'), 'antivirus', /antivirus/i],
    ['tipo inválido', new ApiError('Tipo de archivo no permitido', 400, 'validacion_tipo'), 'tipo_invalido', /tipo de archivo/i],
    ['escáner caído', new ApiError('No se pudo escanear con ClamAV', 400, 'fallo_escaner'), 'escaner_no_disponible', /escaneo no disponible/i],
    ['error de conexión', new TypeError('Failed to fetch'), 'conexion', /conexión/i],
  ];

  for (const [nombre, error, kind, titulo] of casos) {
    it(`fallo de subida (${nombre}) impide el análisis y devuelve el mensaje correspondiente`, async () => {
      const d = deps(async () => { throw error; });
      const res = await processDocumentUpload(archivo(), 'R1', 'backend', d);

      expect(res.status).toBe('fallo_servidor');
      if (res.status !== 'fallo_servidor') return;
      expect(res.failure.kind).toBe(kind);
      expect(res.failure.titulo).toMatch(titulo);
      expect(res.failure.mensaje).toContain('politica.pdf');
      expect(res.failure.mensaje).toMatch(/no se analizó/i);
      expect(res.failure.accion.length).toBeGreaterThan(0);
      // El documento nunca se lee ni se entrega para el análisis.
      expect(d.extract).not.toHaveBeenCalled();
      expect('doc' in res).toBe(false);
    });
  }

  it('otros errores del servidor (ej. bitácora caída, 503) también bloquean el análisis', async () => {
    const d = deps(async () => {
      throw new ApiError('No se pudo registrar la carga en la bitácora de auditoría; el documento no fue almacenado.', 503);
    });
    const res = await processDocumentUpload(archivo(), 'R1', 'backend', d);
    expect(res.status).toBe('fallo_servidor');
    if (res.status !== 'fallo_servidor') return;
    expect(res.failure.kind).toBe('otro');
    expect(res.failure.mensaje).toContain('bitácora de auditoría');
    expect(d.extract).not.toHaveBeenCalled();
  });

  it('un rechazo de la validación local tras una subida aceptada se informa como rechazo local', async () => {
    const rechazado: UploadedDoc = { ...docOk, text: '', rejected: true, extractMethod: 'archivo corrupto' };
    const res = await processDocumentUpload(archivo(), 'R1', 'backend', {
      upload: async () => ({}),
      extract: async () => rechazado,
    });
    expect(res).toEqual({ status: 'rechazado_local', doc: rechazado });
  });
});

describe('processDocumentUpload — modo demostración', () => {
  it('no llama al backend y analiza localmente como siempre', async () => {
    const d = deps(async () => { throw new TypeError('no debería llamarse'); });
    const res = await processDocumentUpload(archivo(), 'R1', 'demo', d);
    expect(res).toEqual({ status: 'aceptado', doc: docOk });
    expect(d.upload).not.toHaveBeenCalled();
    expect(d.extract).toHaveBeenCalled();
  });
});

describe('describeUploadFailure', () => {
  it('un ApiError sin código conocido cae en el caso genérico con el detalle del servidor', () => {
    const f = describeUploadFailure(new ApiError('Error 500', 500), 'a.pdf');
    expect(f.kind).toBe('otro');
    expect(f.mensaje).toContain('Error 500');
  });
});
