# DataShield — Ley 21.719

Plataforma de diagnóstico de cumplimiento de la Ley 21.719 (protección de
datos personales, Chile). El análisis de documentos (motor de reglas +
capa semántica) corre 100% en el navegador. Desde la Fase 2, el registro
de empresas, el login y la recepción de documentos los maneja un backend
real (FastAPI), ver `backend/README.md`.

## Levantar todo en desarrollo

Se necesitan dos procesos corriendo a la vez, en dos terminales distintas.

**Terminal 1 — backend (puerto 8000):**

```bash
cd backend
python -m venv venv
venv\Scripts\Activate.ps1   # PowerShell; en bash: source venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend (puerto 3000):**

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`. El frontend habla con el backend en
`http://localhost:8000` (configurable con `NEXT_PUBLIC_API_URL`).

## Tests

```bash
npm test                        # frontend (Vitest)
cd backend && python -m pytest  # backend (pytest)
```

## Modelo de embeddings (análisis semántico)

La capa semántica usa `Xenova/all-MiniLM-L6-v2`, autohospedado en
`public/models/` (no se versiona en git). `npm install` lo descarga con
`scripts/fetch-embedding-model.mjs`; también se puede correr a mano con
`npm run fetch-model`.

El script descarga un commit exacto del repositorio del modelo (`REVISION`)
y verifica cada archivo contra el SHA-256 fijado en `ARCHIVOS`:

- **Hash correcto:** el archivo queda en `public/models/`.
- **Hash distinto:** el archivo se borra y el script termina con código 1,
  lo que también hace fallar `npm install`. Es intencional: un modelo
  alterado no debe instalarse en silencio.
- **Archivo ya existente con otro hash** (por ejemplo, bajado antes de
  fijar la revisión): se descarta y se baja la versión fijada.
- **Sin conexión:** solo muestra un aviso y termina con código 0. La app
  funciona solo con el motor de reglas hasta que el script se corra con
  éxito.

### Actualizar el modelo de embeddings

Para pasar a otro commit del mismo modelo (o a otro modelo):

1. **Elegir el commit.** El último está en el campo `sha` de
   `https://huggingface.co/api/models/Xenova/all-MiniLM-L6-v2`, y el
   historial en la pestaña *Files and versions* del repositorio. Usar
   siempre el hash de 40 caracteres, nunca `main`.

2. **Listar los archivos del commit** con sus metadatos:

   ```bash
   REV=<hash-del-commit>
   curl -s "https://huggingface.co/api/models/Xenova/all-MiniLM-L6-v2/tree/$REV?recursive=true"
   ```

   Para archivos LFS (el `.onnx`), `lfs.oid` es su SHA-256. Para los
   demás, `oid` es el hash de blob git (SHA-1), no el SHA-256.

3. **Descargar cada archivo de esa revisión** en una carpeta temporal y
   calcular su SHA-256:

   ```bash
   mkdir -p /tmp/modelo/onnx && cd /tmp/modelo
   for f in config.json tokenizer.json tokenizer_config.json \
            special_tokens_map.json vocab.txt onnx/model_quantized.onnx; do
     curl -sSL --fail -o "$f" "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/$REV/$f"
     sha256sum "$f"
   done
   ```

   En PowerShell: `Get-FileHash -Algorithm SHA256 <archivo>`.

4. **Comprobar que lo descargado es lo que está en el commit**, antes de
   confiar en esos hashes:
   - `.onnx`: su SHA-256 tiene que ser igual a `lfs.oid` del paso 2.
   - Los demás: `git hash-object --no-filters <archivo>` tiene que dar el
     `oid` del paso 2.

5. **Actualizar `scripts/fetch-embedding-model.mjs`:** `REVISION`, el
   comentario con la fecha del commit y el `sha256` de cada entrada de
   `ARCHIVOS`. Si el modelo nuevo trae archivos distintos, agregarlos o
   quitarlos de esa lista.

6. **Reinstalar y probar:**

   ```bash
   rm -rf public/models/Xenova/all-MiniLM-L6-v2   # fuerza la descarga nueva
   npm run fetch-model                           # debe terminar "listo y verificado"
   npm test
   ```

