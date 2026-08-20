import { describe, it, expect, vi, afterEach } from 'vitest';
import { loginUser, registerCompany } from '../lib/api/auth';

afterEach(() => {
  vi.unstubAllGlobals();
});

const DTO = {
  email: 'admin@empresa.cl',
  role: 'administrador',
  company_id: 'c1',
  company_nombre: 'Empresa Test',
  company_sector: 'tecnologia',
};

describe('lib/api/auth', () => {
  it('loginUser convierte snake_case del backend a camelCase', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => DTO }));
    const session = await loginUser('admin@empresa.cl', 'Clave-123!');
    expect(session).toEqual({
      email: 'admin@empresa.cl',
      role: 'administrador',
      companyId: 'c1',
      companyNombre: 'Empresa Test',
      companySector: 'tecnologia',
    });
  });

  it('registerCompany envía nombre_empresa en snake_case al backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => DTO });
    vi.stubGlobal('fetch', fetchMock);
    await registerCompany({
      rut: '11.111.111-1', nombreEmpresa: 'Empresa Test', email: 'admin@empresa.cl',
      password: 'Clave-123!', sector: 'tecnologia',
    });
    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody).toEqual({
      rut: '11.111.111-1', nombre_empresa: 'Empresa Test', email: 'admin@empresa.cl',
      password: 'Clave-123!', sector: 'tecnologia',
    });
  });
});
