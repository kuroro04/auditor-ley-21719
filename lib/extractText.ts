'use client';

import type { UploadedDoc } from './types';

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

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

  const arrayBuffer = await readAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
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

  return pages.join('\n');
}

async function extractDocxText(file: File): Promise<string> {
  const { extractRawText } = await import('mammoth');
  const arrayBuffer = await readAsArrayBuffer(file);
  const result = await extractRawText({ arrayBuffer });
  return result.value;
}

async function extractXlsxText(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await readAsArrayBuffer(file);
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const texts: string[] = [];
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    texts.push(XLSX.utils.sheet_to_csv(sheet));
  });

  return texts.join('\n');
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES: Record<string, string[]> = {
  txt:  ['text/plain', ''],
  pdf:  ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream', ''],
  doc:  ['application/msword', 'application/octet-stream', ''],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream', ''],
  xls:  ['application/vnd.ms-excel', 'application/octet-stream', ''],
};

export async function extractDocumentText(file: File): Promise<UploadedDoc> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      name: file.name,
      text: '',
      wordCount: 0,
      extractedFully: false,
      extractMethod: `archivo demasiado grande (máx. 10 MB)`,
    };
  }

  const allowedMimes = ALLOWED_TYPES[ext];
  if (!allowedMimes || (!allowedMimes.includes(file.type) && file.type !== '')) {
    return {
      name: file.name,
      text: '',
      wordCount: 0,
      extractedFully: false,
      extractMethod: 'tipo no soportado',
    };
  }

  try {
    let rawText = '';
    let method = '';

    if (ext === 'txt' || file.type === 'text/plain') {
      rawText = await readAsText(file);
      method = 'texto plano';
    } else if (ext === 'pdf') {
      rawText = await extractPdfText(file);
      method = 'PDF';
    } else if (ext === 'docx' || ext === 'doc') {
      rawText = await extractDocxText(file);
      method = 'Word';
    } else if (ext === 'xlsx' || ext === 'xls') {
      rawText = await extractXlsxText(file);
      method = 'Excel';
    } else {
      return {
        name: file.name,
        text: file.name.toLowerCase(),
        wordCount: 0,
        extractedFully: false,
        extractMethod: 'tipo no soportado',
      };
    }

    const wordCount = countWords(rawText);

    // Detectar PDF escaneado: si es PDF y casi no tiene texto, probablemente es una imagen
    if (ext === 'pdf' && wordCount < 20) {
      return {
        name: file.name,
        text: '',
        wordCount: 0,
        extractedFully: false,
        extractMethod: 'PDF escaneado — sin texto extraíble',
        scanned: true,
      };
    }

    return {
      name: file.name,
      text: rawText.toLowerCase(),
      wordCount,
      extractedFully: true,
      extractMethod: method,
      scanned: false,
    };

  } catch {
    return {
      name: file.name,
      text: '',
      wordCount: 0,
      extractedFully: false,
      extractMethod: 'error al leer el archivo',
    };
  }
}
