import type { TenantContext } from './context';

// Se lanza cuando una empresa intenta acceder a un recurso que no le pertenece.
export class TenantAccessError extends Error {
  constructor(public readonly ctx: TenantContext, public readonly resourceCompanyId: string) {
    super(
      `Acceso denegado: la empresa ${ctx.companyId} intentó acceder a un recurso de la empresa ${resourceCompanyId}`,
    );
    this.name = 'TenantAccessError';
  }
}

export interface SecurityEvent {
  id: number;
  timestamp: string;
  companyIdSolicitante: string;
  companyIdRecurso: string;
  usuario: string;
  detalle: string;
}

// Log de seguridad global e inmutable: simula un registro centralizado (tipo SIEM)
// que sobrevive aunque la sesión de la empresa atacante cierre sesión, a diferencia
// del auditLog de la UI que es solo por sesión.
let securityCounter = 0;
let securityAuditLog: SecurityEvent[] = [];

function logSecurityEvent(ctx: TenantContext, resourceCompanyId: string, detalle: string): void {
  securityAuditLog.push({
    id: ++securityCounter,
    timestamp: new Date().toISOString(),
    companyIdSolicitante: ctx.companyId,
    companyIdRecurso: resourceCompanyId,
    usuario: ctx.usuario,
    detalle,
  });
}

export function getSecurityAuditLog(): readonly SecurityEvent[] {
  return securityAuditLog;
}

// Uso exclusivo en pruebas: limpia el log de seguridad global entre tests.
export function resetSecurityAuditLog(): void {
  securityAuditLog = [];
  securityCounter = 0;
}

// Guard central: toda operación sobre un recurso perteneciente a una empresa
// debe pasar por aquí antes de leer o modificar datos. Si el companyId del
// contexto de sesión no coincide con el dueño del recurso, se registra el
// intento como evento de seguridad y se deniega lanzando TenantAccessError.
export function assertTenantAccess(
  ctx: TenantContext,
  resourceCompanyId: string,
  detalle = 'Intento de acceso no autorizado a recurso de otra empresa',
): void {
  if (ctx.companyId !== resourceCompanyId) {
    logSecurityEvent(ctx, resourceCompanyId, detalle);
    throw new TenantAccessError(ctx, resourceCompanyId);
  }
}

// Filtra cualquier colección de recursos etiquetados con companyId, dejando
// pasar únicamente los que pertenecen al tenant del contexto activo.
export function filterByTenant<T extends { companyId: string }>(
  ctx: TenantContext,
  records: readonly T[],
): T[] {
  return records.filter(r => r.companyId === ctx.companyId);
}
