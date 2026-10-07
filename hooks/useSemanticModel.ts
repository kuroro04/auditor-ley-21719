'use client';
import { useSyncExternalStore } from 'react';
import { getModelStatus, subscribeModelStatus, type EstadoModelo } from '@/lib/semantic/embeddingModel';

/**
 * Expone el estado del modelo de embeddings a la UI (para un indicador
 * discreto), sin bloquear el render. No dispara la carga por sí solo —
 * eso lo hace preloadEmbeddingModel() desde app/page.tsx apenas monta la app.
 */
export function useSemanticModel(): EstadoModelo {
  return useSyncExternalStore(subscribeModelStatus, getModelStatus, () => 'idle' as EstadoModelo);
}
