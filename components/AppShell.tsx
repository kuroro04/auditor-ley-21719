'use client';
import UploadView from './UploadView';
import DiagnosticoView from './DiagnosticoView';
import RegistroView from './RegistroView';
import RiesgosView from './RiesgosView';
import type { ActiveTab, AuditEvent, UploadedDoc, RequisitoResult, UserRole, Sector } from '@/lib/types';
import OnboardingTour from './OnboardingTour';
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
  previousResults, analyzed, tourActive, tourStep,
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
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>Ley 21.719</span>
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
          <span style={{ fontSize: 14 }}>⚠</span> Riesgos
        </div>
        {canSeeRegistro && (
          <div className={`nav-tab${activeTab === 'registro' ? ' active' : ''}`} onClick={() => onSwitchTab('registro')}>
            <span style={{ fontSize: 14 }}>📋</span> Registro de auditoría
            {auditLog.length > 0 && (
              <span className="nav-tab-badge" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                {auditLog.length}
              </span>
            )}
          </div>
        )}
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
      </div>

      {/* Tour guiado de onboarding — aparece en el primer acceso */}
      {tourActive && (
        <OnboardingTour
          tourStep={tourStep}
          onNext={onAdvanceTour}
          onSkip={onSkipTour}
        />
      )}
    </div>
  );
}
