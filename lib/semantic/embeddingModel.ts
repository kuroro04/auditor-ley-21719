'use client';

// Carga perezosa y en segundo plano del modelo de embeddings local
// (Xenova/all-MiniLM-L6-v2). El modelo está autohospedado en
// public/models/ (ver scripts/fetch-embedding-model.mjs): nunca se
// descarga desde un servidor externo en el navegador del usuario.
// El import de @xenova/transformers es dinámico para que Next.js nunca
// intente evaluarlo durante el server-side rendering.

export type EstadoModelo = 'idle' | 'loading' | 'ready' | 'error';

type ExtractorEmbeddings = (textos: string[]) => Promise<number[][]>;

let estado: EstadoModelo = 'idle';
let extractorPromise: Promise<ExtractorEmbeddings> | null = null;
const subscriptores = new Set<() => void>();

function notificar() {
  subscriptores.forEach(cb => cb());
}

function setEstado(nuevo: EstadoModelo) {
  estado = nuevo;
  notificar();
}

/** Estado actual del modelo, para mostrar un indicador discreto en la UI. */
export function getModelStatus(): EstadoModelo {
  return estado;
}

/** Se suscribe a cambios de estado del modelo. Devuelve la función para desuscribirse. */
export function subscribeModelStatus(cb: () => void): () => void {
  subscriptores.add(cb);
  return () => subscriptores.delete(cb);
}

async function cargarExtractor(): Promise<ExtractorEmbeddings> {
  setEstado('loading');
  const { pipeline, env } = await import('@xenova/transformers');

  // El modelo se sirve desde public/models/ (asset propio del proyecto) —
  // nunca desde un servidor remoto. allowRemoteModels queda deshabilitado
  // a propósito, para que un modelo faltante falle explícitamente en vez
  // de intentar descargarlo de internet.
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = '/models/';

  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    quantized: true,
  });

  const wrapped: ExtractorEmbeddings = async (textos: string[]) => {
    const salida = await extractor(textos, { pooling: 'mean', normalize: true });
    const dim = salida.dims[salida.dims.length - 1];
    const vectores: number[][] = [];
    for (let i = 0; i < textos.length; i++) {
      vectores.push(Array.from(salida.data.slice(i * dim, (i + 1) * dim) as Float32Array));
    }
    return vectores;
  };

  setEstado('ready');
  return wrapped;
}

/**
 * Inicia la carga del modelo si aún no se ha iniciado. Idempotente: llamadas
 * repetidas (desde distintos componentes) reutilizan la misma carga. Si la
 * carga ya falló antes, NO reintenta automáticamente (evita bucles de
 * reintento); para reintentar hace falta recargar la página.
 */
export function preloadEmbeddingModel(): void {
  if (extractorPromise) return;
  extractorPromise = cargarExtractor().catch(err => {
    setEstado('error');
    throw err;
  });
  // Evita "unhandled rejection" a nivel de módulo cuando nadie más está
  // esperando esta promesa todavía (el error real se propaga igual a
  // quien sí la espere via getEmbedder()/embed()).
  extractorPromise.catch(() => {});
}

/**
 * Devuelve el extractor de embeddings, esperando a que termine de cargar si
 * hace falta. Lanza si el modelo falló al cargar — el llamador debe
 * capturarlo y seguir solo con el motor de reglas.
 */
export async function getEmbedder(): Promise<ExtractorEmbeddings> {
  preloadEmbeddingModel();
  return extractorPromise!;
}

/** Calcula embeddings normalizados (mean pooling) para un lote de textos. */
export async function embed(textos: string[]): Promise<number[][]> {
  if (textos.length === 0) return [];
  const extractor = await getEmbedder();
  return extractor(textos);
}

/** Similitud coseno entre dos vectores. Con vectores normalizados equivale al producto punto. */
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
