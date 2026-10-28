import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// script-src difiere entre desarrollo y producción:
// - Producción: 'wasm-unsafe-eval' solo permite compilar WebAssembly
//   (onnxruntime-web, @xenova/transformers); eval() y new Function() de código
//   JavaScript quedan bloqueados.
// - Desarrollo (`next dev`): el Fast Refresh de Next.js
//   (@next/react-refresh-utils) y los bundles de webpack en modo dev ejecutan
//   módulos con eval(). Sin 'unsafe-eval' el navegador lo rechaza, React no se
//   hidrata y ningún botón responde. Por eso en dev se añade 'unsafe-eval'; ese
//   código nunca llega al build de producción, que no lo necesita.
// 'unsafe-inline' es necesario en ambos para los <script> inline que Next.js
// inyecta para __NEXT_DATA__ y la hidratación del cliente; eliminarlo
// requeriría implementar un sistema de nonces CSP en el servidor de Next.js,
// lo que queda fuera del alcance de esta fase.
const isDev = process.env.NODE_ENV !== 'production';
const SCRIPT_SRC = isDev
  ? "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline'"
  : "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'";

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

  // El optimizador de imágenes queda deshabilitado de forma explícita: la app no
  // usa next/image en ninguna pantalla y el endpoint /_next/image es la
  // superficie de las dos RCE conocidas de Next 14 (AVIF GHSA-2xp9-vwfh-vxw4,
  // SVG GHSA-2464-fhr4-w9xw) y de los DoS de caché de imágenes. Apagarlo elimina
  // esa ruta en vez de depender de que nadie la invoque.
  images: { unoptimized: true },

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
              // Condicional según NODE_ENV; ver SCRIPT_SRC al inicio del archivo.
              SCRIPT_SRC,
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
