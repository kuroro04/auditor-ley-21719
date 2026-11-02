'use client';
import { useState } from 'react';
import type { ClausulaEjemplo } from '@/lib/guiaClausulas';

interface ModalGuiaClausulaProps {
  guia: ClausulaEjemplo;
  criterioName: string;
  onClose: () => void;
  onToast: (msg: string, type: 'green' | 'blue' | 'yellow') => void;
}

export default function ModalGuiaClausula({
  guia,
  criterioName,
  onClose,
  onToast,
}: ModalGuiaClausulaProps) {
  const [copiado, setCopiado] = useState(false);

  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(guia.ejemplo);
      setCopiado(true);
      onToast('Cláusula legal copiada al portapapeles', 'green');
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      onToast('No se pudo copiar automáticamente. Por favor seleccione el texto.', 'yellow');
    }
  };

  return (
    <div className="guia-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="guia-modal-card" onClick={e => e.stopPropagation()}>
        <div className="guia-modal-header">
          <div className="guia-modal-title-wrap">
            <span className="guia-modal-badge">Asistente de Redacción Legal</span>
            <h3>{guia.titulo}</h3>
            <span className="guia-modal-sub">{criterioName}</span>
          </div>
          <button className="guia-modal-close" onClick={onClose} aria-label="Cerrar modal">
            ✕
          </button>
        </div>

        <div className="guia-modal-body">
          <div className="guia-fundamento-box">
            <span className="guia-fundamento-icon">⚖</span>
            <span>{guia.fundamento}</span>
          </div>

          <div className="guia-ejemplo-section">
            <div className="guia-ejemplo-hdr">
              <span className="guia-label">Redacción Modelo Recomendada:</span>
              <button
                className={`guia-copy-btn ${copiado ? 'copiado' : ''}`}
                onClick={copiarTexto}
              >
                {copiado ? '✓ Copiado' : 'Copiar cláusula'}
              </button>
            </div>
            <div className="guia-ejemplo-text">
              {guia.ejemplo}
            </div>
          </div>

          <div className="guia-consejo-box">
            <span className="guia-consejo-title">💡 Recomendación Práctica:</span>
            <p>{guia.consejo}</p>
          </div>
        </div>

        <div className="guia-modal-footer">
          <button className="guia-footer-btn secondary" onClick={onClose}>
            Entendido
          </button>
          <button className="guia-footer-btn primary" onClick={copiarTexto}>
            {copiado ? '✓ Texto Copiado' : 'Copiar para mi documento'}
          </button>
        </div>
      </div>
    </div>
  );
}
