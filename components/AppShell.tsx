'use client';
import { useState, type KeyboardEvent } from 'react';
import UploadView from './UploadView';
import MfaSettings from './MfaSettings';
import DiagnosticoView from './DiagnosticoView';
import RegistroView from './RegistroView';
import RiesgosView from './RiesgosView';
import type { ActiveTab, AuditEvent, UploadedDoc, RequisitoResult, UserRole, Sector, HistorialSnapshot } from '@/lib/types';
import type { AuthSource } from '@/hooks/useAppState';
import type { SecurityEvent } from '@/lib/tenant/guard';
import OnboardingTour from './OnboardingTour';
import HistorialView from './HistorialView';
import { ScaleIcon, FolderOpenIcon, ClipboardListIcon } from './Icons';

interface AppShellProps {
  companyName: string;
  companyId: string;
  securityEvents: SecurityEvent[];
  role: UserRole;
  sector: Sector;
  authSource: AuthSource;
  auditLog: AuditEvent[];
  activeTab: ActiveTab;
  uploadedDocs: Record<string, UploadedDoc>;
  results: Record<string, RequisitoResult>;
  previousResults: Record<string, RequisitoResult>;
  snapshots: HistorialSnapshot[];
  analyzed: boolean;
  tourActive: boolean;
  tourStep: number;
  // Fase 5 — estado del segundo factor y callback para reflejar sus cambios.
  mfaEnabled: boolean;
  onMfaChanged: (enabled: boolean) => void;
  onSwitchTab: (tab: ActiveTab) => void;
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onUploadRejected: (reqId: string, fileName: string, reason: string) => void;
  onStartAnalysis: () => void;
  onLogout: () => void;
  onDownload: () => void;
  onAdvanceTour: () => void;
  onSkipTour: () => void;
  onOpenTour: () => void;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  administrador: 'Admin',
  auditor: 'Auditor',
  visualizador: 'Visualizador',
};

