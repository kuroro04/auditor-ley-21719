'use client';
import LoginCard from './LoginCard';
import { ScaleIcon, FileTextIcon, SearchCheckIcon, AlertCircleIcon, BarChart2Icon } from './Icons';
import type { UserRole } from '@/lib/types';
import type { RegisterPayload } from '@/lib/api/auth';

interface LandingProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (payload: RegisterPayload) => Promise<void>;
  onDemo: (role: UserRole) => void;
  onToast: (msg: string, type: 'yellow' | 'blue') => void;
}

export default function Landing({ onLogin, onRegister, onDemo, onToast }: LandingProps) {
  return (
    <div className="landing-page">
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 6px rgba(74,222,128,0.5)' }} />
          Sistema operativo — APDP 2025
        </div>
      </nav>

      {/* Body */}
      <div className="landing-body">
        <div className="landing-hero">
          <div className="badge-new landing-badge" style={{ marginBottom: 20, background: 'rgba(96,165,250,0.1)', borderColor: 'rgba(96,165,250,0.22)', color: '#60a5fa' }}>
            ✦ Plataforma oficial de diagnóstico
          </div>
          <h1>¿Su empresa cumple con la <span>Ley 21.719</span>?</h1>
          <p>
            Suba sus documentos y obtenga en minutos un diagnóstico detallado de las brechas
            que deben corregir para evitar multas de hasta{' '}
            <strong style={{ color: '#f87171', fontWeight: 600 }}>5.000 UTM</strong> de la APDP.
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

          {/* Trust signals */}
          <div className="landing-trust">
            <div className="trust-item">
              <div className="trust-dot" />
              Procesamiento 100% local
            </div>
            <div className="trust-item" style={{ color: 'rgba(255,255,255,0.25)' }}>·</div>
            <div className="trust-item">
              <div className="trust-dot" />
              Sin envío a servidores
            </div>
            <div className="trust-item" style={{ color: 'rgba(255,255,255,0.25)' }}>·</div>
            <div className="trust-item">
              <div className="trust-dot" />
              Cifrado AES-256
            </div>
          </div>
        </div>

        <LoginCard onLogin={onLogin} onRegister={onRegister} onDemo={onDemo} onToast={onToast} />
      </div>
    </div>
  );
}
