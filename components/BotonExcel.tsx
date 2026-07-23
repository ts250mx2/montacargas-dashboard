'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { exportarExcel, type ExcelOpciones } from '@/lib/exportar';

interface BotonExcelProps<T> {
  /** Fábrica de opciones: se evalúa al hacer clic, no en cada render. */
  opciones: () => ExcelOpciones<T>;
  disabled?: boolean;
}

export default function BotonExcel<T>({ opciones, disabled }: BotonExcelProps<T>) {
  const [exportando, setExportando] = useState(false);

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarExcel(opciones());
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo generar el archivo de Excel');
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
      {exportando ? <Loader2 size={18} className="girando" /> : <FileSpreadsheet size={18} />}
      {exportando ? 'Generando...' : 'Exportar Excel'}
    </button>
  );
}
