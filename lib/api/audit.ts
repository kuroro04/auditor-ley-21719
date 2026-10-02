import { apiRequest } from './client';

// Aviso al backend de operaciones que corren solo en el navegador (diagnóstico
// y exportación del PDF). El servidor no puede verificar que ocurrieron: el
// registro depende de que este código lo envíe. Ver la limitación completa
// en backend/routers/client_events.py.
export type ClientAuditEvent = 'diagnostico_ejecutado' | 'exportacion_resultados';

export async function reportClientEvent(evento: ClientAuditEvent): Promise<void> {
  await apiRequest<void>('/audit/client-events', { method: 'POST', body: { evento } });
}
