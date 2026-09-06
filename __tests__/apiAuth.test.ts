import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  completeOnboarding,
  loginUser,
  loginWithMfa,
  mfaActivate,
  mfaDisable,
  mfaSetup,
  registerCompany,
} from '../lib/api/auth';

afterEach(() => {
  vi.unstubAllGlobals();
});

const DTO = {
  email: 'admin@empresa.cl',
  role: 'administrador',
  company_id: 'c1',
  company_nombre: 'Empresa Test',
  company_sector: 'tecnologia',
  onboarding_completed: false,
  mfa_enabled: false,
};

describe('lib/api/auth', () => {
  it('loginUser convierte snake_case del backend a camelCase', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => DTO }));
    const res = await loginUser('admin@empresa.cl', 'Clave-123!');
    expect(res).toEqual({
      mfaRequired: false,
      session: {
        email: 'admin@empresa.cl',
        role: 'administrador',
        companyId: 'c1',
        companyNombre: 'Empresa Test',
        companySector: 'tecnologia',
        onboardingCompleted: false,
        mfaEnabled: false,
      },
    });
  });

  it('loginUser detecta el desafío MFA y devuelve el token corto sin sesión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ mfa_required: true, mfa_token: 'tok-corto' }),
    }));
    const res = await loginUser('admin@empresa.cl', 'Clave-123!');
    expect(res).toEqual({ mfaRequired: true, mfaToken: 'tok-corto' });
  });

  it('loginWithMfa postea mfa_token + code y devuelve la sesión', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => DTO });
    vi.stubGlobal('fetch', fetchMock);
    const session = await loginWithMfa('tok-corto', '123456');
    expect(session.email).toBe('admin@empresa.cl');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/auth/login/mfa');
    expect(JSON.parse(init.body as string)).toEqual({ mfa_token: 'tok-corto', code: '123456' });
  });

  it('mfaSetup mapea otpauth_uri / secret_base32 / qr_svg a camelCase', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({
        otpauth_uri: 'otpauth://totp/x', secret_base32: 'ABCD2345', qr_svg: 'data:image/svg+xml;base64,zzz',
      }),
    }));
    const info = await mfaSetup();
    expect(info).toEqual({ otpauthUri: 'otpauth://totp/x', secretBase32: 'ABCD2345', qrSvg: 'data:image/svg+xml;base64,zzz' });
  });

  it('mfaActivate envía el código y devuelve los códigos de respaldo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ backup_codes: ['AAA', 'BBB'] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const codes = await mfaActivate('123456');
    expect(codes).toEqual(['AAA', 'BBB']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/auth/mfa/activate');
    expect(JSON.parse(init.body as string)).toEqual({ code: '123456' });
  });

  it('mfaDisable postea la confirmación (password o código)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => undefined });
    vi.stubGlobal('fetch', fetchMock);
    await mfaDisable({ password: 'Clave-123!' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/auth/mfa/disable');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ password: 'Clave-123!' });
  });

  it('completeOnboarding llama al endpoint correcto por POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => undefined });
    vi.stubGlobal('fetch', fetchMock);
    await completeOnboarding();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/auth/complete-onboarding');
    expect(init.method).toBe('POST');
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
