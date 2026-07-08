import type { UserRole } from '../types';

// Contexto de tenant (empresa) derivado siempre de la sesión autenticada.
// El companyId nunca se construye a partir de un parámetro que el cliente
// pueda modificar en una llamada individual: solo sale de createTenantContext,
// invocado en el login con el RUT ya validado por el formulario.
export interface TenantContext {
  companyId: string;
  companyName: string;
  role: UserRole;
  usuario: string;
}

// Normaliza el RUT a un identificador de empresa estable:
// sin puntos, guion ni espacios, en mayúsculas.
export function buildCompanyId(rut: string): string {
  return rut.replace(/[.\-\s]/g, '').toUpperCase();
}

export function createTenantContext(rut: string, role: UserRole, usuario: string): TenantContext {
  return {
    companyId: buildCompanyId(rut),
    companyName: rut,
    role,
    usuario,
  };
}
