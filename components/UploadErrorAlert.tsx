'use client';
import type { UploadFailure } from '@/lib/documentUpload';

interface UploadErrorAlertProps {
  failure: UploadFailure;
  onDismiss: () => void;
}

// Aviso persistente (a diferencia del toast, que desaparece a los 4 s) para
// cuando el servidor no aceptó un documento: el usuario tiene que poder leer
// con calma qué pasó y qué hacer.
export default function UploadErrorAlert({ failure, onDismiss }: UploadErrorAlertProps) {
  return (
    <div className={`upload-error-alert kind-${failure.kind}`} role="alert">
      <svg className="upload-error-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div className="upload-error-body">
        <div className="upload-error-title">{failure.titulo}</div>
        <p className="upload-error-msg">{failure.mensaje}</p>
        <p className="upload-error-action"><strong>Qué hacer:</strong> {failure.accion}</p>
      </div>
      <button type="button" className="upload-error-close" aria-label="Cerrar aviso" onClick={onDismiss}>×</button>
    </div>
  );
}
