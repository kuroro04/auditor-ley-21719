// Descarga (una sola vez) los archivos del modelo de embeddings
// Xenova/all-MiniLM-L6-v2 hacia public/models/, para que el análisis
// semántico se sirva siempre desde el propio proyecto — nunca desde un
// servidor externo en tiempo de ejecución del navegador del usuario.
// Se ejecuta automáticamente en "postinstall" y también está disponible
// como "npm run fetch-model".
//
// Integridad: se descarga un commit EXACTO del repositorio del modelo en
// Hugging Face (nunca `main`, que puede cambiar) y cada archivo se verifica
// contra un SHA-256 fijado acá. Si un hash no coincide, el archivo se borra
// y el script termina con error: un modelo alterado no debe llegar nunca a
// public/models/. Para cambiar de versión, ver "Actualizar el modelo de
// embeddings" en el README.
//
// Sin conexión, en cambio, el script NO rompe la instalación: la app sigue
// funcionando solo con el motor de reglas hasta que este script se ejecute
// con éxito.
import { createHash } from 'crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { pipeline as streamPipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
// Commit de huggingface.co/Xenova/all-MiniLM-L6-v2 (2025-07-22).
export const REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';
export const BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}`;
const DEST_DIR = join(__dirname, '..', 'public', 'models', MODEL_ID);

// SHA-256 de cada archivo en REVISION. El del .onnx coincide con el que
// Hugging Face publica para el objeto LFS; el resto se calculó sobre los
// archivos de ese commit, verificados contra su hash de blob git.
export const ARCHIVOS = [
  { ruta: 'config.json', sha256: '7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7' },
  { ruta: 'tokenizer.json', sha256: 'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0' },
  { ruta: 'tokenizer_config.json', sha256: '9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3' },
  { ruta: 'special_tokens_map.json', sha256: 'b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3' },
  { ruta: 'vocab.txt', sha256: '07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3' },
  { ruta: 'onnx/model_quantized.onnx', sha256: 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1' },
];

export class ErrorDeIntegridad extends Error {
  constructor(ruta, esperado, obtenido) {
    super(`SHA-256 de ${ruta} no coincide: se esperaba ${esperado}, se obtuvo ${obtenido}`);
    this.name = 'ErrorDeIntegridad';
  }
}

async function sha256DeArchivo(ruta) {
  const hash = createHash('sha256');
  for await (const trozo of createReadStream(ruta)) hash.update(trozo);
  return hash.digest('hex');
}

export async function descargarArchivo({ ruta, sha256 }, { destDir = DEST_DIR, fetchImpl = fetch } = {}) {
  const destino = join(destDir, ...ruta.split('/'));

  if (existsSync(destino)) {
    if ((await sha256DeArchivo(destino)) === sha256) {
      console.log(`[fetch-embedding-model] ya existe y está verificado: ${ruta}`);
      return;
    }
    // Otra versión (ej. bajada de `main` antes de fijar la revisión) o un
    // archivo alterado: se descarta y se baja la versión fijada.
    console.warn(`[fetch-embedding-model] ${ruta} existe pero no coincide con la versión fijada; se reemplaza.`);
    rmSync(destino, { force: true });
  }

  mkdirSync(dirname(destino), { recursive: true });
  const url = `${BASE_URL}/${ruta}`;
  const destinoTemporal = destino + '.part';
  console.log(`[fetch-embedding-model] descargando ${ruta}...`);

  try {
    const res = await fetchImpl(url);
    if (!res.ok || !res.body) {
      throw new Error(`No se pudo descargar ${url} (HTTP ${res.status})`);
    }
    // El hash se calcula mientras se escribe el .part; recién si coincide
    // el archivo toma su nombre definitivo.
    const hash = createHash('sha256');
    const calcularHash = new Transform({
      transform(trozo, _enc, cb) { hash.update(trozo); cb(null, trozo); },
    });
    await streamPipeline(Readable.fromWeb(res.body), calcularHash, createWriteStream(destinoTemporal));
    const obtenido = hash.digest('hex');
    if (obtenido !== sha256) throw new ErrorDeIntegridad(ruta, sha256, obtenido);
    renameSync(destinoTemporal, destino);
  } finally {
    // Nunca queda un archivo a medias ni uno que no pasó la verificación.
    rmSync(destinoTemporal, { force: true });
  }
}

// Devuelve el código de salida: 1 si algún archivo no pasó la verificación
// de integridad, 0 en cualquier otro caso (incluido "sin conexión").
export async function main({ archivos = ARCHIVOS, destDir = DEST_DIR, fetchImpl = fetch } = {}) {
  try {
    for (const archivo of archivos) {
      await descargarArchivo(archivo, { destDir, fetchImpl });
    }
    console.log('[fetch-embedding-model] modelo de análisis semántico listo y verificado en public/models/.');
    return 0;
  } catch (err) {
    if (err instanceof ErrorDeIntegridad) {
      console.error(
        '[fetch-embedding-model] ERROR DE INTEGRIDAD: un archivo del modelo no coincide con su ' +
        'SHA-256 fijado y fue descartado. No se instaló el modelo alterado.',
      );
      console.error(String(err));
      return 1;
    }
    console.warn(
      '[fetch-embedding-model] no se pudo descargar el modelo de análisis semántico ' +
      '(revise su conexión a internet). La app seguirá funcionando solo con el motor ' +
      'de reglas hasta que se ejecute "npm run fetch-model" con éxito.',
    );
    console.warn(String(err));
    return 0;
  }
}

// Solo corre al ejecutarse como script (node scripts/fetch-embedding-model.mjs),
// no al importarse desde los tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
