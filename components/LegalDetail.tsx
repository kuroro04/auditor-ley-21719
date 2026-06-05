'use client';
import type { Requisito } from '@/lib/types';

interface LegalDetailProps {
  requisito: Requisito;
}

export default function LegalDetail({ requisito }: LegalDetailProps) {
  return (
    <div className="legal-detail">
      <div className="legal-detail-header">Ficha legal</div>
      <div className="legal-detail-grid">

        <div className="legal-item">
          <span className="legal-item-icon">📜</span>
          <div className="legal-item-body">
            <div className="legal-item-label">Artículo de la ley</div>
            <div className="legal-item-value">{requisito.legalDetail.articulo}</div>
          </div>
        </div>

        <div className="legal-item">
          <span className="legal-item-icon">📂</span>
          <div className="legal-item-body">
            <div className="legal-item-label">Documento que lo acredita</div>
            <div className="legal-item-value">{requisito.legalDetail.documentoEvidencia}</div>
          </div>
        </div>

        <div className="legal-item">
          <span className="legal-item-icon">⚖</span>
          <div className="legal-item-body">
            <div className="legal-item-label">Multa máxima aplicable</div>
            <div className="legal-item-value multa">{requisito.multa}</div>
          </div>
        </div>

        <div className="legal-item full">
          <span className="legal-item-icon">💬</span>
          <div className="legal-item-body">
            <div className="legal-item-label">Qué exige la ley</div>
            <div className="legal-item-value">{requisito.legalDetail.exigenciaSimple}</div>
          </div>
        </div>

      </div>
    </div>
  );
}
