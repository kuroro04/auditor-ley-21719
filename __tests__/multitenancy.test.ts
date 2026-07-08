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

import {
  assertTenantAccess,
  filterByTenant,
  getSecurityAuditLog,
  resetSecurityAuditLog,
  TenantAccessError,
} from '../lib/tenant/guard';

describe('assertTenantAccess', () => {
  const empresaA = createTenantContext('11.111.111-1', 'administrador', 'admin@a.cl');
  const empresaB = createTenantContext('22.222.222-2', 'administrador', 'admin@b.cl');

  it('permite el acceso cuando el recurso pertenece a la misma empresa', () => {
    resetSecurityAuditLog();
    expect(() => assertTenantAccess(empresaA, empresaA.companyId)).not.toThrow();
  });

  it('rechaza el acceso cuando el recurso pertenece a otra empresa', () => {
    resetSecurityAuditLog();
    expect(() => assertTenantAccess(empresaB, empresaA.companyId)).toThrow(TenantAccessError);
  });

  it('registra el intento denegado en el log de seguridad global', () => {
    resetSecurityAuditLog();
    try {
      assertTenantAccess(empresaB, empresaA.companyId);
    } catch {
      // esperado: la aserción del test siguiente valida el registro
    }
    const log = getSecurityAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].companyIdSolicitante).toBe(empresaB.companyId);
    expect(log[0].companyIdRecurso).toBe(empresaA.companyId);
  });
});

describe('filterByTenant', () => {
  it('nunca deja pasar recursos de otra empresa aunque estén mezclados', () => {
    const empresaA = createTenantContext('11.111.111-1', 'administrador', 'admin@a.cl');
    const mixed = [
      { id: 1, companyId: empresaA.companyId },
      { id: 2, companyId: 'OTRAEMPRESA' },
      { id: 3, companyId: empresaA.companyId },
    ];
    const result = filterByTenant(empresaA, mixed);
    expect(result.map(r => r.id)).toEqual([1, 3]);
  });
});

import { getDocument, listDocuments, resetRepository, saveDocument } from '../lib/tenant/repository';

describe('tenantRepository', () => {
  const empresaA = createTenantContext('11.111.111-1', 'administrador', 'admin@a.cl');
  const empresaB = createTenantContext('22.222.222-2', 'administrador', 'admin@b.cl');
  const doc = { name: 'politica_privacidad.pdf', text: 'contenido confidencial de empresa A' };

  it('una empresa puede guardar y leer su propio documento', () => {
    resetRepository();
    saveDocument(empresaA, 'req-1', doc);
    expect(getDocument(empresaA, empresaA.companyId, 'req-1')).toEqual(doc);
  });

  it('rechaza que la empresa B lea un documento de la empresa A (acceso cruzado)', () => {
    resetRepository();
    saveDocument(empresaA, 'req-1', doc);
    expect(() => getDocument(empresaB, empresaA.companyId, 'req-1')).toThrow(TenantAccessError);
  });

  it('el intento de acceso cruzado queda registrado en el log de seguridad', () => {
    resetRepository();
    resetSecurityAuditLog();
    saveDocument(empresaA, 'req-1', doc);
    try {
      getDocument(empresaB, empresaA.companyId, 'req-1');
    } catch {
      // esperado
    }
    const log = getSecurityAuditLog();
    expect(
      log.some(e => e.companyIdSolicitante === empresaB.companyId && e.companyIdRecurso === empresaA.companyId),
    ).toBe(true);
  });

  it('listDocuments nunca devuelve documentos de otra empresa', () => {
    resetRepository();
    saveDocument(empresaA, 'req-1', doc);
    saveDocument(empresaB, 'req-2', { name: 'otro.pdf', text: 'contenido de empresa B' });
    const docsDeA = listDocuments(empresaA);
    expect(Object.keys(docsDeA)).toEqual(['req-1']);
  });
});
