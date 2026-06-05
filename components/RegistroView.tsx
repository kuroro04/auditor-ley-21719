'use client';
import type { AuditEvent, UserRole } from '@/lib/types';

interface RegistroViewProps {
  auditLog: AuditEvent[];
}

const ROLE_COLORS: Record<UserRole, string> = {
  administrador: 'role-admin',
  auditor: 'role-auditor',
  visualizador: 'role-viewer',
};

const ACCION_ICONS: Record<AuditEvent['accion'], string> = {
  'subió documento':   '⬆',
  'ejecutó análisis':  '🔬',
  'descargó informe':  '📊',
  'eliminó documento': '🗑',
};

function formatTs(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' }),
    time: d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

export default function RegistroView({ auditLog }: RegistroViewProps) {
  return (
    <div className="registro-view">
      <div className="registro-hdr">
        <div>
          <h2>Registro de auditoría</h2>
          <p>Historial de todas las acciones realizadas en esta sesión</p>
        </div>
        <div className="registro-count">{auditLog.length} evento{auditLog.length !== 1 ? 's' : ''}</div>
      </div>

      {auditLog.length === 0 ? (
        <div className="registro-empty">
          <div className="registro-empty-icon">📋</div>
          <div className="registro-empty-title">Sin eventos registrados</div>
          <div className="registro-empty-sub">Las acciones de esta sesión aparecerán aquí</div>
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
                        ? <span className="registro-filename">{ev.archivo}</span>
                        : <span className="registro-na">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="registro-footer">
        Este registro es local a su sesión actual y no persiste al cerrar sesión.
      </p>
    </div>
  );
}
