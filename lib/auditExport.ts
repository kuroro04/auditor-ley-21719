'use client';

import type { AuditEvent } from './types';
import type { SecurityEvent } from './tenant/guard';

export function exportarAuditoriaCSV(auditLog: AuditEvent[], companyName: string): void {
  const headers = ['ID', 'Fecha', 'Hora', 'Usuario', 'Rol', 'Acción', 'Archivo', 'Detalle'];
  const rows = auditLog.map(ev => {
    const d = new Date(ev.timestamp);
    const date = d.toLocaleDateString('es-CL');
    const time = d.toLocaleTimeString('es-CL');
    const escape = (s: string | undefined) => `"${(s ?? '').replace(/"/g, '""')}"`;
    return [
      ev.id,
      escape(date),
      escape(time),
      escape(ev.usuario),
      escape(ev.rol),
      escape(ev.accion),
      escape(ev.archivo ?? '—'),
      escape(ev.detalle ?? ''),
    ].join(';');
  });

  // \uFEFF es el BOM UTF-8 para que Microsoft Excel en español reconozca caracteres con acento y eñes
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const sanitizedCompany = companyName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'empresa';
  const fechaStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `auditoria_${sanitizedCompany}_${fechaStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportarAuditoriaJSON(
  auditLog: AuditEvent[],
  securityEvents: SecurityEvent[],
  companyName: string,
  companyId?: string,
): void {
  const exportPayload = {
    sistema: 'DataShield — Auditor Ley 21.719',
    normativa: 'Ley N° 21.719 sobre Protección de Datos Personales (Chile)',
    version_esquema: '1.0.0',
    exportado_el: new Date().toISOString(),
    empresa: {
      nombre: companyName,
      identificador_tenant: companyId || 'N/A',
    },
    resumen: {
      total_eventos_auditoria: auditLog.length,
      total_eventos_seguridad_multitenant: securityEvents.length,
      estado_trazabilidad: 'Criptográficamente inmutable — SHA-256',
    },
    eventos_auditoria: auditLog,
    eventos_seguridad_multitenant: securityEvents,
  };

  const jsonContent = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const sanitizedCompany = companyName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'empresa';
  const fechaStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `trazabilidad_auditoria_${sanitizedCompany}_${fechaStr}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
