// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportarAuditoriaCSV, exportarAuditoriaJSON } from '@/lib/auditExport';
import type { AuditEvent } from '@/lib/types';
import type { SecurityEvent } from '@/lib/tenant/guard';

describe('auditExport — Exportación de registros de auditoría', () => {
  let createdBlob: Blob | null = null;
  let clicked = false;
  let downloadedFileName = '';

  beforeEach(() => {
    createdBlob = null;
    clicked = false;
    downloadedFileName = '';

    globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
      createdBlob = blob;
      return 'blob:mock-url';
    });
    globalThis.URL.revokeObjectURL = vi.fn();

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = {
        tagName,
        href: '',
        setAttribute: (name: string, value: string) => {
          if (name === 'download') downloadedFileName = value;
        },
        click: () => {
          clicked = true;
        },
      } as unknown as HTMLElement;
      return el;
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
  });

  const mockAudit: AuditEvent[] = [
    {
      id: 1,
      timestamp: '2026-11-03T12:00:00Z',
      usuario: 'admin@empresa.cl',
      rol: 'administrador',
      accion: 'subió documento',
      archivo: 'politica_privacidad.pdf',
      detalle: 'Análisis ejecutado exitosamente',
    },
  ];

  const mockSecurity: SecurityEvent[] = [
    {
      id: 1,
      timestamp: '2026-11-03T12:05:00Z',
      usuario: 'atacante@externo.cl',
      companyIdSolicitante: 'empresa-a',
      companyIdRecurso: 'empresa-b',
      detalle: 'Intento de acceso cruzado bloqueado',
    },
  ];

  it('exportarAuditoriaCSV genera un archivo CSV con BOM UTF-8 y cabeceras correctas', async () => {
    exportarAuditoriaCSV(mockAudit, 'Empresa Demo');
    expect(clicked).toBe(true);
    expect(downloadedFileName).toContain('auditoria_empresa_demo_');
    expect(downloadedFileName.endsWith('.csv')).toBe(true);

    expect(createdBlob).not.toBeNull();
    const text = await (createdBlob as Blob).text();
    expect(text).toContain('ID;Fecha;Hora;Usuario;Rol;Acción;Archivo;Detalle');
    expect(text).toContain('admin@empresa.cl');
    expect(text).toContain('politica_privacidad.pdf');
  });

  it('exportarAuditoriaJSON genera un documento estructurado con metadatos de compliance', async () => {
    exportarAuditoriaJSON(mockAudit, mockSecurity, 'Empresa Demo', '999999999');
    expect(clicked).toBe(true);
    expect(downloadedFileName).toContain('trazabilidad_auditoria_empresa_demo_');
    expect(downloadedFileName.endsWith('.json')).toBe(true);

    expect(createdBlob).not.toBeNull();
    const text = await (createdBlob as Blob).text();
    const parsed = JSON.parse(text);
    expect(parsed.sistema).toContain('DataShield');
    expect(parsed.empresa.nombre).toBe('Empresa Demo');
    expect(parsed.empresa.identificador_tenant).toBe('999999999');
    expect(parsed.resumen.total_eventos_auditoria).toBe(1);
    expect(parsed.resumen.total_eventos_seguridad_multitenant).toBe(1);
    expect(parsed.eventos_auditoria[0].usuario).toBe('admin@empresa.cl');
  });
});
