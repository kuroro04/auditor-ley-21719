// Descarga (una sola vez) los archivos del modelo de embeddings
// Xenova/all-MiniLM-L6-v2 hacia public/models/, para que el análisis
// semántico se sirva siempre desde el propio proyecto — nunca desde un
// servidor externo en tiempo de ejecución del navegador del usuario.
// Se ejecuta automáticamente en "postinstall" y también está disponible
// como "npm run fetch-model". Si falla (ej. sin conexión), NO rompe la
// instalación: la app sigue funcionando solo con el motor de reglas hasta
// que este script se ejecute con éxito.
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pipeline as streamPipeline } from 'stream/promises';
import { Readable } from 'stream';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/main`;
const DEST_DIR = join(__dirname, '..', 'public', 'models', MODEL_ID);

const ARCHIVOS = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'vocab.txt',
  'onnx/model_quantized.onnx',
];

async function descargarArchivo(nombreRelativo) {
  const destino = join(DEST_DIR, ...nombreRelativo.split('/'));
  if (existsSync(destino)) {
    console.log(`[fetch-embedding-model] ya existe, se omite: ${nombreRelativo}`);
    return;
  }
  mkdirSync(dirname(destino), { recursive: true });
  const url = `${BASE_URL}/${nombreRelativo}`;
  console.log(`[fetch-embedding-model] descargando ${nombreRelativo}...`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`No se pudo descargar ${url} (HTTP ${res.status})`);
  }
  await streamPipeline(Readable.fromWeb(res.body), createWriteStream(destino));
}

async function main() {
  try {
    for (const archivo of ARCHIVOS) {
      await descargarArchivo(archivo);
    }
    console.log('[fetch-embedding-model] modelo de análisis semántico listo en public/models/.');
  } catch (err) {
    console.warn(
      '[fetch-embedding-model] no se pudo descargar el modelo de análisis semántico ' +
      '(revise su conexión a internet). La app seguirá funcionando solo con el motor ' +
      'de reglas hasta que se ejecute "npm run fetch-model" con éxito.',
    );
    console.warn(String(err));
  }
}

main();
