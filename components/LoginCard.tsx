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

// Formatea el RUT mientras el usuario escribe: 76.123.456-7
const formatRut = (raw: string): string => {
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
};

// Valida el RUT chileno con algoritmo módulo 11
const isValidRut = (value: string): boolean => {
  const clean = value.replace(/\./g, '').replace('-', '').trim();
  if (!/^\d{7,8}[0-9Kk]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dvInput = clean.slice(-1).toUpperCase();
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const dvExpected = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
  return dvInput === dvExpected;
};

// Validación de correo electrónico con formato real
const isValidEmail = (val: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

// Requisitos mínimos de seguridad para la contraseña
const getPassReqs = (pass: string) => ({
  length:  pass.length >= 8,
  upper:   /[A-Z]/.test(pass),
  lower:   /[a-z]/.test(pass),
  number:  /[0-9]/.test(pass),
  special: /[!@#$%&*]/.test(pass),
});

export default function LoginCard({ onLogin, onDemo, onToast }: LoginCardProps) {
  const [rut,    setRut]    = useState('');
  const [email,  setEmail]  = useState('');
  const [pass,   setPass]   = useState('');
  const [role,   setRole]   = useState<UserRole>('administrador');
  const [sector, setSector] = useState<Sector>('otro');

  // Flags para mostrar errores solo después de que el usuario toca cada campo
  const [rutTouched,   setRutTouched]   = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passTouched,  setPassTouched]  = useState(false);
  const [showPass,     setShowPass]     = useState(false);

  const passReqs   = getPassReqs(pass);
  const passOk     = Object.values(passReqs).every(Boolean);
  const isFormValid = isValidRut(rut) && isValidEmail(email) && passOk;

  const handleLogin = () => {
    // Marcar todos los campos como tocados para mostrar errores al intentar enviar
    setRutTouched(true);
    setEmailTouched(true);
    setPassTouched(true);
    if (!isFormValid) return;
    onLogin(rut.trim(), role, sector);
  };

  return (
    <div className="login-card">
      <h2>Acceder a la plataforma</h2>
      <p className="login-sub">Ingrese o cree su cuenta de empresa</p>

      {/* RUT */}
      <div className="form-group">
        <label className="form-label">RUT de la empresa</label>
        <input
          className={`form-input${rutTouched && !isValidRut(rut) ? ' form-input--error' : ''}`}
          type="text" placeholder="76.123.456-7"
          value={rut} maxLength={12}
          onChange={e => setRut(formatRut(e.target.value))}
          onBlur={() => setRutTouched(true)}
        />
        {rutTouched && !isValidRut(rut) && (
          <p className="form-error-msg">Ingrese un RUT válido (ejemplo: 76.123.456-7)</p>
        )}
      </div>

      {/* Correo */}
      <div className="form-group">
        <label className="form-label">Correo corporativo</label>
        <input
          className={`form-input${emailTouched && !isValidEmail(email) ? ' form-input--error' : ''}`}
          type="email" placeholder="nombre@empresa.cl"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
        />
        {emailTouched && !isValidEmail(email) && (
          <p className="form-error-msg">Ingrese un correo electrónico válido (ejemplo: nombre@empresa.cl)</p>
        )}
      </div>

      {/* Contraseña */}
      <div className="form-group">
        <label className="form-label">Contraseña</label>
        <div className="pass-input-wrap">
          <input
            className={`form-input${passTouched && !passOk ? ' form-input--error' : ''}`}
            type={showPass ? 'text' : 'password'} placeholder="••••••••"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onBlur={() => setPassTouched(true)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          <button
            type="button"
            className="pass-toggle"
            onClick={() => setShowPass(v => !v)}
            aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPass ? (
              // Ojo tachado — ocultar
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              // Ojo abierto — mostrar
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
        {/* Lista de requisitos en tiempo real */}
        <ul className="pass-req-list">
          {([
            [passReqs.length,  'Mínimo 8 caracteres'],
            [passReqs.upper,   'Al menos una letra mayúscula'],
            [passReqs.lower,   'Al menos una letra minúscula'],
            [passReqs.number,  'Al menos un número'],
            [passReqs.special, 'Al menos un carácter especial (!@#$%&*)'],
          ] as [boolean, string][]).map(([ok, label]) => (
            <li key={label} className={`req-item${ok ? ' req-item--ok' : ' req-item--fail'}`}>
              <span className="req-icon">{ok ? '✓' : '·'}</span>
              {label}
            </li>
          ))}
        </ul>
        {passTouched && !passOk && (
          <p className="form-error-msg">La contraseña no cumple los requisitos mínimos de seguridad</p>
        )}
      </div>

      {/* Rol */}
      <div className="form-group">
        <label className="form-label">Rol de acceso</label>
        <select className="form-input form-select" value={role}
          onChange={e => setRole(e.target.value as UserRole)}>
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
          ))}
        </select>
      </div>

      {/* Sector */}
      <div className="form-group">
        <label className="form-label">Sector de su empresa</label>
        <select className="form-input form-select" value={sector}
          onChange={e => setSector(e.target.value as Sector)}>
          {SECTORES_OPCIONES.map(s => (
            <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>
          ))}
        </select>
      </div>

      <button
        className="btn-login"
        onClick={handleLogin}
        disabled={!isFormValid}
        aria-disabled={!isFormValid}
      >
        Ingresar →
      </button>

      <div className="login-divider">o continúe sin registrarse</div>

      {/* El botón demo omite todas las validaciones */}
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
