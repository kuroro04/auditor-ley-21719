'use client';
import { useState } from 'react';
import type { UserRole } from '@/lib/types';

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'administrador', label: 'Administrador', desc: 'Acceso total' },
  { value: 'auditor',       label: 'Auditor',       desc: 'Ve registro de auditoría' },
  { value: 'visualizador',  label: 'Visualizador',  desc: 'Solo lectura' },
];

interface LoginCardProps {
  onLogin: (rut: string, role: UserRole) => void;
  onDemo: () => void;
  onToast: (msg: string, type: 'yellow' | 'blue') => void;
}

export default function LoginCard({ onLogin, onDemo, onToast }: LoginCardProps) {
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [role, setRole] = useState<UserRole>('administrador');

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
    onLogin(rut.trim(), role);
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

      <button className="btn-login" onClick={handleLogin}>Ingresar →</button>

      <div className="login-divider">o continúe sin registrarse</div>

      <button className="btn-demo" onClick={onDemo}>
        Ver demostración con datos de ejemplo
      </button>

      <p className="login-legal">
        Sus documentos se procesan localmente en su navegador.<br />
        Ningún archivo es enviado a servidores externos.
      </p>
    </div>
  );
}
