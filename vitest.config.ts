import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

// Alias `@/` igual que en tsconfig.json, para poder testear módulos que lo
// usan (ej. hooks/useAppState.ts). El entorno por defecto sigue siendo node;
// los tests que necesitan DOM lo piden con `// @vitest-environment jsdom`.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
