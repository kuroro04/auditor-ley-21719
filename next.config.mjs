import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Self-host the PDF.js worker — removes the unpkg.com CDN dependency
try {
  const src = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.js');
  const destDir = resolve(__dirname, 'public');
  const dest = resolve(destDir, 'pdf.worker.min.js');
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
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
