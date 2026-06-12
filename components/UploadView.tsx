'use client';
import { useRef, useState } from 'react';
import { REQUISITOS } from '@/lib/requisitos';
import { extractDocumentText } from '@/lib/extractText';
import type { UploadedDoc, UserRole } from '@/lib/types';

interface UploadViewProps {
  uploadedDocs: Record<string, UploadedDoc>;
  role: UserRole;
  onUpload: (reqId: string, doc: UploadedDoc) => void;
  onStartAnalysis: () => void;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}

export default function UploadView({ uploadedDocs, role, onUpload, onStartAnalysis, onToast }: UploadViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingReqId = useRef<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  // Solo el administrador puede subir documentos y ejecutar el análisis
  const canEdit = role === 'administrador';

  const count = Object.keys(uploadedDocs).length;

  const triggerUpload = (reqId: string) => {
    if (!canEdit) {
      onToast('Solo el administrador puede subir documentos', 'yellow');
      return;
    }
    pendingReqId.current = reqId;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const reqId = pendingReqId.current;
    if (!file || !reqId) return;

    setUploading(reqId);
    const result = await extractDocumentText(file);
    onUpload(reqId, result);
    setUploading(null);

    const req = REQUISITOS.find(r => r.id === reqId);
    if (req) {
      const words = result.wordCount ?? 0;
      const info = result.extractedFully
        ? `${words.toLocaleString('es-CL')} palabras extraídas`
        : 'solo nombre de archivo';
      onToast(`✓ "${file.name}" cargado · ${info}`, 'green');
    }
    pendingReqId.current = null;
  };

  return (
    <div className="upload-view">
      {/* Step indicator */}
      <div className="step-indicator">
        <div className="step-item">
          <div className="step-num active">1</div>
          <div className="step-label active">Subir documentos</div>
        </div>
        <div className="step-connector" />
        <div className="step-item">
          <div className="step-num">2</div>
          <div className="step-label">Análisis automático</div>
        </div>
        <div className="step-connector" />
        <div className="step-item">
          <div className="step-num">3</div>
          <div className="step-label">Ver diagnóstico</div>
        </div>
      </div>

      {/* Hero */}
      <div className="upload-hero">
        <h2>Suba los documentos de su empresa</h2>
        <p>
          Para cada requisito de la Ley 21.719, suba el documento correspondiente.
          El sistema lee el contenido real de PDF, Word y Excel para analizarlo contra los criterios legales.
        </p>
      </div>

      {/* Grid */}
      <div className="req-upload-grid" data-tour="upload-zone">
        {REQUISITOS.map(r => {
          const doc = uploadedDocs[r.id];
          const isUploaded = !!doc;
          const isUploading = uploading === r.id;
          return (
            <div
              key={r.id}
              className={`req-upload-item${isUploaded ? ' uploaded' : ''}${isUploading ? ' uploading' : ''}`}
            >
              <div className="req-num">{r.num}</div>
              <div className="req-upload-info">
                <div className="req-upload-name">{r.nombre}</div>
                <div className="req-upload-art">{r.art}</div>
                <div className="req-upload-desc">{r.desc}</div>
              </div>
              <div className="req-upload-action">
                {isUploading ? (
                  <div className="uploading-tag"><span className="spin">↻</span> Extrayendo texto...</div>
                ) : isUploaded ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div className="upload-file-tag">✓ {doc.name}</div>
                    <div style={{ fontSize: 10, color: doc.extractedFully ? 'var(--green)' : 'var(--yellow)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {doc.extractedFully
                        ? `${(doc.wordCount ?? 0).toLocaleString('es-CL')} palabras · ${doc.extractMethod}`
                        : `⚠ ${doc.extractMethod}`}
                    </div>
                    {canEdit && (
                      <button className="btn-upload-req" style={{ fontSize: 10, padding: '3px 10px' }}
                        onClick={() => triggerUpload(r.id)}>
                        ↺ Reemplazar
                      </button>
                    )}
                  </div>
                ) : canEdit ? (
                  <button className="btn-upload-req" onClick={() => triggerUpload(r.id)}>
                    ⬆ Subir archivo
                  </button>
                ) : (
                  <div className="role-lock-tag" title="Solo el administrador puede subir documentos">🔒 Sin acceso</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="upload-cta">
        <div className="upload-cta-text">
          <h3>
            {count === 0
              ? 'Suba al menos 1 documento para comenzar'
              : count < 5
                ? `${count} documento${count > 1 ? 's' : ''} cargado${count > 1 ? 's' : ''} — puede analizar ahora o subir más`
                : `${count} documentos cargados — listo para el análisis`}
          </h3>
          <p>
            {count === 0
              ? 'El sistema lee el contenido real del documento y lo contrasta con la ley'
              : count < 5
                ? 'Mientras más documentos suba, más completo será el diagnóstico'
                : 'Cobertura excelente. Ejecute el análisis para ver su diagnóstico.'}
          </p>
        </div>
        {canEdit ? (
          <button
            className="btn-analyze"
            data-tour="analyze-btn"
            disabled={count === 0}
            onClick={onStartAnalysis}
          >
            🔬 Analizar ahora →
          </button>
        ) : (
          <div className="role-lock-btn" data-tour="analyze-btn" title={`El rol "${role}" no puede ejecutar el análisis`}>
            🔒 Solo administrador puede analizar
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileSelected}
      />
    </div>
  );
}
