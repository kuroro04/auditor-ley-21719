'use client';
import UploadView from './UploadView';
import DiagnosticoView from './DiagnosticoView';
import RegistroView from './RegistroView';
import RiesgosView from './RiesgosView';
import type { ActiveTab, AuditEvent, UploadedDoc, RequisitoResult, UserRole, Sector, HistorialSnapshot } from '@/lib/types';
import OnboardingTour from './OnboardingTour';
import HistorialView from './HistorialView';
import { ScaleIcon, FolderOpenIcon, ClipboardListIcon } from './Icons';

interface AppShellProps {
  companyName: string;
  role: UserRole;
  sector: Sector;
  auditLog: AuditEvent[];
  activeTab: ActiveTab;
  uploadedDocs: Record<string, UploadedDoc>;
  results: Record<string, RequisitoResult>;
  previousResults: Record<string, RequisitoResult>;
  snapshots: HistorialSnapshot[];
  analyzed: boolean;
  tourActive: boolean;
  tourStep: number;
  onSwitchTab: (tab: ActiveTab) => void;
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onStartAnalysis: () => void;
  onLogout: () => void;
  onDownload: () => void;
  onAdvanceTour: () => void;
  onSkipTour: () => void;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  administrador: 'Admin',
  auditor: 'Auditor',
  visualizador: 'Visualizador',
};

export default function AppShell({
  companyName, role, sector, auditLog, activeTab, uploadedDocs, results,
  previousResults, snapshots, analyzed, tourActive, tourStep,
  onSwitchTab, onUpload, onStartAnalysis, onLogout, onDownload,
  onAdvanceTour, onSkipTour, onToast,
}: AppShellProps) {
  const brechaCount = Object.values(results).filter(r => r.estado !== 'green').length;
  const canSeeRegistro = role === 'administrador' || role === 'auditor';

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
          <div className="header-company">
            <div className="header-company-dot" />
            <span>{companyName}</span>
          </div>
          <button className="btn-logout" onClick={onLogout}>Salir</button>
        </div>
      </header>

      {/* Nav */}
      <nav className="app-nav">
        <div className={`nav-tab${activeTab === 'subir' ? ' active' : ''}`} onClick={() => onSwitchTab('subir')}>
          <FolderOpenIcon size={14} /> Subir documentos
        </div>
        <div
          data-tour="tab-diagnostico"
          className={`nav-tab${activeTab === 'diagnostico' ? ' active' : ''}`}
          onClick={() => onSwitchTab('diagnostico')}
        >
          <ClipboardListIcon size={14} /> Mi diagnóstico
          {analyzed && brechaCount > 0 && (
            <span className="nav-tab-badge">{brechaCount}</span>
          )}
        </div>
        <div className={`nav-tab${activeTab === 'riesgos' ? ' active' : ''}`} onClick={() => onSwitchTab('riesgos')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Riesgos
        </div>
        {canSeeRegistro && (
          <div className={`nav-tab${activeTab === 'registro' ? ' active' : ''}`} onClick={() => onSwitchTab('registro')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Registro de auditoría
            {auditLog.length > 0 && (
              <span className="nav-tab-badge" style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(37,99,235,0.18)' }}>
                {auditLog.length}
              </span>
            )}
          </div>
        )}
        <div className={`nav-tab${activeTab === 'historial' ? ' active' : ''}`} onClick={() => onSwitchTab('historial')}>
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
            onUpload={onUpload}
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
            sector={sector}
            role={role}
            onUpload={onUpload}
            onDownload={onDownload}
            onToast={(msg, type) => onToast(msg, type)}
          />
        )}
        {activeTab === 'riesgos' && (
          <RiesgosView results={results} analyzed={analyzed} />
        )}
        {activeTab === 'registro' && canSeeRegistro && (
          <RegistroView auditLog={auditLog} />
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
    </div>
  );
}
