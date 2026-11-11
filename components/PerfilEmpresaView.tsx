'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UserRole, Sector, CompanyProfile, TeamMember } from '@/lib/types';
import type { AuthSource } from '@/hooks/useAppState';
import type { SecurityEvent } from '@/lib/tenant/guard';
import {
  getCompanyProfile,
  updateCompanyProfile,
  listTeamMembers,
  createTeamMember,
  updateTeamMemberRole,
  revokeOtherSessions,
} from '@/lib/api/company';

interface PerfilEmpresaViewProps {
  companyName: string;
  companyId: string;
  sector: Sector;
  role: UserRole;
  authSource: AuthSource;
  mfaEnabled: boolean;
  securityEvents: SecurityEvent[];
  onOpenMfa: () => void;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue' | 'red') => void;
}

const SECTORES: { id: Sector; label: string }[] = [
  { id: 'tecnologia', label: 'Tecnología, Software y Telecomunicaciones' },
  { id: 'salud', label: 'Salud, Clínicas y Centros Médicos' },
  { id: 'finanzas', label: 'Finanzas, Seguros y Fintech' },
  { id: 'retail', label: 'Retail, Comercio y Logística' },
  { id: 'otro', label: 'Otros Servicios e Industrias' },
];

export default function PerfilEmpresaView({
  companyName: initialCompanyName,
  companyId,
  sector: initialSector,
  role,
  authSource,
  mfaEnabled,
  securityEvents,
  onOpenMfa,
  onToast,
}: PerfilEmpresaViewProps) {
  const isAdmin = role === 'administrador';
  const isBackend = authSource === 'backend';

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de edición del perfil
  const [editNombre, setEditNombre] = useState(initialCompanyName);
  const [editSector, setEditSector] = useState<string>(initialSector);
  const [savingProfile, setSavingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Estados del modal de agregar usuario
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('visualizador');
  const [creatingUser, setCreatingUser] = useState(false);
  const [addUserError, setAddUserError] = useState('');

  // Cargar datos desde el backend (o usar datos locales en modo demo)
  const cargarDatos = useCallback(async () => {
    if (!isBackend) {
      setProfile({
        id: companyId || '999999999',
        rut: '999999999',
        nombre: initialCompanyName,
        sector: initialSector,
        total_users: 1,
        total_documents: 3,
        created_at: new Date().toISOString(),
      });
      setTeam([
        {
          id: 'local-1',
          email: 'admin@empresa.cl',
          role: role,
          mfa_enabled: mfaEnabled,
          onboarding_completed: true,
          created_at: new Date().toISOString(),
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [compData, usersData] = await Promise.all([
        getCompanyProfile().catch(() => null),
        listTeamMembers().catch(() => []),
      ]);
      if (compData) {
        setProfile(compData);
        setEditNombre(compData.nombre);
        setEditSector(compData.sector || 'tecnologia');
      }
      setTeam(usersData);
    } catch {
      onToast('No se pudieron cargar todos los datos corporativos', 'yellow');
    } finally {
      setLoading(false);
    }
  }, [isBackend, companyId, initialCompanyName, initialSector, role, mfaEnabled, onToast]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (editNombre.trim().length < 2) {
      onToast('El nombre de la empresa debe tener al menos 2 caracteres', 'yellow');
      return;
    }

    setSavingProfile(true);
    try {
      if (isBackend) {
        const updated = await updateCompanyProfile({
          nombre: editNombre.trim(),
          sector: editSector,
        });
        setProfile(updated);
      } else {
        setProfile(prev => prev ? { ...prev, nombre: editNombre.trim(), sector: editSector } : null);
      }
      setIsEditingProfile(false);
      onToast('Perfil de empresa actualizado exitosamente', 'green');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar los datos';
      onToast(msg, 'red');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!isAdmin) return;
    try {
      if (isBackend) {
        await updateTeamMemberRole(userId, newRole);
      }
      setTeam(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      onToast('Rol de usuario actualizado', 'green');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar el rol';
      onToast(msg, 'red');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');
    if (!newUserEmail || !newUserPassword) {
      setAddUserError('Debe ingresar correo y contraseña.');
      return;
    }
    if (newUserPassword.length < 8) {
      setAddUserError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setCreatingUser(true);
    try {
      if (isBackend) {
        const created = await createTeamMember({
          email: newUserEmail.trim(),
          password: newUserPassword,
          role: newUserRole,
        });
        setTeam(prev => [...prev, created]);
      } else {
        const fakeUser: TeamMember = {
          id: `demo-${Date.now()}`,
          email: newUserEmail.trim(),
          role: newUserRole,
          mfa_enabled: false,
          onboarding_completed: false,
          created_at: new Date().toISOString(),
        };
        setTeam(prev => [...prev, fakeUser]);
      }
      setShowAddUserModal(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('visualizador');
      onToast(`Usuario "${newUserEmail}" incorporado al equipo`, 'green');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear el usuario';
      setAddUserError(msg);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!confirm('¿Deseas revocar la sesión en todos los demás dispositivos y navegadores? Tu sesión actual se mantendrá activa.')) {
      return;
    }
    try {
      if (isBackend) {
        await revokeOtherSessions();
      }
      onToast('Se revocaron todas las sesiones en otros navegadores y dispositivos.', 'green');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudieron revocar las sesiones';
      onToast(msg, 'red');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    onToast('Identificador copiado al portapapeles', 'blue');
  };

  return (
    <div className="perfil-empresa-container">
      {/* Encabezado */}
      <div className="perfil-hdr">
        <div>
          <div className="perfil-badge-row">
            <span className="badge-shield-cert">🛡️ Aislamiento RLS Activo</span>
            <span className="badge-shield-cert">🔒 Ley 21.719 — Cifrado AES-256</span>
          </div>
          <h2 className="perfil-title">{profile?.nombre || initialCompanyName}</h2>
          <p className="perfil-subtitle">
            Administración institucional, gobierno de datos, asignación de roles (RBAC) y control de accesos.
          </p>
        </div>

        {isAdmin && !isEditingProfile && (
          <button
            type="button"
            className="btn-perfil-edit"
            onClick={() => setIsEditingProfile(true)}
          >
            ✏️ Editar datos de la empresa
          </button>
        )}
      </div>

      {/* Grid de contenido */}
      <div className="perfil-grid">
        {/* Tarjeta 1: Ficha de Empresa y Datos de Tenant */}
        <div className="perfil-card">
          <div className="perfil-card-hdr">
            <div className="perfil-card-icon">🏢</div>
            <div>
              <h3>Ficha Corporativa e Identidad</h3>
              <p>Parámetros utilizados en los informes ejecutivos y plantillas legales</p>
            </div>
          </div>

          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} className="perfil-form">
              <div className="form-group">
                <label htmlFor="input-empresa-nombre">Razón Social o Nombre de Fantasía</label>
                <input
                  id="input-empresa-nombre"
                  type="text"
                  className="perfil-input"
                  value={editNombre}
                  onChange={e => setEditNombre(e.target.value)}
                  placeholder="Ej: Mi Empresa SpA"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="select-empresa-sector">Sector Económico</label>
                <select
                  id="select-empresa-sector"
                  className="perfil-select"
                  value={editSector}
                  onChange={e => setEditSector(e.target.value)}
                >
                  {SECTORES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="perfil-form-actions">
                <button
                  type="button"
                  className="btn-cancelar"
                  onClick={() => setIsEditingProfile(false)}
                  disabled={savingProfile}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-guardar"
                  disabled={savingProfile}
                >
                  {savingProfile ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          ) : (
            <div className="perfil-info-list">
              <div className="perfil-info-item">
                <span className="info-label">RUT Corporativo:</span>
                <span className="info-val font-mono">{profile?.rut || '—'}</span>
              </div>
              <div className="perfil-info-item">
                <span className="info-label">Razón Social:</span>
                <span className="info-val font-semibold">{profile?.nombre || initialCompanyName}</span>
              </div>
              <div className="perfil-info-item">
                <span className="info-label">Sector Industrial:</span>
                <span className="info-val">
                  {SECTORES.find(s => s.id === (profile?.sector || editSector))?.label || profile?.sector || 'Tecnología'}
                </span>
              </div>
              <div className="perfil-info-item">
                <span className="info-label">ID de Tenant Aislado:</span>
                <div className="info-val-with-copy">
                  <span className="font-mono text-xs">{profile?.id || companyId}</span>
                  <button
                    type="button"
                    className="btn-copy-id"
                    onClick={() => copyToClipboard(profile?.id || companyId)}
                    title="Copiar ID"
                  >
                    📋 Copiar
                  </button>
                </div>
              </div>
              <div className="perfil-info-item">
                <span className="info-label">Métricas de la Empresa:</span>
                <span className="info-val text-sm">
                  👥 {team.length} miembros · 📁 {profile?.total_documents ?? 0} documentos almacenados
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tarjeta 2: Centro de Seguridad de la Cuenta */}
        <div className="perfil-card">
          <div className="perfil-card-hdr">
            <div className="perfil-card-icon">🔐</div>
            <div>
              <h3>Centro de Seguridad y Sesiones</h3>
              <p>Control de autenticación y acceso en dos pasos (2FA / TOTP)</p>
            </div>
          </div>

          <div className="perfil-security-panel">
            <div className="security-item">
              <div>
                <div className="security-item-title">Segundo Factor de Autenticación (2FA / MFA)</div>
                <div className="security-item-desc">
                  Protege tu cuenta con Google Authenticator u otra app TOTP compatible con RFC 6238.
                </div>
              </div>
              <div>
                {mfaEnabled ? (
                  <span className="badge-mfa-on">✓ 2FA Activado</span>
                ) : (
                  <span className="badge-mfa-off">⚠ 2FA Inactivo</span>
                )}
              </div>
            </div>

            <div className="security-actions-row">
              <button
                type="button"
                className="btn-action-sec"
                onClick={onOpenMfa}
              >
                {mfaEnabled ? '⚙️ Gestionar o Desactivar 2FA' : '🚀 Activar Segundo Factor (2FA)'}
              </button>

              <button
                type="button"
                className="btn-action-sec secondary"
                onClick={handleRevokeOtherSessions}
              >
                🚪 Cerrar sesiones en otros dispositivos
              </button>
            </div>

            {/* Aviso de aislamiento */}
            <div className="security-notice">
              <span className="notice-icon">🛡️</span>
              <p>
                <strong>Garantía de Aislamiento Row-Level Security:</strong> Toda transacción está vinculada estrictamente al identificador de tu empresa. Ninguna otra entidad en la plataforma puede acceder a tus documentos o reportes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sección Inferior: Equipo y Control de Accesos (RBAC) */}
      <div className="perfil-card team-card">
        <div className="team-header-row">
          <div>
            <h3>Equipo y Control de Permisos (RBAC)</h3>
            <p>Define quién puede gestionar documentos, auditar cumplimiento o consultar resultados.</p>
          </div>

          {isAdmin && (
            <button
              type="button"
              className="btn-add-user"
              onClick={() => setShowAddUserModal(true)}
            >
              ➕ Agregar Miembro al Equipo
            </button>
          )}
        </div>

        {/* Resumen de permisos por rol */}
        <div className="rbac-legend-grid">
          <div className="rbac-legend-box admin">
            <span className="rbac-badge admin">Administrador</span>
            <p>Acceso total. Puede subir documentos, eliminarlos, invitar usuarios y configurar la empresa.</p>
          </div>
          <div className="rbac-legend-box auditor">
            <span className="rbac-badge auditor">Auditor</span>
            <p>Puede auditar diagnósticos, ver la bitácora completa y descargar informes ejecutivos.</p>
          </div>
          <div className="rbac-legend-box visualizador">
            <span className="rbac-badge visualizador">Visualizador</span>
            <p>Solo lectura. Puede revisar los semáforos de cumplimiento sin descargar ni modificar datos.</p>
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div className="team-table-wrap">
          <table className="team-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol Asignado</th>
                <th>Segundo Factor (2FA)</th>
                <th>Fecha Incorporación</th>
                {isAdmin && <th>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="text-center py-6">
                    Cargando miembros del equipo...
                  </td>
                </tr>
              ) : team.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="text-center py-6 text-gray-500">
                    No se encontraron usuarios registrados.
                  </td>
                </tr>
              ) : (
                team.map(member => (
                  <tr key={member.id}>
                    <td>
                      <div className="user-email-cell">
                        <span className="user-avatar">👤</span>
                        <div>
                          <strong>{member.email}</strong>
                          {member.onboarding_completed && (
                            <span className="user-tour-ok" title="Completó inducción">✓</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`rbac-badge ${member.role}`}>
                        {member.role === 'administrador' ? 'Administrador' : member.role === 'auditor' ? 'Auditor' : 'Visualizador'}
                      </span>
                    </td>
                    <td>
                      {member.mfa_enabled ? (
                        <span className="badge-pill green">✓ Activo</span>
                      ) : (
                        <span className="badge-pill gray">Sin configurar</span>
                      )}
                    </td>
                    <td>
                      <span className="text-xs text-gray-500">
                        {member.created_at ? new Date(member.created_at).toLocaleDateString('es-CL') : 'Inicial'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <select
                          className="role-selector-sm"
                          value={member.role}
                          onChange={e => handleRoleChange(member.id, e.target.value as UserRole)}
                          disabled={!isBackend}
                          title="Cambiar rol del usuario"
                        >
                          <option value="administrador">Administrador</option>
                          <option value="auditor">Auditor</option>
                          <option value="visualizador">Visualizador</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Agregar Usuario */}
      {showAddUserModal && (
        <div className="modal-overlay" onClick={() => setShowAddUserModal(false)}>
          <div className="modal-content modal-add-user" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Agregar Nuevo Miembro al Equipo</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowAddUserModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="modal-body">
              {addUserError && (
                <div className="auth-error" style={{ marginBottom: 12 }}>
                  {addUserError}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="input-new-email">Correo Corporativo</label>
                <input
                  id="input-new-email"
                  type="email"
                  className="perfil-input"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  placeholder="colaborador@empresa.cl"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="input-new-password">Contraseña Temporal (mín. 8 caracteres)</label>
                <input
                  id="input-new-password"
                  type="password"
                  className="perfil-input"
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="select-new-role">Rol y Nivel de Acceso</label>
                <select
                  id="select-new-role"
                  className="perfil-select"
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as UserRole)}
                >
                  <option value="visualizador">Visualizador (Solo consulta de diagnósticos)</option>
                  <option value="auditor">Auditor (Descarga informes y consulta auditoría)</option>
                  <option value="administrador">Administrador (Control total del tenant)</option>
                </select>
              </div>

              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="btn-cancelar"
                  onClick={() => setShowAddUserModal(false)}
                  disabled={creatingUser}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-guardar"
                  disabled={creatingUser}
                >
                  {creatingUser ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
