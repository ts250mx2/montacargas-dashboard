'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Receipt, Search, Plus, X, Check, Trash2, AlertTriangle, Edit2, Paperclip,
  FileText, FileCode2, Loader2, Ban, ChevronDown, ChevronRight,
} from 'lucide-react';
import { money, fecha } from '@/lib/format';
import { describirPeriodo, enRango, filtroPeriodo, rangoDeFiltro, type FiltroPeriodo } from '@/lib/periodos';
import PeriodoFilter from '@/components/PeriodoFilter';
import BotonExcel from '@/components/BotonExcel';
import CountUp from '@/components/CountUp';
import LectorComprobanteGasto, { type LecturaComprobante } from '@/components/LectorComprobanteGasto';
import PartidasGasto, { type PartidaEditable } from '@/components/PartidasGasto';

interface Gasto {
  id: number;
  fecha: string;
  folio: string;
  concepto: string;
  proveedor: string | null;
  categoria: string | null;
  forma_pago: string | null;
  subtotal: number;
  iva: number;
  total: number;
  uuid_cfdi: string;
  rfc_emisor: string;
  deducible: number;
  estado: string;
  notas: string;
  id_proveedor: number | null;
  id_categoria: number | null;
  id_forma_pago: number | null;
  id_adjunto: number | null;
  adjunto_nombre: string | null;
  adjunto_extension: string | null;
  partidas: PartidaGuardada[];
}

interface PartidaGuardada {
  id: number;
  clave: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  importe: number;
}

