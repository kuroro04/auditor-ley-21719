import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  ARCHIVOS,
  BASE_URL,
  ErrorDeIntegridad,
  REVISION,
  descargarArchivo,
  main,
} from '../scripts/fetch-embedding-model.mjs';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function fetchQueDevuelve(contenido: string) {
  return vi.fn(async () => new Response(contenido));
}

let destDir: string;

beforeEach(() => {
  destDir = mkdtempSync(join(tmpdir(), 'modelo-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(destDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('fijación de la versión del modelo', () => {
  it('descarga desde un commit exacto, nunca desde main', () => {
    expect(REVISION).toMatch(/^[0-9a-f]{40}$/);
    expect(BASE_URL).toContain(`/resolve/${REVISION}`);
    expect(BASE_URL).not.toMatch(/\/resolve\/main\b/);
  });

  it('cada archivo del modelo tiene un SHA-256 fijado', () => {
    expect(ARCHIVOS.length).toBeGreaterThan(0);
    for (const archivo of ARCHIVOS) {
      expect(archivo.sha256, archivo.ruta).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('descargarArchivo', () => {
  const contenido = '{"modelo":"ok"}';
  const archivo = { ruta: 'onnx/model.onnx', sha256: sha256(contenido) };

  it('guarda el archivo cuando el hash coincide, sin dejar el .part', async () => {
    const fetchImpl = fetchQueDevuelve(contenido);
    await descargarArchivo(archivo, { destDir, fetchImpl });

    const destino = join(destDir, 'onnx', 'model.onnx');
    expect(readFileSync(destino, 'utf8')).toBe(contenido);
    expect(existsSync(destino + '.part')).toBe(false);
    expect(fetchImpl).toHaveBeenCalledWith(`${BASE_URL}/onnx/model.onnx`);
  });

  it('si el hash no coincide, falla y no deja ni el archivo ni el .part', async () => {
    const fetchImpl = fetchQueDevuelve('contenido alterado');

    await expect(descargarArchivo(archivo, { destDir, fetchImpl })).rejects.toBeInstanceOf(ErrorDeIntegridad);

    const destino = join(destDir, 'onnx', 'model.onnx');
    expect(existsSync(destino)).toBe(false);
    expect(existsSync(destino + '.part')).toBe(false);
  });

  it('un archivo existente con el hash correcto no se vuelve a descargar', async () => {
    mkdirSync(join(destDir, 'onnx'), { recursive: true });
    writeFileSync(join(destDir, 'onnx', 'model.onnx'), contenido);
    const fetchImpl = fetchQueDevuelve(contenido);

    await descargarArchivo(archivo, { destDir, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('un archivo existente con otro hash (ej. bajado de main) se reemplaza por uno verificado', async () => {
    mkdirSync(join(destDir, 'onnx'), { recursive: true });
    writeFileSync(join(destDir, 'onnx', 'model.onnx'), 'versión vieja sin verificar');
    const fetchImpl = fetchQueDevuelve(contenido);

    await descargarArchivo(archivo, { destDir, fetchImpl });
    expect(readFileSync(join(destDir, 'onnx', 'model.onnx'), 'utf8')).toBe(contenido);
  });

  it('un archivo existente con otro hash, si la descarga también falla la verificación, queda borrado', async () => {
    mkdirSync(join(destDir, 'onnx'), { recursive: true });
    writeFileSync(join(destDir, 'onnx', 'model.onnx'), 'versión vieja sin verificar');
    const fetchImpl = fetchQueDevuelve('contenido alterado');

    await expect(descargarArchivo(archivo, { destDir, fetchImpl })).rejects.toBeInstanceOf(ErrorDeIntegridad);
    expect(existsSync(join(destDir, 'onnx', 'model.onnx'))).toBe(false);
  });
});

describe('main', () => {
  const archivos = [{ ruta: 'config.json', sha256: sha256('{}') }];

  it('devuelve 1 (falla) ante un hash que no coincide', async () => {
    const codigo = await main({ archivos, destDir, fetchImpl: fetchQueDevuelve('{"alterado":true}') });
    expect(codigo).toBe(1);
  });

  it('devuelve 0 sin conexión, para no romper npm install: la app sigue solo con reglas', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('fetch failed'); });
    const codigo = await main({ archivos, destDir, fetchImpl });
    expect(codigo).toBe(0);
    expect(existsSync(join(destDir, 'config.json'))).toBe(false);
  });

  it('devuelve 0 cuando todo se descarga y verifica', async () => {
    const codigo = await main({ archivos, destDir, fetchImpl: fetchQueDevuelve('{}') });
    expect(codigo).toBe(0);
    expect(readFileSync(join(destDir, 'config.json'), 'utf8')).toBe('{}');
  });
});
