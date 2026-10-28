'use client';
import { useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { mfaActivate, mfaDisable, mfaSetup, type MfaSetupInfo } from '@/lib/api/auth';

interface MfaSettingsProps {
  mfaEnabled: boolean;
  // Avisa al estado global el nuevo valor de mfa_enabled tras activar/desactivar.
  onChanged: (enabled: boolean) => void;
  onClose: () => void;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}

// Pasos del enrolamiento: escanear QR -> confirmar con un código -> guardar
// los códigos de respaldo.
type EnrolStep = 'idle' | 'scan' | 'backup';

export default function MfaSettings({ mfaEnabled, onChanged, onClose, onToast }: MfaSettingsProps) {
  const [busy, setBusy] = useState(false);

  // --- Activación ---
  const [step, setStep] = useState<EnrolStep>('idle');
  const [setupInfo, setSetupInfo] = useState<MfaSetupInfo | null>(null);
  const [firstCode, setFirstCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // --- Desactivación ---
  const [confirmValue, setConfirmValue] = useState('');

  const iniciarEnrolamiento = async () => {
    setBusy(true);
    try {
      const info = await mfaSetup();
      setSetupInfo(info);
      setStep('scan');
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'No se pudo iniciar la configuración', 'yellow');
    } finally {
      setBusy(false);
    }
  };

  const confirmarEnrolamiento = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const codes = await mfaActivate(firstCode.trim());
      setBackupCodes(codes);
      setStep('backup');
      onToast('✓ Verificación en dos pasos activada', 'green');
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Código incorrecto, intente de nuevo', 'yellow');
    } finally {
      setBusy(false);
    }
  };

  const terminarEnrolamiento = () => {
    onChanged(true);
    onClose();
  };

  const desactivar = async () => {
    if (busy) return;
    const value = confirmValue.trim();
    if (!value) {
      onToast('Ingrese su contraseña o un código de verificación', 'yellow');
      return;
    }
    setBusy(true);
    try {
      // Un código TOTP (6 dígitos) o de respaldo (10 caracteres alfanuméricos)
      // se envía en la propiedad 'code'; cualquier otra cosa se evalúa como contraseña.
      const isCode = /^\d{6}$/.test(value) || /^[A-Za-z0-9]{10}$/.test(value);
      const confirm = isCode ? { code: value } : { password: value };
      await mfaDisable(confirm);
      onToast('✓ Verificación en dos pasos desactivada', 'green');
      onChanged(false);
      onClose();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'No se pudo desactivar', 'yellow');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mfa-overlay" role="dialog" aria-modal="true" aria-label="Verificación en dos pasos">
      <div className="mfa-modal">
        <div className="mfa-modal-head">
          <h3>Verificación en dos pasos</h3>
          <button className="mfa-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        {/* --- MFA ya activo: desactivar --- */}
        {mfaEnabled && (
          <div className="mfa-body">
            <p className="mfa-status mfa-status--on">🔒 Está activada en su cuenta.</p>
            <p className="mfa-desc">
              Para desactivarla, confirme con su contraseña actual o con un código de 6 dígitos de su
              app de autenticación.
            </p>
            <div className="form-group">
              <label className="form-label">Contraseña o código de verificación</label>
              <input
                className="form-input"
                type="password"
                autoComplete="off"
                value={confirmValue}
                onChange={e => setConfirmValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && desactivar()}
              />
            </div>
            <button className="btn-login mfa-btn-danger" onClick={desactivar} disabled={busy}>
              {busy ? 'Un momento…' : 'Desactivar verificación en dos pasos'}
            </button>
          </div>
        )}

        {/* --- MFA inactivo: activar --- */}
        {!mfaEnabled && step === 'idle' && (
          <div className="mfa-body">
            <p className="mfa-status">Su cuenta entra solo con correo y contraseña.</p>
            <p className="mfa-desc">
              Active una capa extra: además de su contraseña, al iniciar sesión se le pedirá un
              código temporal de una app como Google Authenticator o Authy.
            </p>
            <button className="btn-login" onClick={iniciarEnrolamiento} disabled={busy}>
              {busy ? 'Un momento…' : 'Activar verificación en dos pasos'}
            </button>
          </div>
        )}

        {/* --- Paso: escanear QR y confirmar --- */}
        {!mfaEnabled && step === 'scan' && setupInfo && (
          <div className="mfa-body">
            <p className="mfa-desc">
              1. Escanee este código QR con su app de autenticación.
            </p>
            <div className="mfa-qr">
              {/* El QR ya viene como imagen SVG embebida (data URI) desde el backend. */}
              <img src={setupInfo.qrSvg} alt="Código QR para la app de autenticación" width={180} height={180} />
            </div>
            <p className="mfa-desc mfa-secret-hint">
              ¿No puede escanear? Ingrese esta clave manualmente:
              <code className="mfa-secret">{setupInfo.secretBase32}</code>
            </p>
            <div className="form-group">
              <label className="form-label">2. Ingrese el código de 6 dígitos que muestra la app</label>
              <input
                className="form-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={firstCode}
                onChange={e => setFirstCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && confirmarEnrolamiento()}
              />
            </div>
            <button
              className="btn-login"
              onClick={confirmarEnrolamiento}
              disabled={busy || firstCode.length !== 6}
            >
              {busy ? 'Verificando…' : 'Confirmar y activar'}
            </button>
          </div>
        )}

        {/* --- Paso: mostrar códigos de respaldo (una sola vez) --- */}
        {!mfaEnabled && step === 'backup' && (
          <div className="mfa-body">
            <p className="mfa-status mfa-status--on">🔒 ¡Listo! La verificación en dos pasos quedó activa.</p>
            <p className="mfa-desc">
              Guarde estos <strong>códigos de respaldo</strong> en un lugar seguro. Cada uno sirve
              <strong> una sola vez</strong> para entrar si pierde acceso a su teléfono.
              <strong> No se volverán a mostrar.</strong>
            </p>
            <ul className="mfa-backup-list">
              {backupCodes.map(c => <li key={c}><code>{c}</code></li>)}
            </ul>
            <button className="btn-login" onClick={terminarEnrolamiento}>
              Ya guardé mis códigos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
