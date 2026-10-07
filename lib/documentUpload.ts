// Flujo de carga de un documento, compartido por UploadView y DiagnosticoView.
//
// Con sesión real (authSource === 'backend') el servidor es la puerta de
// entrada: el archivo se sube PRIMERO a POST /documents/upload, donde queda
// registrado en la bitácora de auditoría y pasa por el antivirus. Solo si el
// servidor lo acepta se lee su contenido localmente y se entrega para el
// análisis. Si la subida falla, el documento no se lee ni se analiza: tratar
// datos personales sin registro en el servidor es un problema de
// cumplimiento, no un detalle de disponibilidad.
//
// En modo demostración no hay backend: el análisis sigue siendo solo local.
import { ApiError } from './api/client';
import { uploadDocument } from './api/documents';
import { extractDocumentText } from './extractText';
import type { AuthSource } from '@/hooks/useAppState';
import type { UploadedDoc } from './types';

export type UploadFailureKind = 'antivirus' | 'tipo_invalido' | 'escaner_no_disponible' | 'conexion' | 'otro';

export interface UploadFailure {
  kind: UploadFailureKind;
  titulo: string;   // qué pasó, en una línea
  mensaje: string;  // detalle, siempre aclarando que el documento no se analizó
  accion: string;   // qué puede hacer el usuario
}

export type UploadAttempt =
  | { status: 'aceptado'; doc: UploadedDoc }
  | { status: 'rechazado_local'; doc: UploadedDoc }
  | { status: 'fallo_servidor'; failure: UploadFailure };

export interface UploadDeps {
  upload?: (file: File, reqId: string) => Promise<unknown>;
  extract?: typeof extractDocumentText;
  onPhase?: (phase: 'security' | 'extracting') => void;
}

const NO_ANALIZADO = 'No se guardó en el servidor y no se analizó.';

// El `detail` del servidor a veces termina en punto y a veces no.
const frase = (s: string) => s.trim().replace(/\.?$/, '.');

// Traduce el error de la subida a un mensaje para el usuario. Los códigos
// vienen del campo `codigo` del 400 de /documents/upload; un fallo de fetch
// (TypeError) significa que la petición ni siquiera llegó al servidor.
export function describeUploadFailure(err: unknown, fileName: string): UploadFailure {
  if (!(err instanceof ApiError)) {
    return {
      kind: 'conexion',
      titulo: 'Sin conexión con el servidor',
      mensaje: `"${fileName}" no llegó al servidor. ${NO_ANALIZADO}`,
      accion: 'Revise su conexión a internet y vuelva a subir el archivo.',
    };
  }
  switch (err.code) {
    case 'firma_detectada':
      return {
        kind: 'antivirus',
        titulo: 'El antivirus bloqueó el documento',
        mensaje: `El análisis antivirus detectó una amenaza en "${fileName}" y el archivo fue descartado. ${NO_ANALIZADO}`,
        accion: 'No abra este archivo. Pida a su equipo de TI que lo revise y suba una copia limpia.',
      };
    case 'validacion_tipo':
      return {
        kind: 'tipo_invalido',
        titulo: 'Tipo de archivo no válido',
        mensaje: `"${fileName}" fue rechazado: ${frase(err.message)} ${NO_ANALIZADO}`,
        accion: 'Suba un PDF, Word, Excel o texto (.txt) de hasta 50 MB.',
      };
    case 'fallo_escaner':
      // El detail del servidor trae el error interno de ClamAV: no se muestra.
      return {
        kind: 'escaner_no_disponible',
        titulo: 'Servicio de escaneo no disponible',
        mensaje: `No se pudo verificar "${fileName}" con el antivirus, así que por seguridad no se aceptó. El problema es del servidor, no de su archivo. ${NO_ANALIZADO}`,
        accion: 'Intente de nuevo en unos minutos. Si el problema persiste, contacte a soporte.',
      };
    default:
      return {
        kind: 'otro',
        titulo: 'No se pudo subir el documento',
        mensaje: `El servidor rechazó "${fileName}": ${frase(err.message)} ${NO_ANALIZADO}`,
        accion: 'Intente de nuevo. Si el problema persiste, contacte a soporte.',
      };
  }
}

export async function processDocumentUpload(
  file: File,
  reqId: string,
  authSource: AuthSource,
  { upload = uploadDocument, extract = extractDocumentText, onPhase }: UploadDeps = {},
): Promise<UploadAttempt> {
  if (authSource === 'backend') {
    onPhase?.('security');
    try {
      await upload(file, reqId);
    } catch (err) {
      return { status: 'fallo_servidor', failure: describeUploadFailure(err, file.name) };
    }
  }

  const doc = await extract(file, onPhase);
  return doc.rejected ? { status: 'rechazado_local', doc } : { status: 'aceptado', doc };
}
