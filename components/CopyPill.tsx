'use client';

import React, { useState } from 'react';

interface CopyPillProps {
  text: string;
  label?: string;
  title?: string;
  className?: string;
  ariaLabel?: string;
}

export function CopyPill({ text, label, title = 'Clic para copiar', className = '', ariaLabel }: CopyPillProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback manual si clipboard API falla
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      className={`copy-pill ${copied ? 'copied' : ''} ${className}`}
      onClick={handleCopy}
      title={copied ? '¡Copiado al portapapeles!' : title}
      aria-label={ariaLabel || (copied ? 'Texto copiado al portapapeles' : `Copiar ${text}`)}
    >
      <span className="copy-pill-text">{label || text}</span>
      {copied ? (
        <span className="copy-pill-icon check" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="copy-feedback-label">¡Copiado!</span>
        </span>
      ) : (
        <span className="copy-pill-icon copy" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
        </span>
      )}
    </button>
  );
}
