'use client';
import { useState } from 'react';
import { SECTORES_OPCIONES } from '@/lib/sectorData';
import type { UserRole, Sector } from '@/lib/types';
import type { RegisterPayload } from '@/lib/api/auth';

// Botones de "modo demostración": cada uno simula haber iniciado sesión ya
// autenticado con ese rol predefinido. Nunca es el usuario quien "elige"
// su rol de acceso real; esto es solo un atajo de prueba, separado del
// formulario de login/registro real (que sí habla con el backend).
const DEMO_ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'administrador', label: 'Administrador', desc: 'Acceso total' },
  { value: 'auditor',       label: 'Auditor',       desc: 'Ve registro de auditoría' },
  { value: 'visualizador',  label: 'Visualizador',  desc: 'Solo lectura' },
];

interface LoginCardProps {
  // El rol y el nombre de la empresa NUNCA viajan desde este formulario:
  // los resuelve el backend (ver lib/api/auth.ts) a partir del RUT/correo.
  // Fase 5 — onLogin indica si el backend pide un segundo factor; en ese
  // caso el formulario cambia al paso del código en vez de entrar.
  onLogin: (email: string, password: string) => Promise<{ mfaRequired: boolean }>;
  onLoginMfa: (code: string) => Promise<void>;
  onRegister: (payload: RegisterPayload) => Promise<void>;
  onDemo: (role: UserRole) => void;
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

type LoginMode = 'login' | 'register';

export default function LoginCard({ onLogin, onLoginMfa, onRegister, onDemo }: LoginCardProps) {
  const [mode, setMode] = useState<LoginMode>('login');
  const [submitting, setSubmitting] = useState(false);

  // Fase 5 — cuando el backend pide segundo factor, el formulario muestra
  // el paso del código en lugar de correo/contraseña.
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  const [rut,           setRut]           = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [email,  setEmail]  = useState('');
  const [pass,   setPass]   = useState('');
  const [sector, setSector] = useState<Sector>('otro');

  // Flags para mostrar errores solo después de que el usuario toca cada campo
  const [rutTouched,     setRutTouched]     = useState(false);
  const [nombreTouched,  setNombreTouched]  = useState(false);
  const [emailTouched,   setEmailTouched]   = useState(false);
  const [passTouched,    setPassTouched]    = useState(false);
  const [showPass,       setShowPass]       = useState(false);

  const passReqs = getPassReqs(pass);
  const passOk   = Object.values(passReqs).every(Boolean);

  const isFormValid = mode === 'login'
    ? isValidEmail(email) && pass.length > 0
    : isValidRut(rut) && nombreEmpresa.trim().length > 0 && isValidEmail(email) && passOk;

  const switchMode = (next: LoginMode) => {
    setMode(next);
    setRutTouched(false);
    setNombreTouched(false);
    setEmailTouched(false);
    setPassTouched(false);
  };

  const handleSubmit = async () => {
    setRutTouched(true);
    setNombreTouched(true);
    setEmailTouched(true);
    setPassTouched(true);
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    if (mode === 'login') {
      const { mfaRequired } = await onLogin(email.trim(), pass);
      if (mfaRequired) setMfaStep(true);
    } else {
      await onRegister({
        rut: rut.trim(), nombreEmpresa: nombreEmpresa.trim(), email: email.trim(), password: pass, sector,
      });
    }
    setSubmitting(false);
  };

  const handleMfaSubmit = async () => {
    if (mfaCode.trim().length < 6 || submitting) return;
    setSubmitting(true);
    try {
      await onLoginMfa(mfaCode.trim());
      // Si el código es válido, la app cambia de pantalla y este componente
      // se desmonta; si falla, el toast lo informa y se puede reintentar.
    } finally {
      setMfaCode('');
      setSubmitting(false);
    }
  };

  const cancelarMfa = () => {
    setMfaStep(false);
    setMfaCode('');
    setPass('');
  };

  // Fase 5 — paso del segundo factor: reemplaza el formulario de acceso.
  if (mfaStep) {
    return (
      <div className="login-card">
        <h2>Verificación en dos pasos</h2>
        <p className="login-sub">
          Ingrese el código de 6 dígitos de su app de autenticación (o un código de respaldo).
        </p>
        <div className="form-group">
          <label className="form-label">Código de verificación</label>
          <input
            className="form-input"
            type="text"
            autoComplete="one-time-code"
            autoFocus
            maxLength={10}
            placeholder="000000 o código de respaldo"
            value={mfaCode}
            onChange={e => setMfaCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10))}
            onKeyDown={e => e.key === 'Enter' && handleMfaSubmit()}
          />
        </div>
        <button
          className="btn-login"
          onClick={handleMfaSubmit}
          disabled={mfaCode.trim().length < 6 || submitting}
          aria-disabled={mfaCode.trim().length < 6 || submitting}
        >
          {submitting ? 'Verificando…' : 'Verificar e ingresar →'}
        </button>
        <button type="button" className="login-mfa-cancel" onClick={cancelarMfa}>
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="login-card">
      <h2>Acceder a la plataforma</h2>
      <p className="login-sub">Ingrese o cree su cuenta de empresa</p>

      <div className="login-mode-toggle" role="tablist" aria-label="Modo de acceso">
        <button
          type="button" role="tab" aria-selected={mode === 'login'}
          className={`login-mode-btn${mode === 'login' ? ' login-mode-btn--active' : ''}`}
          onClick={() => switchMode('login')}
        >
          Iniciar sesión
        </button>
        <button
          type="button" role="tab" aria-selected={mode === 'register'}
          className={`login-mode-btn${mode === 'register' ? ' login-mode-btn--active' : ''}`}
          onClick={() => switchMode('register')}
        >
          Crear empresa
        </button>
      </div>

      {mode === 'register' && (
        <>
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

          {/* Nombre de la empresa */}
          <div className="form-group">
            <label className="form-label">Nombre de la empresa</label>
            <input
              className={`form-input${nombreTouched && nombreEmpresa.trim().length === 0 ? ' form-input--error' : ''}`}
              type="text" placeholder="Mi Empresa S.A."
              value={nombreEmpresa}
              onChange={e => setNombreEmpresa(e.target.value)}
              onBlur={() => setNombreTouched(true)}
            />
            {nombreTouched && nombreEmpresa.trim().length === 0 && (
              <p className="form-error-msg">Ingrese el nombre de la empresa</p>
            )}
          </div>
        </>
      )}

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
            className={`form-input${passTouched && mode === 'register' && !passOk ? ' form-input--error' : ''}`}
            type={showPass ? 'text' : 'password'} placeholder="••••••••"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onBlur={() => setPassTouched(true)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <button
            type="button"
            className="pass-toggle"
            onClick={() => setShowPass(v => !v)}
            aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPass ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
        {mode === 'register' && (
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
        )}
        {passTouched && mode === 'register' && !passOk && (
          <p className="form-error-msg">La contraseña no cumple los requisitos mínimos de seguridad</p>
        )}
      </div>

      {/* Sector — solo al crear empresa */}
      {mode === 'register' && (
        <div className="form-group">
          <label className="form-label">Sector de su empresa</label>
          <select className="form-input form-select" value={sector}
            onChange={e => setSector(e.target.value as Sector)}>
            {SECTORES_OPCIONES.map(s => (
              <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>
            ))}
          </select>
        </div>
      )}

      <button
        className="btn-login"
        onClick={handleSubmit}
        disabled={!isFormValid || submitting}
        aria-disabled={!isFormValid || submitting}
      >
        {submitting ? 'Un momento…' : mode === 'login' ? 'Ingresar →' : 'Crear empresa →'}
      </button>

      <div className="login-divider">o continúe sin registrarse</div>

      {/*
        Modo demostración: claramente separado del login/registro real (no
        habla con el backend). Cada botón simula una sesión YA autenticada
        con un rol predefinido y datos de ejemplo — el usuario nunca elige
        su rol aquí tampoco, solo elige cuál demo quiere ver.
      */}
      <div className="demo-mode-box">
        <div className="demo-mode-label">
          <span aria-hidden="true">🧪</span> Modo demostración (no es un ingreso real)
        </div>
        <p className="demo-mode-desc">
          Pruebe la plataforma con datos de ejemplo ya cargados, viendo cómo cambia la
          experiencia según el rol del usuario.
        </p>
        <div className="demo-mode-buttons">
          {DEMO_ROLES.map(r => (
            <button
              key={r.value}
              className="btn-demo"
              title={r.desc}
              onClick={() => onDemo(r.value)}
            >
              Entrar como {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="login-security">
        <div className="login-security-item">
          <span>🔒</span>
          <span>Sesión cifrada (cookie httpOnly)</span>
        </div>
        <div className="login-security-item">
          <span>🛡</span>
          <span>Aislamiento por empresa</span>
        </div>
        <div className="login-security-item">
          <span>🔑</span>
          <span>AES-256</span>
        </div>
      </div>
    </div>
  );
}
