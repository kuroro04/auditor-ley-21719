'use client';

import type { UploadedDoc } from './types';
import { checkFileSecurity, sanitizeFileName } from './fileSecurity';

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string) || '');
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsText(file, 'UTF-8');
  });
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsArrayBuffer(file);
  });
}

const MAX_PDF_PAGES = 300;

interface PdfExtractionResult {
  text: string;
  numPages: number;
  extractedFully: boolean;
}

async function extractPdfText(file: File): Promise<PdfExtractionResult> {
  const pdfjsLib = await import('pdfjs-dist');
  // pdfjs-dist 4.x+ ships an ESM worker (.mjs); the legacy .js no longer exists.
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await readAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  try {
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const totalPages = Math.min(numPages, MAX_PDF_PAGES);
    const pages: string[] = [];
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: unknown) => {
          if (item && typeof item === 'object' && 'str' in item) {
            return (item as { str: string }).str;
          }
          return '';
        })
        .join(' ');
      pages.push(pageText);
    }

    return {
      text: pages.join('\n'),
      numPages,
      extractedFully: numPages <= MAX_PDF_PAGES,
    };
  } finally {
    // Hallazgo A21: Liberar recursos explícitamente en el navegador
    try {
      loadingTask.destroy();
    } catch {}
  }
}

async function extractDocxText(file: File): Promise<string> {
  const { extractRawText } = await import('mammoth');
  const arrayBuffer = await readAsArrayBuffer(file);
  const result = await extractRawText({ arrayBuffer });
  return result.value;
}

async function extractXlsxText(file: File): Promise<string> {
  // read-excel-file reemplaza a xlsx (SheetJS CE), que no tiene fix para
  // prototype pollution y ReDoS. Solo soporta .xlsx (OOXML); el formato
  // .xls (OLE2 legacy) ya no se acepta en este flujo.
  // La v9 no exporta la raíz del paquete (solo /browser, /node, etc.) y
  // devuelve todas las hojas como [{ sheet, data }].
  const readXlsxFile = (await import('read-excel-file/browser')).default;
  const sheets = await readXlsxFile(file);
  return sheets
    .flatMap(({ data }) => data)
    .map(row => row.map(cell => (cell == null ? '' : String(cell))).join('\t'))
    .join('\n');
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function extractDocumentText(
  file: File,
  onPhase?: (phase: 'security' | 'extracting') => void,
): Promise<UploadedDoc> {
  const safeName = sanitizeFileName(file.name);

  onPhase?.('security');
  const security = await checkFileSecurity(file);
  if (!security.accepted) {
    return {
      name: safeName,
      text: '',
      wordCount: 0,
      extractedFully: false,
      extractMethod: security.reason,
      rejected: true,
    };
  }

  onPhase?.('extracting');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  try {
    let rawText = '';
    let method = '';

    let extractedFully = true;
    if (ext === 'txt') {
      rawText = await readAsText(file);
      method = 'texto plano';
    } else if (ext === 'pdf') {
      const pdfRes = await extractPdfText(file);
      rawText = pdfRes.text;
      extractedFully = pdfRes.extractedFully;
      method = pdfRes.extractedFully
        ? 'PDF'
        : `PDF (primeras ${MAX_PDF_PAGES} de ${pdfRes.numPages} págs)`;
    } else if (ext === 'docx' || ext === 'doc') {
      rawText = await extractDocxText(file);
      method = 'Word';
    } else if (ext === 'xlsx') {
      rawText = await extractXlsxText(file);
      method = 'Excel';
    }

    const wordCount = countWords(rawText);

    // Detectar PDF escaneado: si es PDF y casi no tiene texto, probablemente es una
    // imagen. Este es un documento aceptado (pasó la validación de seguridad), solo
    // que no se puede analizar su contenido.
    if (ext === 'pdf' && wordCount < 20) {
      return {
        name: safeName,
        text: '',
        wordCount: 0,
        extractedFully: false,
        extractMethod: 'PDF escaneado — sin texto extraíble',
        scanned: true,
      };
    }

    return {
      name: safeName,
      text: rawText.toLowerCase(),
      wordCount,
      extractedFully,
      extractMethod: method,
      scanned: false,
    };

  } catch {
    return {
      name: safeName,
      text: '',
      wordCount: 0,
      extractedFully: false,
      extractMethod: 'error al leer el archivo — puede estar corrupto o dañado',
      rejected: true,
    };
  }
}
