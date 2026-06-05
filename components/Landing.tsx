'use client';
import LoginCard from './LoginCard';
import { ScaleIcon, FileTextIcon, SearchCheckIcon, AlertCircleIcon, BarChart2Icon } from './Icons';
import type { UserRole } from '@/lib/types';

interface LandingProps {
  onLogin: (rut: string, role: UserRole) => void;
  onDemo: () => void;
  onToast: (msg: string, type: 'yellow' | 'blue') => void;
}

export default function Landing({ onLogin, onDemo, onToast }: LandingProps) {
  return (
    <div id="screen-landing" style={{ minHeight: '100vh', background: '#0f1e3d', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav className="landing-nav">
        <div className="brand">
          <div className="brand-icon">
            <ScaleIcon size={18} color="#fff" />
          </div>
          <div>
            <div className="brand-name">DataShield</div>
            <div className="brand-tagline">Ley 21.719 · Chile</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
          Sistema operativo — APDP 2025
        </div>
      </nav>

      {/* Body */}
      <div className="landing-body">
        <div className="landing-hero">
          <div className="badge-new landing-badge" style={{ marginBottom: 20, background: 'rgba(96,165,250,0.1)', borderColor: 'rgba(96,165,250,0.25)', color: '#60a5fa' }}>
            ✦ Plataforma oficial de diagnóstico
          </div>
          <h1>¿Su empresa cumple con la <span>Ley 21.719</span>?</h1>
          <p>
            Suba sus documentos y obtenga en minutos un diagnóstico detallado de las brechas
            que deben corregir para evitar multas de hasta{' '}
            <strong style={{ color: '#f87171' }}>5.000 UTM</strong> de la APDP.
          </p>
          <div className="landing-features">
            <div className="lf-item">
              <div className="lf-icon"><FileTextIcon size={13} color="#60a5fa" /></div>
              Suba sus documentos actuales (PDF, Word, Excel)
            </div>
            <div className="lf-item">
              <div className="lf-icon"><SearchCheckIcon size={13} color="#60a5fa" /></div>
              El sistema los contrasta contra los 10 requisitos de la ley
            </div>
            <div className="lf-item">
              <div className="lf-icon"><AlertCircleIcon size={13} color="#60a5fa" /></div>
              Vea exactamente qué le falta y cómo corregirlo
            </div>
            <div className="lf-item">
              <div className="lf-icon"><BarChart2Icon size={13} color="#60a5fa" /></div>
              Descargue un informe para presentar a directorio
            </div>
          </div>
        </div>

        <LoginCard onLogin={onLogin} onDemo={onDemo} onToast={onToast} />
      </div>
    </div>
  );
}
