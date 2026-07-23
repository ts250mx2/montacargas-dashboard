'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Search, Plus, X, Check, Eye } from 'lucide-react';
import { money, fecha, badgeEstadoCobro } from '@/lib/format';
import { describirPeriodo, enRango, filtroPeriodo, rangoDeFiltro, type FiltroPeriodo } from '@/lib/periodos';
import PeriodoFilter from '@/components/PeriodoFilter';
import BotonExcel from '@/components/BotonExcel';
import LectorPdfFactura, { type LecturaPdf } from '@/components/LectorPdfFactura';

interface Factura {
  id: number;
  folio: string;
  folio_interno: string;
  fecha: string;
  cliente: string;
  vendedor: string | null;
  forma_pago: string | null;
  fecha_vencimiento: string;
  estado: string;
  total: number;
  cobrado: number;
  saldo: number;
  estado_cobro: string;
}

const FILTROS = ['Todas', 'Al corriente', 'Por vencer', 'Pago parcial', 'Vencida', 'Pagada', 'Cancelada'];

export default function FacturasPage() {
  const router = useRouter();
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtro, setFiltro] = useState('Todas');
  const [periodo, setPeriodo] = useState<FiltroPeriodo>(() => filtroPeriodo('todo'));
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfAdjunto, setPdfAdjunto] = useState<File | null>(null);
  const [lecturaPdf, setLecturaPdf] = useState<LecturaPdf | null>(null);
  const [formData, setFormData] = useState({
    id_cliente: 0, id_vendedor: 0, id_forma_pago: 0, folio_interno: '',
    fecha: new Date().toISOString().slice(0, 10),
    fecha_vencimiento: '', notas: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const res = await fetch('/api/facturas');
    const data = await res.json();
    setFacturas(data.facturas || []);
    setClientes(data.clientes || []);
    setVendedores(data.vendedores || []);
    setFormasPago(data.formasPago || []);
    setLoading(false);
  };

  /** Rellena el formulario con lo que se pudo leer del PDF, sin pisar lo ya capturado. */
  const aplicarLecturaPdf = (archivo: File | null, lectura: LecturaPdf | null) => {
    setPdfAdjunto(archivo);
    setLecturaPdf(lectura);
    if (!lectura) return;

    const { cfdi, cliente } = lectura;
    const folioPdf = [cfdi.serie, cfdi.folio].filter(Boolean).join('-');

    setFormData(previo => ({
      ...previo,
      id_cliente: cliente?.id ?? previo.id_cliente,
      folio_interno: folioPdf ? folioPdf.toUpperCase() : previo.folio_interno,
      fecha: cfdi.fecha || previo.fecha,
      notas: cfdi.uuid && !previo.notas ? `CFDI ${cfdi.uuid}` : previo.notas,
    }));
  };

  const cerrarModal = () => {
    setIsModalOpen(false);
    setPdfAdjunto(null);
    setLecturaPdf(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_cliente) { alert('Selecciona un cliente'); return; }
    if (!formData.folio_interno.trim()) { alert('El folio interno es obligatorio'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Error al crear la factura'); return; }

      // La factura ya existe: ahora se le cuelga el PDF y las partidas leídas
      const avisos: string[] = [];

      if (pdfAdjunto) {
        const cuerpo = new FormData();
        cuerpo.append('archivo', pdfAdjunto);
        const resAdjunto = await fetch(`/api/facturas/${data.id}/adjunto`, { method: 'POST', body: cuerpo });
        if (!resAdjunto.ok) {
          const err = await resAdjunto.json().catch(() => ({}));
          avisos.push(`No se pudo adjuntar el PDF: ${err.message || 'error desconocido'}`);
        }
      }

      const lineas = (lecturaPdf?.conceptos ?? [])
        .filter(c => c.id_producto !== null)
        .map(c => ({ id_producto: c.id_producto, cantidad: c.cantidad, precio: c.precio, descuento: 0 }));

      if (lineas.length > 0) {
        const resLineas = await fetch(`/api/facturas/${data.id}/detalle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineas }),
        });
        const datosLineas = await resLineas.json().catch(() => ({}));
        if (!resLineas.ok) avisos.push(`No se pudieron agregar las partidas: ${datosLineas.message || ''}`);
        else if (datosLineas.errores?.length) avisos.push(datosLineas.errores.join('\n'));
      }

      if (avisos.length) alert(avisos.join('\n'));

      // Ir al detalle para revisar y completar la captura
      router.push(`/facturas/${data.id}`);
    } catch { alert('Error de conexión'); }
    finally { setSaving(false); }
  };

  const rango = useMemo(() => rangoDeFiltro(periodo), [periodo]);

  const filtered = facturas.filter(f => {
    const coincidePeriodo = enRango(f.fecha, rango);
    const coincideFiltro = filtro === 'Todas' || f.estado_cobro === filtro;
    const q = searchTerm.toLowerCase();
    const coincideBusqueda =
      f.folio.toLowerCase().includes(q) ||
      f.folio_interno.toLowerCase().includes(q) ||
      f.cliente.toLowerCase().includes(q);
    return coincidePeriodo && coincideFiltro && coincideBusqueda;
  });

  const clienteSel = clientes.find(c => c.id === formData.id_cliente);

  return (
    <div className="pageContainer">
      <header className="pageHead">
        <div className="titleGroup">
          <div className="titleIcon"><FileText size={24} /></div>
          <div>
            <h1>Facturas</h1>
            <p className="pageSubtitle">Ciclo de ventas: facturación y estado de cobro</p>
          </div>
        </div>
        <div className="headActions">
          <BotonExcel
            disabled={loading}
            opciones={() => ({
              archivo: 'facturas',
              hoja: 'Facturas',
              titulo: 'Facturas',
              subtitulo: `Estado: ${filtro} · ${describirPeriodo(periodo)}`,
              filas: filtered,
              columnas: [
                { titulo: 'Folio',         valor: f => f.folio },
                { titulo: 'Folio Interno', valor: f => f.folio_interno },
                { titulo: 'Fecha',         tipo: 'fecha',  valor: f => f.fecha },
                { titulo: 'Cliente',       valor: f => f.cliente },
                { titulo: 'Vendedor',      valor: f => f.vendedor },
                { titulo: 'Forma de Pago', valor: f => f.forma_pago },
                { titulo: 'Vencimiento',   tipo: 'fecha',  valor: f => f.fecha_vencimiento },
                { titulo: 'Total',         tipo: 'moneda', valor: f => f.total,   total: true },
                { titulo: 'Cobrado',       tipo: 'moneda', valor: f => f.cobrado, total: true },
                { titulo: 'Saldo',         tipo: 'moneda', valor: f => f.saldo,   total: true },
                { titulo: 'Estado Cobro',  valor: f => f.estado_cobro },
                { titulo: 'Estado',        valor: f => f.estado },
              ],
            })}
          />
          <button className="btnPrimary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Nueva Factura
          </button>
        </div>
      </header>

      <div className="tabs">
        {FILTROS.map(f => (
          <button key={f} className={`tab ${filtro === f ? 'tabActive' : ''}`} onClick={() => setFiltro(f)}>
            {f}
          </button>
        ))}
      </div>

      <PeriodoFilter value={periodo} onChange={setPeriodo} label="Fecha de factura" />

      <div className="glass searchBar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Buscar por folio, folio interno o cliente..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="glass animate-fade tableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Folio Interno</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Vence</th>
              <th className="tdNum">Total</th>
              <th className="tdNum">Cobrado</th>
              <th className="tdNum">Saldo</th>
              <th>Estado Cobro</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="emptyCell">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} className="emptyCell">No hay facturas con los filtros seleccionados</td></tr>
            ) : filtered.map(f => (
              <tr key={f.id} style={f.estado === 'Cancelada' ? { opacity: 0.55 } : undefined}>
                <td className="tdBold">
                  <Link href={`/facturas/${f.id}`} style={{ color: 'var(--info)' }}>{f.folio}</Link>
                  {f.estado === 'Cancelada' && <span className="badge bGris" style={{ marginLeft: 6 }}>Cancelada</span>}
                </td>
                <td className="tdBold">{f.folio_interno}</td>
                <td className="tdMuted">{fecha(f.fecha)}</td>
                <td>{f.cliente}</td>
                <td className="tdMuted">{f.vendedor || '—'}</td>
                <td className="tdMuted">{fecha(f.fecha_vencimiento)}</td>
                <td className="tdNum tdBold">{money(f.total)}</td>
                <td className="tdNum" style={{ color: 'var(--success)' }}>{money(f.cobrado)}</td>
                <td className="tdNum tdBold">{money(f.saldo)}</td>
                <td><span className={badgeEstadoCobro(f.estado_cobro)}>{f.estado_cobro}</span></td>
                <td>
                  <Link href={`/facturas/${f.id}`} className="iconBtn" title="Ver factura">
                    <Eye size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="overlay">
          <div className="glass modal animate-scale">
            <div className="modalHead">
              <h3>Nueva Factura</h3>
              <button onClick={cerrarModal}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <LectorPdfFactura
                archivo={pdfAdjunto}
                lectura={lecturaPdf}
                onCambio={aplicarLecturaPdf}
              />

              <div className="field">
                <label className="fieldLabel">Cliente *</label>
                <select value={formData.id_cliente}
                  onChange={e => setFormData({ ...formData, id_cliente: +e.target.value })} required>
                  <option value={0}>— Selecciona cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
                {clienteSel && clienteSel.dias_credito > 0 && (
                  <small style={{ color: 'var(--text-muted)' }}>
                    Crédito: {clienteSel.dias_credito} días (el vencimiento se calcula automático si lo dejas vacío)
                  </small>
                )}
              </div>

              <div className="field">
                <label className="fieldLabel">Folio Interno *</label>
                <input type="text" value={formData.folio_interno}
                  placeholder="Ej. ALM-2026-001"
                  style={{ textTransform: 'uppercase' }}
                  onChange={e => setFormData({ ...formData, folio_interno: e.target.value.toUpperCase() })}
                  required />
              </div>

              <div className="formGrid2">
                <div className="field">
                  <label className="fieldLabel">Vendedor</label>
                  <select value={formData.id_vendedor}
                    onChange={e => setFormData({ ...formData, id_vendedor: +e.target.value })}>
                    <option value={0}>— Selecciona —</option>
                    {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="fieldLabel">Forma de Pago</label>
                  <select value={formData.id_forma_pago}
                    onChange={e => setFormData({ ...formData, id_forma_pago: +e.target.value })}>
                    <option value={0}>— Selecciona —</option>
                    {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="formGrid2">
                <div className="field">
                  <label className="fieldLabel">Fecha</label>
                  <input type="date" value={formData.fecha}
                    onChange={e => setFormData({ ...formData, fecha: e.target.value })} required />
                </div>
                <div className="field">
                  <label className="fieldLabel">Vencimiento (opcional)</label>
                  <input type="date" value={formData.fecha_vencimiento}
                    onChange={e => setFormData({ ...formData, fecha_vencimiento: e.target.value })} />
                </div>
              </div>

              <div className="field">
                <label className="fieldLabel">Notas</label>
                <input type="text" value={formData.notas}
                  onChange={e => setFormData({ ...formData, notas: e.target.value })} />
              </div>

              <button type="submit" className="btnPrimary" style={{ justifyContent: 'center' }} disabled={saving}>
                <Check size={18} />
                {saving ? 'Creando...' : 'Crear y Capturar Productos'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