7. **Recalibrar si cambia el modelo**, no solo el commit. El umbral
   `UMBRAL_SIMILITUD_SEMANTICA` (0.5) y `UMBRAL_SIMILITUD_ALTA` (0.65) de
   `lib/semantic/semanticMatcher.ts` se midieron contra este modelo. Con
   otro modelo hay que volver a medirlos contra documentos reales antes
   de publicar.

## Vulnerabilidades conocidas en dependencias

Evaluación hecha el 2026-10-06, al integrar la rama `analisis-semantico`.
`npm audit --omit=dev` reporta 19 vulnerabilidades: 14 ya existían en
`master` y 5 entran con `@xenova/transformers@2.17.2`, todas por la misma
cadena:

```
@xenova/transformers@2.17.2
├─┬ onnxruntime-web@1.14.0
│ └─┬ onnx-proto@4.0.4
│   └── protobufjs@6.11.6   (crítica)
└── sharp@0.32.6            (alta)
```

| Paquete | Severidad | Origen | ¿Explotable aquí? |
|---|---|---|---|
| `protobufjs` | crítica | advisories propios (ver abajo) | No, en el flujo actual |
| `onnx-proto` | alta | hereda de `protobufjs` | No (misma razón) |
| `onnxruntime-web` | alta | hereda de `onnx-proto` | No (misma razón) |
| `sharp` | alta | libvips, libheif, librsvg | No: fuera del bundle de cliente |
| `@xenova/transformers` | alta | hereda de `onnxruntime-web` y `sharp` | No |

La corrección que propone `npm audit fix --force` es bajar
`@xenova/transformers` a 1.4.2, un cambio mayor que rompe la capa
semántica. No se aplica.

### protobufjs

Los advisories (GHSA-xq3m-2v4x-88gg, GHSA-66ff-xgx4-vchm, GHSA-fx83-v9x8-x52w
y otros) caen en dos grupos:

- **Generación de código y ejecución arbitraria**: se disparan cuando
  protobufjs carga un *schema* no confiable (`.proto` o descriptor JSON) y
  genera código a partir de él. `onnx-proto` trae código estático ya
  generado para el schema fijo de ONNX; nunca carga schemas en tiempo de
  ejecución.
- **Denegación de servicio y decodificación** (recursión sin límite, UTF-8
  mal formado): se disparan al decodificar un mensaje binario manipulado.

En esta app, lo único que podría pasar por protobufjs es el archivo del
modelo (`public/models/.../model_quantized.onnx`). Los documentos de los
usuarios nunca llegan ahí: se convierten en texto, se tokenizan y entran
al modelo como tensores. Y ni siquiera el modelo pasa por protobufjs en
el navegador: transformers.js usa solo el backend `wasm`
(`executionProviders = ['wasm']`), que parsea el modelo con el protobuf
C++ compilado dentro del WASM de onnxruntime. El código de protobufjs
está en el bundle (lo usa el backend WebGL de `onnxruntime-web`, que aquí
no se activa), pero no se ejecuta.

**Condición para que esto siga valiendo:** el archivo del modelo tiene que
ser confiable. `scripts/fetch-embedding-model.mjs` lo descarga desde un
commit fijo de Hugging Face (no desde `main`) y verifica el SHA-256 de cada
archivo. Si un hash no coincide, borra el archivo y termina con error. Ver
[Actualizar el modelo de embeddings](#actualizar-el-modelo-de-embeddings).

### sharp

transformers.js usa `sharp` solo en Node, para procesar imágenes;
este proyecto no procesa imágenes con el modelo. En el navegador no se
usa: `next.config.mjs` lo excluye del bundle con
`config.resolve.alias.sharp$ = false`. Verificado con `next build`: ningún
chunk de `.next/static` contiene `sharp` ni `libvips`.

Sigue instalado en `node_modules` como dependencia transitiva, y Next.js
lo usa si existe para optimizar imágenes en `/_next/image`. Este proyecto
no usa `next/image` ni configura `images.remotePatterns`, así que ese
endpoint solo podría procesar imágenes estáticas del propio proyecto,
nunca archivos subidos por usuarios.

### Cuándo revisar esto de nuevo

- Si se activa el backend WebGL o WebGPU de onnxruntime, o se actualiza
  `@xenova/transformers` (o se migra a `@huggingface/transformers`).
- Si se empieza a usar `next/image` con imágenes remotas o de usuarios.
- Si el modelo pasa a cargarse desde otro origen que no sea `public/models/`.
