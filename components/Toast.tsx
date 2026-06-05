'use client';
import type { ToastItem } from '@/lib/types';

const BORDER: Record<ToastItem['type'], string> = {
  green: '3px solid #16a34a',
  yellow: '3px solid #d97706',
  red: '3px solid #dc2626',
  blue: '3px solid #2563eb',
};

export default function Toast({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} className="toast-item" style={{ borderLeft: BORDER[t.type] }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
