import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// Self-host the PDF.js worker — removes the unpkg.com CDN dependency.
// pdfjs-dist 4.x+ ships the worker as .mjs (ESM). The legacy .js is gone.
try {
  const src = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
  const destDir = resolve(__dirname, 'public');
  const dest = resolve(destDir, 'pdf.worker.min.mjs');
  if (!existsSync(destDir)) mkdirSync(destDir);
  copyFileSync(src, dest);
} catch {
  // node_modules not yet installed; the copy will succeed on next dev/build
}

// Self-host el motor WASM de onnxruntime-web (lo usa @xenova/transformers para
// el análisis semántico). Por defecto onnxruntime-web lo descarga desde
// cdn.jsdelivr.net en el navegador: eso viola el principio de "cero llamadas de
// red externas" del producto y además el CSP de la app lo bloquea, con lo cual
// el modelo nunca cargaría. Se copian solo las variantes NO threaded: el
// runtime se fuerza a single-thread en lib/semantic/embeddingModel.ts, porque
// la variante threaded exige SharedArrayBuffer (headers COOP/COEP que esta app
// no configura).
try {
  const ortDestDir = resolve(__dirname, 'public/ort');
  if (!existsSync(ortDestDir)) mkdirSync(ortDestDir, { recursive: true });
  for (const archivo of ['ort-wasm.wasm', 'ort-wasm-simd.wasm']) {
    copyFileSync(
      resolve(__dirname, 'node_modules/onnxruntime-web/dist', archivo),
      resolve(ortDestDir, archivo),
    );
  }
} catch {
  // node_modules not yet installed; the copy will succeed on next dev/build
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone' genera un directorio .next/standalone listo para
  // copiar en el Dockerfile.frontend sin node_modules completos.
  output: 'standalone',
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-eval' reemplazado por 'wasm-unsafe-eval': solo permite
              // ejecutar WebAssembly (onnxruntime-web, @xenova/transformers),
              // no eval() ni new Function() de código JavaScript arbitrario.
              // 'unsafe-inline' es necesario para los <script> inline que
              // Next.js inyecta para __NEXT_DATA__ y la hidratación del cliente;
              // eliminarlo requeriría implementar un sistema de nonces CSP en
              // el servidor de Next.js, lo que queda fuera del alcance de esta fase.
              "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' https://fonts.gstatic.com",
              `connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com ${API_URL}`,
              "img-src 'self' data: blob:",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  webpack: (config) => {
    config.resolve.alias.canvas = false;
    // @xenova/transformers: evitar que webpack intente resolver dependencias
    // opcionales de Node (sharp, backends nativos) que no existen en el navegador.
    config.resolve.alias.sharp$ = false;
    // El backend nativo de Node de onnxruntime nunca se usa en el navegador
    // (ahí corre el backend wasm de onnxruntime-web); sin este alias, webpack
    // intenta bundlear sus binarios .node de todas las plataformas y falla el build.
    config.resolve.alias['onnxruntime-node$'] = false;
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    return config;
  },
};

export default nextConfig;
