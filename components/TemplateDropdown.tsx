'use client';
import { useState, useRef, useEffect } from 'react';
import { TEMPLATES } from '@/lib/templateContent';

interface TemplateDropdownProps {
  reqId: string;
  companyName: string;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}

export default function TemplateDropdown({ reqId, companyName, onToast }: TemplateDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<'docx' | 'pdf' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera del dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Solo mostrar si existe plantilla para este requisito
  if (!TEMPLATES[reqId]) return null;

  const handleDocx = async () => {
    setLoading('docx');
    setOpen(false);
    try {
      const { descargarPlantillaDocx } = await import('@/lib/docxTemplates');
      await descargarPlantillaDocx(reqId, companyName);
      onToast('✓ Plantilla Word descargada', 'green');
    } catch {
      onToast('Error al generar la plantilla Word', 'yellow');
    } finally {
      setLoading(null);
    }
  };

  const handlePdf = async () => {
    setLoading('pdf');
    setOpen(false);
    try {
      const { generarPlantillaPDF } = await import('@/lib/pdfExport');
      await generarPlantillaPDF(reqId, companyName);
      onToast('✓ Plantilla PDF descargada', 'green');
    } catch {
      onToast('Error al generar la plantilla PDF', 'yellow');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="tpl-dropdown" ref={ref}>
      <button
        className="btn-tpl-trigger"
        onClick={() => setOpen(o => !o)}
        disabled={loading !== null}
      >
        {loading ? <span className="spin">↻</span> : '📄'}
        {loading === 'docx' ? ' Generando Word...' : loading === 'pdf' ? ' Generando PDF...' : ' Generar plantilla'}
        {!loading && <span className="tpl-chevron">{open ? '▲' : '▼'}</span>}
      </button>

      {open && (
        <div className="tpl-menu">
          <button className="tpl-menu-item" onClick={handleDocx}>
            <span className="tpl-menu-icon">📝</span>
            <div>
              <div className="tpl-menu-label">Descargar como Word</div>
              <div className="tpl-menu-sub">Editable en Word / LibreOffice (.docx)</div>
            </div>
          </button>
          <button className="tpl-menu-item" onClick={handlePdf}>
            <span className="tpl-menu-icon">📄</span>
            <div>
              <div className="tpl-menu-label">Descargar como PDF</div>
              <div className="tpl-menu-sub">Formato final para presentar (.pdf)</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
