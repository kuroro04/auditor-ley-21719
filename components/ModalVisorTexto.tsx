'use client';
import { useState } from 'react';

interface ModalVisorTextoProps {
  titulo: string;
  nombreArchivo: string;
  texto: string;
  terminoResaltado?: string;
  onClose: () => void;
  onToast: (msg: string, type: 'green' | 'blue' | 'yellow') => void;
}

export default function ModalVisorTexto({
  titulo,
  nombreArchivo,
  texto,
  terminoResaltado,
  onClose,
  onToast,
}: ModalVisorTextoProps) {
  const [busqueda, setBusqueda] = useState(terminoResaltado || '');

  const copiarTodo = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      onToast('Texto completo copiado al portapapeles', 'green');
    } catch {
      onToast('No se pudo copiar automáticamente', 'yellow');
    }
  };

  // Resaltado de términos de búsqueda dentro del texto
  const renderTextoResaltado = () => {
    if (!busqueda || busqueda.trim().length < 2) {
      return <span>{texto}</span>;
    }

    try {
      // Escapar caracteres especiales para RegExp
      const escaped = busqueda.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      const partes = texto.split(regex);

      return (
        <span>
          {partes.map((parte, i) =>
            regex.test(parte) ? (
              <mark key={i} className="visor-highlight">{parte}</mark>
            ) : (
              <span key={i}>{parte}</span>
            )
          )}
        </span>
      );
    } catch {
      return <span>{texto}</span>;
    }
  };

  return (
    <div className="guia-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="visor-modal-card" onClick={e => e.stopPropagation()}>
        <div className="guia-modal-header">
          <div className="guia-modal-title-wrap">
            <span className="guia-modal-badge">Visor de Evidencia Documental</span>
            <h3>{titulo}</h3>
            <span className="guia-modal-sub">Archivo: {nombreArchivo}</span>
          </div>
          <button className="guia-modal-close" onClick={onClose} aria-label="Cerrar visor">
            ✕
          </button>
        </div>

        <div className="visor-search-bar">
          <div className="visor-input-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar en el documento..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="visor-search-input"
            />
            {busqueda && (
              <button className="visor-clear-btn" onClick={() => setBusqueda('')}>✕</button>
            )}
          </div>
          <button className="visor-copy-btn" onClick={copiarTodo}>
            Copiar texto
          </button>
        </div>

        <div className="visor-modal-body">
          <div className="visor-document-box">
            {renderTextoResaltado()}
          </div>
        </div>

        <div className="guia-modal-footer">
          <span className="visor-stats">
            {texto.trim().split(/\s+/).filter(Boolean).length.toLocaleString('es-CL')} palabras extraídas
          </span>
          <button className="guia-footer-btn secondary" onClick={onClose}>
            Cerrar visor
          </button>
        </div>
      </div>
    </div>
  );
}