const BLANCO = {
  fecha: new Date().toISOString().slice(0, 10),
  folio: '', concepto: '',
  id_proveedor: 0, id_categoria: 0, id_forma_pago: 0,
  subtotal: '', iva: '', total: '',
  uuid_cfdi: '', rfc_emisor: '', deducible: 1, notas: '',
};

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [periodo, setPeriodo] = useState<FiltroPeriodo>(() => filtroPeriodo('mes'));
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [formData, setFormData] = useState({ ...BLANCO });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Gasto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [partidas, setPartidas] = useState<PartidaEditable[]>([]);
  const [expandido, setExpandido] = useState<number | null>(null);

  const [comprobante, setComprobante] = useState<File | null>(null);
  const [lectura, setLectura] = useState<LecturaComprobante | null>(null);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const gastoParaAdjuntar = useRef<number | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const res = await fetch('/api/gastos');
    const data = await res.json();
    setGastos(data.gastos || []);
    setProveedores(data.proveedores || []);
    setCategorias(data.categorias || []);
    setFormasPago(data.formasPago || []);
    setLoading(false);
  };

  /* ─── Lectura del comprobante ─── */

  const aplicarLectura = (archivo: File | null, leido: LecturaComprobante | null) => {
    setComprobante(archivo);
    setLectura(leido);
    if (!leido) return;

    const { cfdi, proveedor } = leido;
    const folioCfdi = [cfdi.serie, cfdi.folio].filter(Boolean).join('-');
    const concepto = cfdi.conceptos?.[0]?.descripcion ?? '';

    // Los conceptos del CFDI entran como partidas: es el desglose que ya trae el comprobante
    if (cfdi.conceptos?.length) {
      setPartidas(cfdi.conceptos.map(c => ({
        clave: c.clave ?? '',
        descripcion: c.descripcion,
        cantidad: String(c.cantidad ?? 1),
        precio: String(c.precio ?? 0),
      })));
    }

    setFormData(previo => ({
      ...previo,
      fecha: cfdi.fecha || previo.fecha,
      folio: folioCfdi || previo.folio,
      concepto: previo.concepto || concepto || cfdi.nombreEmisor || '',
      id_proveedor: proveedor?.id ?? previo.id_proveedor,
      subtotal: cfdi.subtotal !== null ? String(cfdi.subtotal) : previo.subtotal,
      iva: cfdi.iva !== null ? String(cfdi.iva) : previo.iva,
      total: cfdi.total !== null ? String(cfdi.total) : previo.total,
      uuid_cfdi: cfdi.uuid || previo.uuid_cfdi,
      rfc_emisor: cfdi.rfcEmisor || previo.rfc_emisor,
    }));
  };

  /* ─── Alta y edición ─── */

  const abrirModal = (gasto: Gasto | null = null) => {
    setComprobante(null);
    setLectura(null);
    setPartidas((gasto?.partidas ?? []).map(p => ({
      clave: p.clave,
      descripcion: p.descripcion,
      cantidad: String(Number(p.cantidad)),
      precio: String(Number(p.precio)),
    })));
    if (gasto) {
      setEditando(gasto);
      setFormData({
        fecha: String(gasto.fecha).slice(0, 10),
        folio: gasto.folio, concepto: gasto.concepto,
        id_proveedor: gasto.id_proveedor ?? 0,
        id_categoria: gasto.id_categoria ?? 0,
        id_forma_pago: gasto.id_forma_pago ?? 0,
        subtotal: String(gasto.subtotal), iva: String(gasto.iva), total: String(gasto.total),
        uuid_cfdi: gasto.uuid_cfdi, rfc_emisor: gasto.rfc_emisor,
        deducible: gasto.deducible, notas: gasto.notas,
      });
    } else {
      setEditando(null);
      setFormData({ ...BLANCO });
    }
    setIsModalOpen(true);
  };

  const cerrarModal = () => {
    setIsModalOpen(false);
    setComprobante(null);
    setLectura(null);
    setPartidas([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.concepto.trim()) { alert('El concepto es obligatorio'); return; }
    setSaving(true);
    try {
      const res = await fetch(editando ? `/api/gastos/${editando.id}` : '/api/gastos', {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, partidas }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Error al guardar el gasto'); return; }

      // El gasto ya existe: ahora se le cuelga el comprobante
      const idGasto = editando?.id ?? data.id;
      if (comprobante) {
        const cuerpo = new FormData();
        cuerpo.append('archivo', comprobante);
        const resAdjunto = await fetch(`/api/gastos/${idGasto}/adjunto`, { method: 'POST', body: cuerpo });
        if (!resAdjunto.ok) {
          const err = await resAdjunto.json().catch(() => ({}));
          alert(`El gasto se guardó, pero no se pudo adjuntar el comprobante: ${err.message || ''}`);
        }
      }

      cerrarModal();
      fetchData();
    } catch { alert('Error de conexión'); }
    finally { setSaving(false); }
  };

  const cambiarEstado = async (gasto: Gasto) => {
    const nuevo = gasto.estado === 'Cancelado' ? 'Vigente' : 'Cancelado';
    const res = await fetch(`/api/gastos/${gasto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'estado', estado: nuevo }),
    });
    if (res.ok) fetchData();
    else alert('No se pudo cambiar el estado');
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/gastos/${confirmDelete.id}`, { method: 'DELETE' });
      if (res.ok) { setConfirmDelete(null); fetchData(); }
      else { const err = await res.json(); alert(err.message || 'Error al eliminar'); }
    } catch { alert('Error de conexión'); }
    finally { setDeleting(false); }
  };

  /* ─── Adjuntar desde la tabla ─── */

  const pedirArchivo = (idGasto: number) => {
    gastoParaAdjuntar.current = idGasto;
    entradaArchivo.current?.click();
  };

  const subirArchivo = async (archivo: File | undefined) => {
    const idGasto = gastoParaAdjuntar.current;
    if (!archivo || !idGasto) return;
    setSubiendo(idGasto);
    try {
      const cuerpo = new FormData();
      cuerpo.append('archivo', archivo);
      const res = await fetch(`/api/gastos/${idGasto}/adjunto`, { method: 'POST', body: cuerpo });
      if (res.ok) fetchData();
      else { const err = await res.json(); alert(err.message || 'No se pudo adjuntar'); }
    } catch { alert('Error de conexión'); }
    finally {
      setSubiendo(null);
      gastoParaAdjuntar.current = null;
      if (entradaArchivo.current) entradaArchivo.current.value = '';
    }
  };

  /* ─── Filtros y totales ─── */

  const rango = useMemo(() => rangoDeFiltro(periodo), [periodo]);
  const q = searchTerm.toLowerCase();

  const gastosPeriodo = gastos.filter(g => enRango(g.fecha, rango));
  const filtrados = gastosPeriodo.filter(g => {
    const coincideCategoria = categoriaFiltro === 'Todas' || g.categoria === categoriaFiltro;
    const coincideBusqueda =
      g.concepto.toLowerCase().includes(q) ||
      (g.folio || '').toLowerCase().includes(q) ||
      (g.proveedor || '').toLowerCase().includes(q) ||
      (g.categoria || '').toLowerCase().includes(q);
    return coincideCategoria && coincideBusqueda;
  });

  const vigentes = filtrados.filter(g => g.estado !== 'Cancelado');
  const totalGastado = vigentes.reduce((s, g) => s + Number(g.total), 0);
  const ivaAcreditable = vigentes.filter(g => g.deducible).reduce((s, g) => s + Number(g.iva), 0);
  const sinComprobante = vigentes.filter(g => !g.id_adjunto).length;

  const categoriasPresentes = ['Todas', ...Array.from(
    new Set(gastosPeriodo.map(g => g.categoria).filter(Boolean) as string[])).sort()];

  return (
    <div className="pageContainer">
      <header className="pageHead">
        <div className="titleGroup">
          <div className="titleIcon"><Receipt size={24} /></div>
          <div>
            <h1>Gastos</h1>
            <p className="pageSubtitle">Comprobantes de egresos, proveedores y deducibles</p>
          </div>
        </div>
        <div className="headActions">
          <BotonExcel
            disabled={loading}
            opciones={() => ({
              archivo: 'gastos',
              hoja: 'Gastos',
              titulo: 'Gastos',
              subtitulo: `Categoría: ${categoriaFiltro} · ${describirPeriodo(periodo)}`,
              filas: filtrados,
              columnas: [
                { titulo: 'Fecha',        tipo: 'fecha',  valor: g => g.fecha },
                { titulo: 'Folio',        valor: g => g.folio },
                { titulo: 'Concepto',     valor: g => g.concepto },
                { titulo: 'Proveedor',    valor: g => g.proveedor },
                { titulo: 'Categoría',    valor: g => g.categoria },
                { titulo: 'Forma de Pago', valor: g => g.forma_pago },
                { titulo: 'Subtotal',     tipo: 'moneda', valor: g => g.subtotal, total: true },
                { titulo: 'IVA',          tipo: 'moneda', valor: g => g.iva,      total: true },
                { titulo: 'Total',        tipo: 'moneda', valor: g => g.total,    total: true },
                { titulo: 'Deducible',    valor: g => (g.deducible ? 'Sí' : 'No') },
                { titulo: 'Comprobante',  valor: g => (g.id_adjunto ? g.adjunto_nombre : 'Sin comprobante') },
                { titulo: 'UUID',         valor: g => g.uuid_cfdi },
                { titulo: 'Estado',       valor: g => g.estado },
              ],
            })}
          />
          <button className="btnPrimary" onClick={() => abrirModal()}>
            <Plus size={18} /> Nuevo Gasto
          </button>
        </div>
      </header>

      <div className="kpiGrid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="glass kpiCard">
          <div className="kpiIcon" style={{ background: 'rgba(229,72,77,0.12)', color: 'var(--danger)' }}>
            <Receipt size={22} />
          </div>
          <div>
            <div className="kpiLabel">Total gastado</div>
            <div className="kpiValue"><CountUp value={totalGastado} format={money} /></div>
            <div className="kpiSub">{vigentes.length} gastos vigentes</div>
          </div>
        </div>
        <div className="glass kpiCard">
          <div className="kpiIcon" style={{ background: 'rgba(0,145,255,0.12)', color: 'var(--info)' }}>
            <Check size={22} />
          </div>
          <div>
            <div className="kpiLabel">IVA acreditable</div>
            <div className="kpiValue"><CountUp value={ivaAcreditable} format={money} /></div>
            <div className="kpiSub">solo gastos deducibles</div>
          </div>
        </div>
        <div className="glass kpiCard">
          <div className="kpiIcon" style={{ background: 'rgba(247,107,21,0.12)', color: 'var(--warning)' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="kpiLabel">Sin comprobante</div>
            <div className="kpiValue">{sinComprobante}</div>
            <div className="kpiSub">gastos por documentar</div>
          </div>
        </div>
      </div>

      {categoriasPresentes.length > 2 && (
        <div className="tabs">
          {categoriasPresentes.map(c => (
            <button key={c} className={`tab ${categoriaFiltro === c ? 'tabActive' : ''}`}
              onClick={() => setCategoriaFiltro(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      <PeriodoFilter value={periodo} onChange={setPeriodo} label="Fecha del gasto" />

      <div className="glass searchBar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Buscar por concepto, folio, proveedor o categoría..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="glass animate-fade tableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Folio</th>
              <th>Concepto</th>
              <th>Proveedor</th>
              <th>Categoría</th>
              <th className="tdNum">Subtotal</th>
              <th className="tdNum">IVA</th>
              <th className="tdNum">Total</th>
              <th>Comprobante</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="emptyCell">Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={10} className="emptyCell">No hay gastos con los filtros seleccionados</td></tr>
            ) : filtrados.flatMap(g => [
              <tr key={g.id} style={g.estado === 'Cancelado' ? { opacity: 0.55 } : undefined}>
                <td className="tdMuted">{fecha(g.fecha)}</td>
                <td className="tdBold">{g.folio || '—'}</td>
                <td>
                  {g.partidas.length > 0 && (
                    <button className="partidasToggle"
                      onClick={() => setExpandido(expandido === g.id ? null : g.id)}
                      title={expandido === g.id ? 'Ocultar partidas' : `Ver ${g.partidas.length} partidas`}>
                      {expandido === g.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {g.partidas.length}
                    </button>
                  )}
                  {g.concepto}
                  {g.estado === 'Cancelado' && <span className="badge bGris" style={{ marginLeft: 6 }}>Cancelado</span>}
                  {!g.deducible && <span className="badge bAmbar" style={{ marginLeft: 6 }}>No deducible</span>}
                </td>
                <td>{g.proveedor || '—'}</td>
                <td><span className="badge bGris">{g.categoria || 'Sin categoría'}</span></td>
                <td className="tdNum">{money(g.subtotal)}</td>
                <td className="tdNum tdMuted">{money(g.iva)}</td>
                <td className="tdNum tdBold">{money(g.total)}</td>
                <td>
                  {subiendo === g.id ? (
                    <Loader2 size={15} className="girando" />
                  ) : g.id_adjunto ? (
                    <a href={`/api/gastos/${g.id}/adjunto`} target="_blank" rel="noopener noreferrer"
                      className="adjuntoChip" title={g.adjunto_nombre ?? ''}>
                      {g.adjunto_extension === 'xml' ? <FileCode2 size={13} /> : <FileText size={13} />}
                      {g.adjunto_extension?.toUpperCase()}
                    </a>
                  ) : (
                    <button className="adjuntoChip adjuntoChipVacio" onClick={() => pedirArchivo(g.id)}>
                      <Paperclip size={13} /> Adjuntar
                    </button>
                  )}
                </td>
                <td>
                  <div className="rowActions">
                    <button className="iconBtn" onClick={() => abrirModal(g)} title="Editar"><Edit2 size={15} /></button>
                    <button className="iconBtn" onClick={() => cambiarEstado(g)}
                      title={g.estado === 'Cancelado' ? 'Reactivar' : 'Cancelar'}>
                      <Ban size={15} />
                    </button>
                    <button className="iconBtn iconBtnDanger" onClick={() => setConfirmDelete(g)} title="Eliminar">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>,

              expandido === g.id ? (
                <tr key={`${g.id}-partidas`} className="filaPartidas">
                  <td colSpan={10}>
                    <table className="dataTable partidasDesglose">
                      <thead>
                        <tr>
                          <th>Clave</th>
                          <th>Descripción</th>
                          <th className="tdNum">Cantidad</th>
                          <th className="tdNum">P. Unitario</th>
                          <th className="tdNum">Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.partidas.map(p => (
                          <tr key={p.id}>
                            <td className="tdMuted">{p.clave || '—'}</td>
                            <td>{p.descripcion}</td>
                            <td className="tdNum">{Number(p.cantidad)}</td>
                            <td className="tdNum">{money(p.precio)}</td>
                            <td className="tdNum tdBold">{money(p.importe)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              ) : null,
            ])}
          </tbody>
        </table>
      </div>

      {/* Entrada usada al adjuntar desde la tabla */}
      <input ref={entradaArchivo} type="file" hidden
        accept="application/pdf,.pdf,application/xml,text/xml,.xml"
        onChange={e => subirArchivo(e.target.files?.[0])} />

      {isModalOpen && (
        <div className="overlay">
          <div className="glass modal modalWide animate-scale">
            <div className="modalHead">
              <h3>{editando ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>
              <button onClick={cerrarModal}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <LectorComprobanteGasto
                archivo={comprobante}
                lectura={lectura}
                onCambio={aplicarLectura}
              />

              <div className="field">
                <label className="fieldLabel">Concepto *</label>
                <input type="text" value={formData.concepto} required autoFocus
                  placeholder="Ej. Compra de refacciones hidráulicas"
                  onChange={e => setFormData({ ...formData, concepto: e.target.value })} />
              </div>

              <div className="formGrid3">
                <div className="field">
                  <label className="fieldLabel">Fecha *</label>
                  <input type="date" value={formData.fecha} required
                    onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
                </div>
                <div className="field">
                  <label className="fieldLabel">Folio del comprobante</label>
                  <input type="text" value={formData.folio}
                    onChange={e => setFormData({ ...formData, folio: e.target.value })} />
                </div>
                <div className="field">
                  <label className="fieldLabel">Categoría</label>
                  <select value={formData.id_categoria}
                    onChange={e => setFormData({ ...formData, id_categoria: +e.target.value })}>
                    <option value={0}>— Sin categoría —</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="formGrid2">
                <div className="field">
                  <label className="fieldLabel">Proveedor</label>
                  <select value={formData.id_proveedor}
                    onChange={e => setFormData({ ...formData, id_proveedor: +e.target.value })}>
                    <option value={0}>— Sin proveedor —</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
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

              <div className="formGrid3">
                <div className="field">
                  <label className="fieldLabel">Subtotal ($)</label>
                  <input type="number" step="0.01" min="0" value={formData.subtotal}
                    onChange={e => setFormData({ ...formData, subtotal: e.target.value })} />
                </div>
                <div className="field">
                  <label className="fieldLabel">IVA ($)</label>
                  <input type="number" step="0.01" value={formData.iva}
                    onChange={e => setFormData({ ...formData, iva: e.target.value })} />
                </div>
                <div className="field">
                  <label className="fieldLabel">Total ($) *</label>
                  <input type="number" step="0.01" min="0.01" value={formData.total} required
                    onChange={e => setFormData({ ...formData, total: e.target.value })} />
                </div>
              </div>

              <div className="formGrid2">
                <div className="field">
                  <label className="fieldLabel">RFC del emisor</label>
                  <input type="text" value={formData.rfc_emisor} maxLength={13}
                    style={{ textTransform: 'uppercase' }}
                    onChange={e => setFormData({ ...formData, rfc_emisor: e.target.value.toUpperCase() })} />
                </div>
                <div className="field">
                  <label className="fieldLabel">UUID del CFDI</label>
                  <input type="text" value={formData.uuid_cfdi} maxLength={36}
                    style={{ fontSize: '0.8rem' }}
                    onChange={e => setFormData({ ...formData, uuid_cfdi: e.target.value.toUpperCase() })} />
                </div>
              </div>

              <PartidasGasto
                partidas={partidas}
                onCambio={setPartidas}
                subtotal={Number(formData.subtotal) || 0}
              />

              <div className="field">
                <label className="fieldLabel">Notas</label>
                <input type="text" value={formData.notas}
                  onChange={e => setFormData({ ...formData, notas: e.target.value })} />
              </div>

              <label className="toggle">
                <div className={`toggleTrack ${formData.deducible === 1 ? 'on' : ''}`}
                  onClick={() => setFormData({ ...formData, deducible: formData.deducible === 1 ? 0 : 1 })}>
                  <div className="toggleThumb" />
                </div>
                <span>Deducible (su IVA cuenta como acreditable)</span>
              </label>

              <button type="submit" className="btnPrimary" style={{ justifyContent: 'center' }} disabled={saving}>
                <Check size={18} />
                {saving ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Registrar Gasto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="overlay">
          <div className="glass confirmModal animate-scale">
            <div className="confirmIcon"><AlertTriangle size={40} /></div>
            <h3>¿Eliminar Gasto?</h3>
            <p className="confirmMsg">
              Se eliminará <strong>{confirmDelete.concepto}</strong> por {money(confirmDelete.total)}
              {confirmDelete.id_adjunto && ', junto con su comprobante'}.
              Esta acción no se puede deshacer.
            </p>
            <div className="confirmBtns">
              <button className="btnGhost" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancelar
              </button>
              <button className="btnDanger" onClick={handleConfirmDelete} disabled={deleting}>
                <Trash2 size={16} />
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
