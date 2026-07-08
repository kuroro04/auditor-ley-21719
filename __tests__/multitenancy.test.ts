import { describe, it, expect } from 'vitest';
import { buildCompanyId, createTenantContext } from '../lib/tenant/context';

describe('buildCompanyId', () => {
  it('normaliza el RUT quitando puntos y guion', () => {
    expect(buildCompanyId('12.345.678-9')).toBe('123456789');
  });

  it('es determinístico e insensible al formato de entrada', () => {
    expect(buildCompanyId('12.345.678-9')).toBe(buildCompanyId('123456789'));
  });

  it('pasa a mayúsculas el dígito verificador K', () => {
    expect(buildCompanyId('9.876.543-k')).toBe('9876543K');
  });
});

describe('createTenantContext', () => {
  it('deriva companyId del RUT autenticado, no de un parámetro libre', () => {
    const ctx = createTenantContext('76.123.456-7', 'administrador', 'ana@empresa.cl');
    expect(ctx.companyId).toBe('761234567');
    expect(ctx.role).toBe('administrador');
    expect(ctx.usuario).toBe('ana@empresa.cl');
  });
});
