'use client';
import { type ReactNode } from 'react';
import type { AuditEvent, UserRole } from '@/lib/types';
import type { SecurityEvent } from '@/lib/tenant/guard';
import { exportarAuditoriaCSV, exportarAuditoriaJSON } from '@/lib/auditExport';

interface RegistroViewProps {
  auditLog: AuditEvent[];
  securityEvents: SecurityEvent[];
  companyName?: string;
  companyId?: string;
  onToast?: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}

const ROLE_COLORS: Record<UserRole, string> = {
  administrador: 'role-admin',
  auditor: 'role-auditor',
  visualizador: 'role-viewer',
};

const ACCION_ICONS: Record<AuditEvent['accion'], ReactNode> = {
  'subió documento': (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  'ejecutó análisis': (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.35-4.35"/>
      <line x1="11" y1="8" x2="11" y2="14"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  'descargó informe': (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  'eliminó documento': (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  'documento rechazado': (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
};

function formatTs(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' }),
    time: d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

export default function RegistroView({
  auditLog,
  securityEvents,
  companyName,
  companyId,
  onToast,
}: RegistroViewProps) {
  return (
    <div className="registro-view">
      <div className="registro-hdr">
        <div>
          <h2>Registro de auditoría</h2>
          <p>Historial de acciones y trazabilidad de su empresa</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="registro-count">{auditLog.length} evento{auditLog.length !== 1 ? 's' : ''}</div>
          {auditLog.length > 0 && (
            <>
              <button
                type="button"
                className="btn-export-audit"
                onClick={() => {
                  exportarAuditoriaCSV(auditLog, companyName || 'empresa');
                  onToast?.('Registro de auditoría descargado en CSV', 'green');
                }}
                title="Descargar eventos en formato CSV para Microsoft Excel"
              >
                📥 Exportar CSV
              </button>
              <button
                type="button"
                className="btn-export-audit btn-export-audit--json"
                onClick={() => {
                  exportarAuditoriaJSON(auditLog, securityEvents, companyName || 'empresa', companyId);
                  onToast?.('Registro de auditoría descargado en JSON (SHA-256)', 'green');
                }}
                title="Descargar trazabilidad criptográfica estructurada en JSON para compliance"
              >
                📥 Exportar JSON
              </button>
            </>
          )}
        </div>
      </div>

      {auditLog.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
          </div>
          <div className="empty-state-title">Sin eventos registrados</div>
          <div className="empty-state-sub">Las acciones de su empresa aparecerán aquí automáticamente</div>
        </div>
      ) : (
        <div className="registro-table-wrap">
          <table className="registro-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Acción</th>
                <th>Archivo</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map(ev => {
                const { date, time } = formatTs(ev.timestamp);
                return (
                  <tr key={ev.id}>
                    <td className="registro-id">{ev.id}</td>
                    <td className="registro-date">{date}</td>
                    <td className="registro-time">{time}</td>
                    <td className="registro-user">{ev.usuario}</td>
                    <td>
                      <span className={`registro-role ${ROLE_COLORS[ev.rol]}`}>
                        {ev.rol}
                      </span>
                    </td>
                    <td className="registro-accion">
                      <span className="registro-accion-icon">{ACCION_ICONS[ev.accion]}</span>
                      {ev.accion}
                    </td>
                    <td className="registro-archivo">
                      {ev.archivo
                        ? (
                          <span className="registro-filename">
                            {ev.archivo}
                            {ev.detalle && (
                              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{ev.detalle}</div>
                            )}
                          </span>
                        )
                        : <span className="registro-na">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Eventos de seguridad: intentos detectados de acceso cruzado entre empresas */}
      <div className="registro-security-section">
        <h3>Eventos de seguridad — aislamiento multi-tenant</h3>
        <p>
          Intentos detectados de acceder a un recurso de otra empresa. El sistema los bloquea
          automáticamente en el momento en que ocurren (ver <code>lib/tenant/guard.ts</code>).
        </p>
        {securityEvents.length === 0 ? (
          <div className="registro-security-empty">
            Sin intentos de acceso cruzado detectados en esta sesión.
          </div>
        ) : (
          <div className="registro-table-wrap">
            <table className="registro-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Usuario</th>
                  <th>Empresa solicitante</th>
                  <th>Empresa del recurso</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {securityEvents.map(ev => {
                  const { date, time } = formatTs(ev.timestamp);
                  return (
                    <tr key={ev.id} className="registro-row--security">
                      <td className="registro-id">{ev.id}</td>
                      <td className="registro-date">{date}</td>
                      <td className="registro-time">{time}</td>
                      <td className="registro-user">{ev.usuario}</td>
                      <td>{ev.companyIdSolicitante}</td>
                      <td>{ev.companyIdRecurso}</td>
                      <td>{ev.detalle}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="registro-footer">
        Este registro es local a su sesión actual y no persiste al cerrar sesión.
      </p>
    </div>
  );
}
