'use client';

import { useRef, useState } from 'react';
import { Paperclip, X, Loader2, CheckCircle2, AlertTriangle, FileText, FileCode2 } from 'lucide-react';
import { money } from '@/lib/format';

export interface LecturaComprobante {
  nombreOriginal: string;
  extension: 'pdf' | 'xml';
  cfdi: {
    uuid: string;
    serie: string;
    folio: string;
    fecha: string;
    rfcEmisor: string;
    nombreEmisor: string;
    subtotal: number | null;
    iva: number | null;
    total: number | null;
    origen: 'xml' | 'qr' | 'texto' | 'ninguno';
    conceptos: {
      clave: string;
      descripcion: string;
      cantidad: number;
      precio: number;
      importe: number;
    }[];
  };
  proveedor: { id: number; razon_social: string; rfc: string } | null;
  duplicado: { id: number; concepto: string; total: number } | null;
  aviso?: string;
}

const ETIQUETA_ORIGEN: Record<LecturaComprobante['cfdi']['origen'], string> = {
  xml: 'XML del CFDI (exacto)',
  qr: 'Código QR del SAT (confiable)',
  texto: 'Texto del PDF (revisa los datos)',
  ninguno: 'No se reconoció estructura de CFDI',
};

interface Props {
  archivo: File | null;
  lectura: LecturaComprobante | null;
  onCambio: (archivo: File | null, lectura: LecturaComprobante | null) => void;
}

export default function LectorComprobanteGasto({ archivo, lectura, onCambio }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState('');

  const seleccionar = async (elegido: File | undefined) => {
    if (!elegido) return;
    setError('');
    setLeyendo(true);
    try {
      const cuerpo = new FormData();
      cuerpo.append('archivo', elegido);
      const res = await fetch('/api/gastos/leer-comprobante', { method: 'POST', body: cuerpo });
      const datos = await res.json();

      if (!res.ok) {
        setError(datos.message || 'No se pudo leer el comprobante');
        onCambio(elegido, null); // se conserva: se adjunta aunque no se haya podido leer
        return;
      }
      onCambio(elegido, datos);
    } catch {
      setError('Error de conexión al leer el comprobante');
      onCambio(elegido, null);
    } finally {
      setLeyendo(false);
    }
  };

  const quitar = () => {
    if (entrada.current) entrada.current.value = '';
    setError('');
    onCambio(null, null);
  };

  const esXml = lectura?.extension === 'xml' || archivo?.name.toLowerCase().endsWith('.xml');

  return (
    <div className="lectorPdf">
      {!archivo ? (
        <button type="button" className="lectorZona" onClick={() => entrada.current?.click()}>
          <Paperclip size={18} />
          <span>
            <strong>Adjuntar comprobante (PDF o XML)</strong>
            <small>Si es un CFDI se llenan proveedor, folio, fecha e importes automáticamente</small>
          </span>
        </button>
      ) : (
        <div className="lectorArchivo">
          {esXml ? <FileCode2 size={18} /> : <FileText size={18} />}
          <span className="lectorNombre">{archivo.name}</span>
          {leyendo && <Loader2 size={16} className="girando" />}
          <button type="button" className="iconBtn iconBtnDanger" onClick={quitar} title="Quitar comprobante">
            <X size={15} />
          </button>
        </div>
      )}

      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf,application/xml,text/xml,.xml"
        hidden
        onChange={e => seleccionar(e.target.files?.[0])}
      />

      {error && (
        <p className="lectorAviso lectorAvisoError">
          <AlertTriangle size={14} /> {error} — el archivo se adjuntará de todos modos.
        </p>
      )}

      {lectura?.aviso && (
        <p className="lectorAviso lectorAvisoError">
          <AlertTriangle size={14} /> {lectura.aviso}
        </p>
      )}

      {lectura?.duplicado && (
        <p className="lectorAviso lectorAvisoError">
          <AlertTriangle size={14} />
          Este comprobante ya está capturado en el gasto #{lectura.duplicado.id} ·{' '}
          {lectura.duplicado.concepto} · {money(lectura.duplicado.total)}
        </p>
      )}

      {lectura && !lectura.aviso && (
        <div className="lectorResultado">
          <p className="lectorFuente">
            <CheckCircle2 size={14} /> Origen de los datos: {ETIQUETA_ORIGEN[lectura.cfdi.origen]}
          </p>

          <dl className="lectorDatos">
            {lectura.cfdi.folio && (
              <div><dt>Folio</dt><dd>{lectura.cfdi.serie}{lectura.cfdi.serie && '-'}{lectura.cfdi.folio}</dd></div>
            )}
            {lectura.cfdi.fecha && <div><dt>Fecha</dt><dd>{lectura.cfdi.fecha}</dd></div>}
            <div>
              <dt>Proveedor</dt>
              <dd className={lectura.proveedor ? 'lectorOk' : 'lectorPendiente'}>
                {lectura.proveedor
                  ? lectura.proveedor.razon_social
                  : `${lectura.cfdi.nombreEmisor || 'Sin empate'} (${lectura.cfdi.rfcEmisor || 'sin RFC'}) — elígelo abajo`}
              </dd>
            </div>
            {lectura.cfdi.subtotal !== null && (
              <div><dt>Subtotal</dt><dd>{money(lectura.cfdi.subtotal)}</dd></div>
            )}
            {lectura.cfdi.iva !== null && <div><dt>IVA</dt><dd>{money(lectura.cfdi.iva)}</dd></div>}
            {lectura.cfdi.total !== null && (
              <div><dt>Total</dt><dd><strong>{money(lectura.cfdi.total)}</strong></dd></div>
            )}
            {lectura.cfdi.uuid && (
              <div><dt>UUID</dt><dd className="lectorUuid">{lectura.cfdi.uuid}</dd></div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