export default function AppShell({
  companyName, companyId, securityEvents, role, sector, authSource, auditLog, activeTab, uploadedDocs, results,
  previousResults, snapshots, analyzed, tourActive, tourStep, mfaEnabled, onMfaChanged,
  onSwitchTab, onUpload, onUploadRejected, onStartAnalysis, onLogout, onDownload,
  onAdvanceTour, onSkipTour, onOpenTour, onToast,
}: AppShellProps) {
  const brechaCount = Object.values(results).filter(r => r.estado !== 'green').length;
  const canSeeRegistro = role === 'administrador' || role === 'auditor';

  // Fase 5 — panel de seguridad (verificación en dos pasos). Solo tiene
  // sentido en una sesión real: el modo demostración no tiene cuenta.
  const [mfaOpen, setMfaOpen] = useState(false);
  const puedeGestionarMfa = authSource === 'backend';

  // Props comunes para que cada tab de navegación sea accesible por teclado
  // (los divs clicables no reciben foco ni Enter/Espacio por defecto).
  const tabA11yProps = (tab: ActiveTab) => ({
    role: 'tab' as const,
    tabIndex: 0,
    'aria-selected': activeTab === tab,
    onClick: () => onSwitchTab(tab),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSwitchTab(tab); }
    },
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-brand-icon">
            <ScaleIcon size={16} color="#fff" />
          </div>
          <div className="header-brand-name">DataShield</div>
          <span style={{ fontSize: 10.5, color: 'var(--border2)', marginLeft: 2 }}>|</span>
          <span style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.02em' }}>Ley 21.719</span>
        </div>
        <div className="header-right">
          <div className="header-role-badge">{ROLE_LABELS[role]}</div>
          <div className="header-company" title="Identificador de empresa (tenant) de la sesión actual">
            <div className="header-company-dot" />
            <span>{companyName}</span>
            <span className="header-company-id">ID: {companyId}</span>
          </div>
          <button
            className="btn-tutorial"
            onClick={onOpenTour}
            title="Volver a mostrar el tutorial de bienvenida"
            aria-label="Abrir tutorial de bienvenida"
          >
            ¿Cómo usar?
          </button>
          {puedeGestionarMfa && (
            <button
              className="btn-tutorial"
              onClick={() => setMfaOpen(true)}
              title="Configurar la verificación en dos pasos"
            >
              {mfaEnabled ? '🔒 Seguridad' : 'Seguridad'}
            </button>
          )}
          <button className="btn-logout" onClick={onLogout}>Salir</button>
        </div>
      </header>

      {/* Nav */}
      <nav className="app-nav">
        <div className={`nav-tab${activeTab === 'subir' ? ' active' : ''}`} {...tabA11yProps('subir')}>
          <FolderOpenIcon size={14} /> Subir documentos
        </div>
        <div
          data-tour="tab-diagnostico"
          className={`nav-tab${activeTab === 'diagnostico' ? ' active' : ''}`}
          {...tabA11yProps('diagnostico')}
        >
          <ClipboardListIcon size={14} /> Mi diagnóstico
          {analyzed && brechaCount > 0 && (
            <span className="nav-tab-badge">{brechaCount}</span>
          )}
        </div>
        <div className={`nav-tab${activeTab === 'riesgos' ? ' active' : ''}`} {...tabA11yProps('riesgos')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Riesgos
        </div>
        {canSeeRegistro && (
          <div className={`nav-tab${activeTab === 'registro' ? ' active' : ''}`} {...tabA11yProps('registro')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Registro de auditoría
            {auditLog.length > 0 && (
              <span className="nav-tab-badge" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(37,99,235,0.18)' }}>
                {auditLog.length}
              </span>
            )}
          </div>
        )}
        <div className={`nav-tab${activeTab === 'historial' ? ' active' : ''}`} {...tabA11yProps('historial')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Historial
          {snapshots.length >= 2 && (
            <span className="nav-tab-badge" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(37,99,235,0.18)' }}>
              {snapshots.length}
            </span>
          )}
        </div>
      </nav>

      {/* Content */}
      <div className="app-content">
        {activeTab === 'subir' && (
          <UploadView
            uploadedDocs={uploadedDocs}
            role={role}
            authSource={authSource}
            onUpload={onUpload}
            onUploadRejected={onUploadRejected}
            onStartAnalysis={onStartAnalysis}
            onToast={(msg, type) => onToast(msg, type)}
          />
        )}
        {activeTab === 'diagnostico' && analyzed && (
          <DiagnosticoView
            results={results}
            previousResults={previousResults}
            uploadedDocs={uploadedDocs}
            companyName={companyName}
            companyId={companyId}
            sector={sector}
            role={role}
            onUpload={onUpload}
            onUploadRejected={onUploadRejected}
            onDownload={onDownload}
            onToast={(msg, type) => onToast(msg, type)}
          />
        )}
        {activeTab === 'riesgos' && (
          <RiesgosView results={results} analyzed={analyzed} />
        )}
        {activeTab === 'registro' && canSeeRegistro && (
          <RegistroView auditLog={auditLog} securityEvents={securityEvents} />
        )}
        {activeTab === 'historial' && (
          <HistorialView snapshots={snapshots} />
        )}
      </div>

      {/* Tour guiado: solo activo en la pestaña inicial; desaparece al cambiar de sección */}
      {tourActive && activeTab === 'subir' && (
        <OnboardingTour
          tourStep={tourStep}
          onNext={onAdvanceTour}
          onSkip={onSkipTour}
        />
      )}

      {/* Fase 5 — panel de verificación en dos pasos */}
      {mfaOpen && (
        <MfaSettings
          mfaEnabled={mfaEnabled}
          onChanged={onMfaChanged}
          onClose={() => setMfaOpen(false)}
          onToast={onToast}
        />
      )}
    </div>
  );
}
