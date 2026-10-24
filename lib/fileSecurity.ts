// Capa de seguridad del lado del cliente para archivos subidos.
// No reemplaza un antivirus real (eso requiere backend, p.ej. ClamAV);
// aquí se verifican magic bytes, tamaño, extensiones peligrosas, doble
// extensión y se sanitiza el nombre antes de mostrarlo o persistirlo.

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface FileSecurityResult {
  accepted: boolean;
  reason: string;
}

// Extensiones de ejecutables/scripts que nunca deben aceptarse,
// sin importar el MIME type que reporte el navegador.
const DANGEROUS_EXTENSIONS = [
  'exe', 'js', 'mjs', 'cjs', 'bat', 'cmd', 'sh', 'msi', 'msc', 'scr',
  'vbs', 'vbe', 'ps1', 'psm1', 'jar', 'com', 'pif', 'gadget', 'hta',
  'wsf', 'wsh', 'lnk', 'reg', 'apk', 'dmg', 'app', 'dll', 'sys', 'jse',
];

// .xls (OLE2 legacy, Excel 97-2003) eliminado: el parser de navegador (read-excel-file)
// solo soporta .xlsx (OOXML). Documentos de cumplimiento modernos usan .xlsx.
const ALLOWED_EXTENSIONS = ['txt', 'pdf', 'doc', 'docx', 'xlsx'];

// Firmas binarias (magic bytes) de los formatos soportados.
const SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  zip: [0x50, 0x4b, 0x03, 0x04], // docx/xlsx (OOXML = ZIP)
  ole2: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // doc/xls legado
  exePE: [0x4d, 0x5a], // MZ — ejecutable Windows
  elf: [0x7f, 0x45, 0x4c, 0x46], // ejecutable Linux
};

function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((b, i) => bytes[i] === b);
}

async function readHeaderBytes(file: File, length = 8): Promise<Uint8Array> {
  const slice = file.slice(0, length);
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}

// Se queda solo con el nombre base (sin ruta) y elimina caracteres de
// control / null bytes que podrían usarse para inyección o path traversal
// al mostrar el nombre en la UI o al construir nombres de descarga.
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const sinControl = base.replace(/[\x00-\x1f\x7f]/g, ''); // eslint-disable-line no-control-regex
  return sinControl.replace(/\s+/g, ' ').trim() || 'archivo';
}

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

// Detecta extensión doble peligrosa en cualquier posición del nombre,
// p.ej. "documento.pdf.exe" o "documento.exe.pdf".
function hasDangerousDoubleExtension(name: string): boolean {
  const parts = name.toLowerCase().split('.');
  if (parts.length < 3) return false;
  const middleParts = parts.slice(1, -1);
  return middleParts.some(p => DANGEROUS_EXTENSIONS.includes(p));
}

export async function checkFileSecurity(file: File): Promise<FileSecurityResult> {
  const ext = getExtension(file.name);

  if (file.size === 0) {
    return { accepted: false, reason: 'El archivo está vacío' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { accepted: false, reason: 'El archivo supera el límite de 50 MB' };
  }
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return { accepted: false, reason: `Extensión peligrosa no permitida (.${ext})` };
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { accepted: false, reason: `Tipo de archivo no soportado (.${ext || 'sin extensión'})` };
  }
  if (hasDangerousDoubleExtension(file.name)) {
    return { accepted: false, reason: 'Nombre de archivo con doble extensión sospechosa' };
  }

  let header: Uint8Array;
  try {
    header = await readHeaderBytes(file, 8);
  } catch {
    return { accepted: false, reason: 'No se pudo leer el archivo para verificar su contenido' };
  }

  // Un ejecutable nunca debe pasar, sin importar la extensión declarada.
  if (matchesSignature(header, SIGNATURES.exePE) || matchesSignature(header, SIGNATURES.elf)) {
    return { accepted: false, reason: 'El contenido del archivo corresponde a un ejecutable, no a un documento' };
  }

  if (ext === 'pdf' && !matchesSignature(header, SIGNATURES.pdf)) {
    return { accepted: false, reason: 'El contenido del archivo no coincide con un PDF válido' };
  }
  if ((ext === 'docx' || ext === 'xlsx') && !matchesSignature(header, SIGNATURES.zip)) {
    return { accepted: false, reason: 'El contenido del archivo no coincide con un documento Office válido' };
  }
  if ((ext === 'doc' || ext === 'xls') && !matchesSignature(header, SIGNATURES.ole2)) {
    return { accepted: false, reason: 'El contenido del archivo no coincide con un documento Office (formato antiguo) válido' };
  }
  if (ext === 'txt') {
    const isBinaryDisguisedAsTxt =
      matchesSignature(header, SIGNATURES.pdf) ||
      matchesSignature(header, SIGNATURES.zip) ||
      matchesSignature(header, SIGNATURES.ole2);
    if (isBinaryDisguisedAsTxt) {
      return { accepted: false, reason: 'El archivo .txt en realidad contiene un formato binario' };
    }
  }

  return { accepted: true, reason: 'Archivo aceptado — validación de tipo y contenido correcta' };
}
