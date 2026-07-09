'use client';
import { useState, useRef, useEffect } from 'react';
import { TEMPLATES } from '@/lib/templateContent';
import { FileDownIcon } from './Icons';

interface TemplateDropdownProps {
  reqId: string;
  companyName: string;
  onToast: (msg: string, type: 'green' | 'yellow' | 'blue') => void;
}

export default function TemplateDropdown({ reqId, companyName, onToast }: TemplateDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<'docx' | 'pdf' | null>(null);
  // Coordenadas del menú en el viewport (necesarias para position:fixed)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);

  // Calcula la posición del menú relativa al viewport
  const calcPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, left: rect.left });
  };

  // Cerrar al hacer clic fuera: comprueba tanto el trigger como el menú
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // Reubicar el menú si el usuario hace scroll o redimensiona la ventana
  useEffect(() => {
    if (!open) return;
    const update = () => calcPos();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  // Solo mostrar si existe plantilla para este requisito
  if (!TEMPLATES[reqId]) return null;

  const handleToggle = () => {
    if (!open) calcPos();
    setOpen(o => !o);
  };

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
    <div className="tpl-dropdown">
      <button
        ref={triggerRef}
        className="btn-tpl-trigger"
        onClick={handleToggle}
        disabled={loading !== null}
      >
        {loading ? <span className="spin">↻</span> : <FileDownIcon size={13} />}
        {loading === 'docx' ? ' Generando Word...' : loading === 'pdf' ? ' Generando PDF...' : ' Generar plantilla'}
        {!loading && <span className="tpl-chevron">{open ? '▲' : '▼'}</span>}
      </button>

      {/* Menú renderizado con position:fixed para escapar del overflow:hidden de .brecha-card */}
      {open && menuPos && (
        <div
          ref={menuRef}
          className="tpl-menu"
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
        >
          <button className="tpl-menu-item" onClick={handleDocx}>
            <span className="tpl-menu-icon"><FileDownIcon size={15} /></span>
            <div>
              <div className="tpl-menu-label">Descargar como Word</div>
              <div className="tpl-menu-sub">Editable en Word / LibreOffice (.docx)</div>
            </div>
          </button>
          <button className="tpl-menu-item" onClick={handlePdf}>
            <span className="tpl-menu-icon"><FileDownIcon size={15} /></span>
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
