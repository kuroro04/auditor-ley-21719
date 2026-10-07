import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiRequest, ApiError } from '../lib/api/client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('devuelve el JSON parseado cuando la respuesta es ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ hello: 'world' }),
    }));
    const data = await apiRequest<{ hello: string }>('/ping');
    expect(data).toEqual({ hello: 'world' });
  });

  it('lanza ApiError con el "detail" del backend cuando la respuesta falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 409, json: async () => ({ detail: 'Ese correo ya está registrado' }),
    }));
    await expect(apiRequest('/auth/register', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ message: 'Ese correo ya está registrado', status: 409 });
    await expect(apiRequest('/auth/register', { method: 'POST', body: {} }))
      .rejects.toBeInstanceOf(ApiError);
  });

  it('expone el "codigo" de rechazo del backend cuando viene en la respuesta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400, json: async () => ({ detail: 'Amenaza detectada', codigo: 'firma_detectada' }),
    }));
    await expect(apiRequest('/documents/upload', { method: 'POST', body: new FormData() }))
      .rejects.toMatchObject({ status: 400, code: 'firma_detectada' });
  });

  it('siempre incluye credentials:"include" para que viaje la cookie de sesión', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/auth/me');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('devuelve undefined en respuestas 204 sin body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => { throw new Error('no body'); } }));
    const data = await apiRequest('/auth/logout', { method: 'POST' });
    expect(data).toBeUndefined();
  });
});
