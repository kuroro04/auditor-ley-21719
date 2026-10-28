export type UserRole = 'administrador' | 'visualizador' | 'auditor';

export interface AuditEvent {
  id: number;
  timestamp: string;
  rol: UserRole;
  usuario: string;
  accion: 'subió documento' | 'ejecutó análisis' | 'descargó informe' | 'eliminó documento' | 'documento rechazado';
  archivo?: string;
  detalle?: string; // motivo, usado en 'documento rechazado' para explicar por qué
}

export interface Criterio {
  name: string;
  keywords: string[];
  synonyms: string[];
  frasesLegales: string[];
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

export interface ClasificacionConfig {
  marcadoresPerformativos: string[];
  marcadoresNormativos: {
    tier1: string[];
    tier2: string[];
  };
}

export interface ClasificacionDocumentoResult {
  tipo: 'correcto' | 'dudoso' | 'incorrecto';
  razon: string;
  performativosEncontrados: string[];
  normativosEncontrados: string[];
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
  clasificacion: ClasificacionConfig;
}

export interface UploadedDoc {
  name: string;
  text: string;
  wordCount?: number;
  extractedFully?: boolean;
  extractMethod?: string;
  scanned?: boolean; // true cuando el PDF no tiene texto seleccionable
  rejected?: boolean; // true cuando la capa de seguridad rechazó el archivo (no debe persistirse)
  pending?: true; // true cuando se rehidrató desde el backend: nombre conocido, sin texto ni análisis
}

export interface CriterioResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  found: string;
  kwFound: number;
  kwTotal: number;
  confianza: 'alta' | 'media' | 'baja';
  validado: boolean;
  // Campos de explicabilidad del motor v2
  negaciones: string[];
  frasesLegalesEncontradas: string[];
  requiereRevisionManual: boolean;
  densidad: number;
  kwsEnContextoNormativo: string[];
  densidadRelativa?: number;
  // Fragmento textual EXACTO del documento (recorte con contexto alrededor
  // del término/frase que respalda la detección). Vacío cuando no hay
  // evidencia (status 'fail').
  fragmentoDocumento: string;
  // ── Capa semántica (NLP local, complementaria al motor de reglas) ──────
  // Ausente = detectado por el motor de reglas (comportamiento de siempre).
  // 'semantico' = un criterio que las reglas marcaron 'fail' fue promovido
  // a 'warn' por una coincidencia semántica; NUNCA se usa para llegar a 'ok'.
  origenDeteccion?: 'reglas' | 'semantico';
  // Evidencia de la coincidencia semántica (presente tanto si origenDeteccion
  // es 'semantico' como si un criterio 'warn' de reglas además tuvo
  // corroboración semántica adicional).
  coincidenciaSemantica?: {
    parrafo: string;
    similitud: number;
    nivel: 'alto' | 'medio';
  };
}

export interface RequisitoResult {
  // 'unanalyzable' = documento escaneado, no se pudo extraer texto
  // 'wrong_type'   = documento del tipo incorrecto (clasificación previa)
  // 'pending'      = documento rehidratado desde el backend sin texto disponible;
  //                  no se analiza y no aporta al porcentaje de cumplimiento
  estado: 'green' | 'yellow' | 'red' | 'unanalyzable' | 'wrong_type' | 'pending';
  cobertura: number;
  criterios: CriterioResult[];
  gap: string;
  clasificacionDocumento?: ClasificacionDocumentoResult;
}

export interface HistorialSnapshot {
  fecha: string;    // ISO 8601 — momento en que se ejecutó el análisis
  pct: number;      // porcentaje de cumplimiento global (0–100)
  green: number;    // cantidad de requisitos en estado verde
  yellow: number;   // cantidad de requisitos en estado amarillo
  red: number;      // cantidad de requisitos en estado rojo
  checklistVersion: string; // versión del checklist de requisitos usada en este análisis
}

export type Screen = 'landing' | 'app' | 'analyzing';
export type ActiveTab = 'subir' | 'diagnostico' | 'registro' | 'riesgos' | 'historial';

export interface ToastItem {
  id: number;
  msg: string;
  type: 'blue' | 'green' | 'yellow' | 'red';
}

export type Sector = 'retail' | 'salud' | 'finanzas' | 'tecnologia' | 'otro';
