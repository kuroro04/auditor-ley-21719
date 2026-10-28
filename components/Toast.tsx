'use client';
import type { ToastItem } from '@/lib/types';

export default function Toast({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 400,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => {
        let title =
          t.type === 'green'
            ? 'Operación exitosa'
            : t.type === 'yellow'
            ? 'Atención'
            : t.type === 'red'
            ? 'Error'
            : 'Información';
        let body = t.msg;

        if (t.msg.startsWith('✓ "') && t.msg.includes('" cargado')) {
          title = 'Documento cargado';
          body = t.msg.replace('✓ ', '');
        }

        return (
          <div key={t.id} className={`toast-card toast-${t.type}`} style={{ pointerEvents: 'auto' }}>
            <div className={`toast-icon-wrap ${t.type}`} aria-hidden="true">
              {t.type === 'green' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : t.type === 'yellow' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              ) : t.type === 'red' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
            </div>
            <div className="toast-content">
              <div className="toast-title">{title}</div>
              <div className="toast-body">{body}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
