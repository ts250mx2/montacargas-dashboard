'use client';

import { useRef, useState } from 'react';
import { Paperclip, X, Loader2, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { money } from '@/lib/format';

export interface ConceptoLeido {
  clave: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  importe: number;
  id_producto: number | null;
  producto: string | null;
  criterio: 'sku' | 'descripcion' | 'ninguno';
}

export interface LecturaPdf {
  nombreOriginal: string;
  cfdi: {
    uuid: string;
    serie: string;
    folio: string;
    fecha: string;
    rfcEmisor: string;
    rfcReceptor: string;
    nombreEmisor: string;
    nombreReceptor: string;
    subtotal: number | null;
    total: number | null;
    origen: 'xml' | 'qr' | 'texto' | 'ninguno';
  };
  cliente: { id: number; razon_social: string; rfc: string; dias_credito: number } | null;
  conceptos: ConceptoLeido[];
  aviso?: string;
}

const ETIQUETA_ORIGEN: Record<LecturaPdf['cfdi']['origen'], string> = {
  xml: 'XML del CFDI embebido (exacto)',
  qr: 'Código QR del SAT (confiable)',
  texto: 'Texto del PDF (revisa los datos)',
  ninguno: 'No se reconoció estructura de CFDI',
};

interface LectorPdfFacturaProps {
  archivo: File | null;
  lectura: LecturaPdf | null;
  onCambio: (archivo: File | null, lectura: LecturaPdf | null) => void;
}

export default function LectorPdfFactura({ archivo, lectura, onCambio }: LectorPdfFacturaProps) {
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
      const res = await fetch('/api/facturas/leer-pdf', { method: 'POST', body: cuerpo });
      const datos = await res.json();

      if (!res.ok) {
        setError(datos.message || 'No se pudo leer el PDF');
        onCambio(elegido, null); // se conserva el archivo: se adjunta aunque no se haya leído
        return;
      }
      onCambio(elegido, datos);
    } catch {
      setError('Error de conexión al leer el PDF');
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

  const empatados = lectura?.conceptos.filter(c => c.id_producto !== null) ?? [];
  const sinEmpatar = lectura?.conceptos.filter(c => c.id_producto === null) ?? [];

  return (
    <div className="lectorPdf">
      {!archivo ? (
        <button type="button" className="lectorZona" onClick={() => entrada.current?.click()}>
          <Paperclip size={18} />
          <span>
            <strong>Adjuntar PDF de la factura</strong>
            <small>Si es un CFDI se leen los datos y las partidas automáticamente</small>
          </span>
        </button>
      ) : (
        <div className="lectorArchivo">
          <FileText size={18} />
          <span className="lectorNombre">{archivo.name}</span>
          {leyendo && <Loader2 size={16} className="girando" />}
          <button type="button" className="iconBtn iconBtnDanger" onClick={quitar} title="Quitar PDF">
            <X size={15} />
          </button>
        </div>
      )}

      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf"
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
            {lectura.cliente
              ? <div><dt>Cliente</dt><dd className="lectorOk">{lectura.cliente.razon_social}</dd></div>
              : (lectura.cfdi.rfcReceptor || lectura.cfdi.rfcEmisor) && (
                  <div>
                    <dt>Cliente</dt>
                    <dd className="lectorPendiente">
                      Sin empate ({lectura.cfdi.rfcReceptor || lectura.cfdi.rfcEmisor}) — elígelo abajo
                    </dd>
                  </div>
                )}
            {lectura.cfdi.total !== null && (
              <div><dt>Total en el PDF</dt><dd>{money(lectura.cfdi.total)}</dd></div>
            )}
            {lectura.cfdi.uuid && (
              <div><dt>UUID</dt><dd className="lectorUuid">{lectura.cfdi.uuid}</dd></div>
            )}
          </dl>

          {lectura.conceptos.length > 0 && (
            <div className="lectorConceptos">
              <p className="lectorConceptosTitulo">
                {lectura.conceptos.length} conceptos leídos ·{' '}
                <strong>{empatados.length} se agregarán como partidas</strong>
                {sinEmpatar.length > 0 && ` · ${sinEmpatar.length} sin producto en el catálogo`}
              </p>
              <ul>
                {lectura.conceptos.map((c, i) => (
                  <li key={i} className={c.id_producto ? 'lectorOk' : 'lectorPendiente'}>
                    {c.id_producto ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    <span className="lectorConceptoTexto">
                      {c.clave && <code>{c.clave}</code>} {c.descripcion}
                    </span>
                    <span className="lectorConceptoNum">
                      {c.cantidad} × {money(c.precio)}
                    </span>
                  </li>
                ))}
              </ul>
              {sinEmpatar.length > 0 && (
                <p className="lectorAviso">
                  Las partidas sin empate no se agregan: captúralas a mano o da de alta el producto.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
