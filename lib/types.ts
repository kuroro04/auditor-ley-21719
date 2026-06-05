export type UserRole = 'administrador' | 'visualizador' | 'auditor';

export interface AuditEvent {
  id: number;
  timestamp: string;
  rol: UserRole;
  usuario: string;
  accion: 'subió documento' | 'ejecutó análisis' | 'descargó informe' | 'eliminó documento';
  archivo?: string;
}

export interface Criterio {
  name: string;
  keywords: string[];
  synonyms: string[];
  validado: boolean;
}

export interface Plazo {
  date: string;
  urgency: 'ok' | 'pronto' | 'urgent';
}

// Detalle legal para mostrar en la ficha expandible de cada requisito
export interface LegalDetail {
  articulo: string;           // Ej: "Artículo 14 — Deber de información"
  documentoEvidencia: string; // Qué documento acredita el cumplimiento
  exigenciaSimple: string;    // Explicación en lenguaje llano (2-3 oraciones)
}

export interface Requisito {
  id: string;
  num: string;
  nombre: string;
  art: string;
  desc: string;
  multa: string;
  nivel: 'medio' | 'alto' | 'critico';
  plazo: Plazo;
  criterios: Criterio[];
  legalDetail: LegalDetail;
}

export interface UploadedDoc {
  name: string;
  text: string;
  wordCount?: number;
  extractedFully?: boolean;
  extractMethod?: string;
  scanned?: boolean; // true cuando el PDF no tiene texto seleccionable
}

export interface CriterioResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  found: string;
  kwFound: number;
  kwTotal: number;
  confianza: 'alta' | 'media' | 'baja';
  validado: boolean;
}

export interface RequisitoResult {
  // 'unanalyzable' = documento escaneado, no se pudo extraer texto
  estado: 'green' | 'yellow' | 'red' | 'unanalyzable';
  cobertura: number;
  criterios: CriterioResult[];
  gap: string;
}

export type Screen = 'landing' | 'app' | 'analyzing';
export type ActiveTab = 'subir' | 'diagnostico' | 'registro' | 'riesgos';

export interface ToastItem {
  id: number;
  msg: string;
  type: 'blue' | 'green' | 'yellow' | 'red';
}
