'use client';

import { useState, type RefObject } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { exportarPantallaPdf, type PdfOpciones } from '@/lib/exportar';

interface BotonPdfProps extends PdfOpciones {
  /** Elemento a capturar tal como se ve en pantalla. */
  objetivo: RefObject<HTMLElement | null>;
  disabled?: boolean;
}

export default function BotonPdf({ objetivo, disabled, ...opciones }: BotonPdfProps) {
  const [exportando, setExportando] = useState(false);

  const exportar = async () => {
    if (!objetivo.current) return;
    setExportando(true);
    try {
      await exportarPantallaPdf(objetivo.current, opciones);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo generar el PDF');
    } finally {
      setExportando(false);
    }
  };

  return (
    <button
      type="button"
      className="btnGhost"
      onClick={exportar}
      disabled={disabled || exportando}
      data-export-ocultar
    >
      {exportando ? <Loader2 size={18} className="girando" /> : <FileDown size={18} />}
      {exportando ? 'Generando...' : 'Exportar PDF'}
    </button>
  );
}
