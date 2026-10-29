/**
 * Tests de integración: pdfjs-dist 6.x y read-excel-file 9.x
 *
 * Verifican que las librerías actualizadas (pdfjs-dist 3→6, xlsx→read-excel-file)
 * extraen texto correctamente desde archivos binarios reales (no mocks ni texto plano).
 * Los fixtures en __tests__/fixtures/ se generan con scripts/generate-test-fixtures.mjs.
 */
import { describe, it, expect } from 'vitest';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import readXlsxFileNode from 'read-excel-file/node';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { checkFileSecurity } from '../lib/fileSecurity';

const __dir = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dir, 'fixtures');

// pdfjs-dist legacy build en Node.js necesita apuntar al worker como file://
const workerPath = resolve(__dir, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs');
GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

// ── pdfjs-dist 6.x ────────────────────────────────────────────────────────────

describe('pdfjs-dist 6.x — extracción de texto desde PDF real', () => {
  it('lee el número de páginas de un PDF binario real', async () => {
    const data = new Uint8Array(readFileSync(resolve(FIXTURES, 'sample.pdf')));
    const pdf = await getDocument({ data }).promise;
    expect(pdf.numPages).toBe(1);
  });

  it('extrae el texto embebido en el stream de contenido del PDF', async () => {
    const data = new Uint8Array(readFileSync(resolve(FIXTURES, 'sample.pdf')));
    const pdf = await getDocument({ data }).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text: string = content.items
      .map((item: unknown) => ('str' in (item as Record<string, unknown>) ? (item as { str: string }).str : ''))
      .join(' ')
      .trim();
    expect(text).toContain('DataShield');
    expect(text).toContain('privacidad');
  });
});

// ── read-excel-file 9.x ───────────────────────────────────────────────────────

describe('read-excel-file 9.x — extracción de filas desde XLSX real', () => {
  it('lee al menos una fila del XLSX de muestra', async () => {
    const buffer = readFileSync(resolve(FIXTURES, 'sample.xlsx'));
    // read-excel-file/node devuelve [{sheet, data}] cuando recibe un Buffer
    const sheets = await readXlsxFileNode(buffer as unknown as Parameters<typeof readXlsxFileNode>[0]);
    expect(Array.isArray(sheets)).toBe(true);
    expect(sheets.length).toBeGreaterThanOrEqual(1);
  });

  it('extrae los valores de texto de las celdas correctamente', async () => {
    const buffer = readFileSync(resolve(FIXTURES, 'sample.xlsx'));
    const sheets = await readXlsxFileNode(buffer as unknown as Parameters<typeof readXlsxFileNode>[0]);
    const firstSheet = (sheets as Array<{ sheet: string; data: unknown[][] }>)[0];
    const values = firstSheet.data.flat().map(String);
    expect(values).toContain('Responsable de datos');
    expect(values).toContain('DataShield SA');
  });
});

// ── Rechazo de .xls (formato legado no soportado) ─────────────────────────────

describe('fileSecurity — formato .xls rechazado con mensaje claro', () => {
  it('devuelve accepted=false y menciona el formato cuando se sube un .xls', async () => {
    const oleBytes = readFileSync(resolve(FIXTURES, 'sample.xls'));
    // Node.js 20+ incluye File como global; igual que en el navegador
    const file = new File([oleBytes], 'registros_2023.xls');
    const result = await checkFileSecurity(file);
    expect(result.accepted).toBe(false);
    // El mensaje debe identificar claramente el formato, no ser un error genérico
    expect(result.reason).toMatch(/no soportado/i);
    expect(result.reason).toContain('.xls');
  });

  it('el mensaje NO menciona error interno ni stack trace', async () => {
    const oleBytes = readFileSync(resolve(FIXTURES, 'sample.xls'));
    const file = new File([oleBytes], 'datos.xls');
    const result = await checkFileSecurity(file);
    expect(result.reason).not.toMatch(/error|exception|stack|cannot/i);
  });
});
