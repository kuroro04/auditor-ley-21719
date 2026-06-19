'use client';
import { useState } from 'react';
import { SECTORES_OPCIONES } from '@/lib/sectorData';
import type { UserRole } from '@/lib/types';
import type { Sector } from '@/lib/types';

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'administrador', label: 'Administrador', desc: 'Acceso total' },
  { value: 'auditor',       label: 'Auditor',       desc: 'Ve registro de auditoría' },
  { value: 'visualizador',  label: 'Visualizador',  desc: 'Solo lectura' },
];

interface LoginCardProps {
  onLogin: (rut: string, role: UserRole, sector: Sector) => void;
  onDemo: () => void;
  onToast: (msg: string, type: 'yellow' | 'blue') => void;
}

export default function LoginCard({ onLogin, onDemo, onToast }: LoginCardProps) {
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [role, setRole] = useState<UserRole>('administrador');
  const [sector, setSector] = useState<Sector>('otro');

  const formatRut = (raw: string): string => {
    const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
    if (clean.length <= 1) return clean;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
  };

  const isValidRut = (value: string): boolean =>
    /^\d{1,2}\.\d{3}\.\d{3}-[\dKk]$/.test(value.trim());

  const handleLogin = () => {
    if (!rut.trim() || !email.trim()) {
      onToast('Complete RUT y correo para ingresar', 'yellow');
      return;
    }
    if (!isValidRut(rut)) {
      onToast('Formato de RUT inválido — use 12.345.678-9', 'yellow');
      return;
    }
    onLogin(rut.trim(), role, sector);
  };

  return (
    <div className="login-card">
      <h2>Acceder a la plataforma</h2>
      <p className="login-sub">Ingrese o cree su cuenta de empresa</p>

      <div className="form-group">
        <label className="form-label">RUT de la empresa</label>
        <input className="form-input" type="text" placeholder="76.123.456-7"
          value={rut} maxLength={12}
          onChange={e => setRut(formatRut(e.target.value))} />
      </div>
      <div className="form-group">
        <label className="form-label">Correo corporativo</label>
        <input className="form-input" type="email" placeholder="nombre@empresa.cl"
          value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Contraseña</label>
        <input className="form-input" type="password" placeholder="••••••••"
          value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()} />
      </div>
      <div className="form-group">
        <label className="form-label">Rol de acceso</label>
        <select className="form-input form-select" value={role}
          onChange={e => setRole(e.target.value as UserRole)}>
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Sector de su empresa</label>
        <select
          className="form-input form-select"
          value={sector}
          onChange={e => setSector(e.target.value as Sector)}
        >
          {SECTORES_OPCIONES.map(s => (
            <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>
          ))}
        </select>
      </div>

      <button className="btn-login" onClick={handleLogin}>Ingresar →</button>

      <div className="login-divider">o continúe sin registrarse</div>

      <button className="btn-demo" onClick={onDemo}>
        Ver demostración con datos de ejemplo
      </button>

      <div className="login-security">
        <div className="login-security-item">
          <span>🔒</span>
          <span>Procesamiento local</span>
        </div>
        <div className="login-security-item">
          <span>🛡</span>
          <span>Sin servidores externos</span>
        </div>
        <div className="login-security-item">
          <span>🔑</span>
          <span>AES-256</span>
        </div>
      </div>
    </div>
  );
}
