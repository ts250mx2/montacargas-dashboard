'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { DollarSign, Search, Plus, X, Check, Trash2, AlertTriangle } from 'lucide-react';
import { money, fecha, badgeEstadoCobro } from '@/lib/format';
import { describirPeriodo, enRango, filtroPeriodo, rangoDeFiltro, type FiltroPeriodo } from '@/lib/periodos';
import PeriodoFilter from '@/components/PeriodoFilter';
import BotonExcel from '@/components/BotonExcel';
import type { ExcelOpciones } from '@/lib/exportar';

export default function CobranzaPage() {
  const [pagos, setPagos] = useState<any[]>([]);
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodo, setPeriodo] = useState<FiltroPeriodo>(() => filtroPeriodo('todo'));
  const [vista, setVista] = useState<'pendientes' | 'pagos'>('pendientes');
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    id_factura: 0,
    fecha: new Date().toISOString().slice(0, 10),
    id_forma_pago: 0, id_banco: 0, referencia: '', importe: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const res = await fetch('/api/pagos');
    const data = await res.json();
    setPagos(data.pagos || []);
    setPendientes(data.facturasPendientes || []);
    setFormasPago(data.formasPago || []);
    setBancos(data.bancos || []);
    setLoading(false);
  };

  const openModal = (idFactura = 0, saldo = '') => {
    setFormData({
      id_factura: idFactura,
      fecha: new Date().toISOString().slice(0, 10),
      id_forma_pago: 0, id_banco: 0, referencia: '',
      importe: saldo,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_factura) { alert('Selecciona una factura'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) { setIsModalOpen(false); fetchData(); }
      else alert(data.message || 'Error al registrar el pago');
    } catch { alert('Error de conexión'); }
    finally { setSaving(false); }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pagos/${confirmDelete.id}`, { method: 'DELETE' });
      if (res.ok) { setConfirmDelete(null); fetchData(); }
      else { const err = await res.json(); alert(err.message || 'Error al eliminar'); }
    } catch { alert('Error de conexión'); }
    finally { setDeleting(false); }
  };

  const rango = useMemo(() => rangoDeFiltro(periodo), [periodo]);

  // El periodo se aplica a la fecha de la factura en pendientes y a la fecha del pago en el historial
  const pendientesPeriodo = pendientes.filter(f => enRango(f.fecha, rango));
  const pagosPeriodo = pagos.filter(p => enRango(p.fecha, rango));

  const q = searchTerm.toLowerCase();
  const pendientesFiltrados = pendientesPeriodo.filter(f =>
    f.folio.toLowerCase().includes(q) || (f.folio_interno || '').toLowerCase().includes(q) ||
    f.cliente.toLowerCase().includes(q));
  const pagosFiltrados = pagosPeriodo.filter(p =>
    p.folio.toLowerCase().includes(q) || (p.folio_interno || '').toLowerCase().includes(q) ||
    p.cliente.toLowerCase().includes(q) || (p.referencia || '').toLowerCase().includes(q));

  // El Excel refleja la vista activa con sus filtros de periodo y búsqueda
  const opcionesExcel = (): ExcelOpciones<any> => (
    vista === 'pendientes'
      ? {
          archivo: 'cobranza-por-cobrar',
          hoja: 'Por Cobrar',
          titulo: 'Facturas por cobrar',
          subtitulo: describirPeriodo(periodo),
          filas: pendientesFiltrados,
          columnas: [
            { titulo: 'Folio',         valor: f => f.folio },
            { titulo: 'Folio Interno', valor: f => f.folio_interno },
            { titulo: 'Cliente',       valor: f => f.cliente },
            { titulo: 'Fecha',         tipo: 'fecha',  valor: f => f.fecha },
            { titulo: 'Vencimiento',   tipo: 'fecha',  valor: f => f.fecha_vencimiento },
            { titulo: 'Total',         tipo: 'moneda', valor: f => f.total,   total: true },
            { titulo: 'Cobrado',       tipo: 'moneda', valor: f => f.cobrado, total: true },
            { titulo: 'Saldo',         tipo: 'moneda', valor: f => f.saldo,   total: true },
            { titulo: 'Estado',        valor: f => f.estado_cobro },
          ],
        }
      : {
          archivo: 'cobranza-pagos',
          hoja: 'Pagos',
          titulo: 'Historial de pagos',
          subtitulo: describirPeriodo(periodo),
          filas: pagosFiltrados,
          columnas: [
            { titulo: 'Fecha',         tipo: 'fecha',  valor: p => p.fecha },
            { titulo: 'Folio',         valor: p => p.folio },
            { titulo: 'Folio Interno', valor: p => p.folio_interno },
            { titulo: 'Cliente',       valor: p => p.cliente },
            { titulo: 'Forma de Pago', valor: p => p.forma_pago },
            { titulo: 'Banco',         valor: p => p.banco },
            { titulo: 'Referencia',    valor: p => p.referencia },
            { titulo: 'Importe',       tipo: 'moneda', valor: p => p.importe, total: true },
          ],
        }
  );

  const facturaSel = pendientes.find(f => f.id === formData.id_factura);
  const totalCartera = pendientesPeriodo.reduce((s, f) => s + Number(f.saldo), 0);
  const totalCobrado = pagosPeriodo.reduce((s, p) => s + Number(p.importe), 0);

  return (
    <div className="pageContainer">
      <header className="pageHead">
        <div className="titleGroup">
          <div className="titleIcon"><DollarSign size={24} /></div>
          <div>
            <h1>Cobranza</h1>
            <p className="pageSubtitle">
              {vista === 'pendientes' ? (
                <>Cartera pendiente: <strong>{money(totalCartera)}</strong> en {pendientesPeriodo.length} facturas</>
              ) : (
                <>Cobrado: <strong>{money(totalCobrado)}</strong> en {pagosPeriodo.length} pagos</>
              )}
            </p>
          </div>
        </div>
        <div className="headActions">
          <BotonExcel opciones={opcionesExcel} disabled={loading} />
          <button className="btnPrimary" onClick={() => openModal()}>
            <Plus size={18} /> Registrar Pago
          </button>
        </div>
      </header>

      <div className="tabs">
        <button className={`tab ${vista === 'pendientes' ? 'tabActive' : ''}`} onClick={() => setVista('pendientes')}>
          Facturas por Cobrar ({pendientesPeriodo.length})
        </button>
        <button className={`tab ${vista === 'pagos' ? 'tabActive' : ''}`} onClick={() => setVista('pagos')}>
          Historial de Pagos ({pagosPeriodo.length})
        </button>
      </div>

      <PeriodoFilter
        value={periodo}
        onChange={setPeriodo}
        label={vista === 'pendientes' ? 'Fecha de factura' : 'Fecha de pago'}
      />

      <div className="glass searchBar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Buscar por folio, folio interno, cliente o referencia..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {vista === 'pendientes' ? (
        <div className="glass animate-fade tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Folio Interno</th>
                <th>Cliente</th>
                <th>Vence</th>
                <th className="tdNum">Total</th>
                <th className="tdNum">Cobrado</th>
                <th className="tdNum">Saldo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="emptyCell">Cargando...</td></tr>
              ) : pendientesFiltrados.length === 0 ? (
                <tr><td colSpan={9} className="emptyCell">No hay facturas pendientes de cobro en este periodo 🎉</td></tr>
              ) : pendientesFiltrados.map(f => (
                <tr key={f.id}>
                  <td className="tdBold">
                    <Link href={`/facturas/${f.id}`} style={{ color: 'var(--info)' }}>{f.folio}</Link>
                  </td>
                  <td className="tdBold">{f.folio_interno}</td>
                  <td>{f.cliente}</td>
                  <td className="tdMuted">{fecha(f.fecha_vencimiento)}</td>
                  <td className="tdNum">{money(f.total)}</td>
                  <td className="tdNum" style={{ color: 'var(--success)' }}>{money(f.cobrado)}</td>
                  <td className="tdNum tdBold">{money(f.saldo)}</td>
                  <td><span className={badgeEstadoCobro(f.estado_cobro)}>{f.estado_cobro}</span></td>
                  <td>
                    <button className="btnGhost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      onClick={() => openModal(f.id, String(f.saldo))}>
                      <DollarSign size={14} /> Cobrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass animate-fade tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Folio</th>
                <th>Folio Interno</th>
                <th>Cliente</th>
                <th>Forma de Pago</th>
                <th>Banco</th>
                <th>Referencia</th>
                <th className="tdNum">Importe</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="emptyCell">Cargando...</td></tr>
              ) : pagosFiltrados.length === 0 ? (
                <tr><td colSpan={9} className="emptyCell">No hay pagos registrados en este periodo</td></tr>
              ) : pagosFiltrados.map(p => (
                <tr key={p.id}>
                  <td className="tdMuted">{fecha(p.fecha)}</td>
                  <td className="tdBold">
                    <Link href={`/facturas/${p.id_factura}`} style={{ color: 'var(--info)' }}>{p.folio}</Link>
                  </td>
                  <td className="tdBold">{p.folio_interno}</td>
                  <td>{p.cliente}</td>
                  <td>{p.forma_pago || '—'}</td>
                  <td className="tdMuted">{p.banco || '—'}</td>
                  <td className="tdMuted">{p.referencia || '—'}</td>
                  <td className="tdNum tdBold" style={{ color: 'var(--success)' }}>{money(p.importe)}</td>
                  <td>
                    <button className="iconBtn iconBtnDanger" onClick={() => setConfirmDelete(p)} title="Eliminar pago">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal registrar pago */}
      {isModalOpen && (
        <div className="overlay">
          <div className="glass modal animate-scale">
            <div className="modalHead">
              <h3>Registrar Pago</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <div className="field">
                <label className="fieldLabel">Factura *</label>
                <select value={formData.id_factura}
                  onChange={e => {
                    const idF = +e.target.value;
                    const f = pendientes.find(x => x.id === idF);
                    setFormData({ ...formData, id_factura: idF, importe: f ? String(f.saldo) : '' });
                  }} required>
                  <option value={0}>— Selecciona factura —</option>
                  {pendientes.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.folio} · {f.folio_interno} — {f.cliente} (saldo {money(f.saldo)})
                    </option>
                  ))}
                </select>
                {facturaSel && (
                  <small style={{ color: 'var(--text-muted)' }}>
                    Total {money(facturaSel.total)} · Cobrado {money(facturaSel.cobrado)} · Saldo <strong>{money(facturaSel.saldo)}</strong>
                  </small>
                )}
              </div>

              <div className="formGrid2">
                <div className="field">
                  <label className="fieldLabel">Fecha del Pago *</label>
                  <input type="date" value={formData.fecha}
                    onChange={e => setFormData({ ...formData, fecha: e.target.value })} required />
                </div>
                <div className="field">
                  <label className="fieldLabel">Importe ($) *</label>
                  <input type="number" step="0.01" min="0.01" value={formData.importe}
                    onChange={e => setFormData({ ...formData, importe: e.target.value })} required />
                </div>
              </div>

              <div className="formGrid2">
                <div className="field">
                  <label className="fieldLabel">Forma de Pago</label>
                  <select value={formData.id_forma_pago}
                    onChange={e => setFormData({ ...formData, id_forma_pago: +e.target.value })}>
                    <option value={0}>— Selecciona —</option>
                    {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="fieldLabel">Banco</label>
                  <select value={formData.id_banco}
                    onChange={e => setFormData({ ...formData, id_banco: +e.target.value })}>
                    <option value={0}>— Selecciona —</option>
                    {bancos.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="fieldLabel">Referencia Bancaria</label>
                <input type="text" value={formData.referencia}
                  onChange={e => setFormData({ ...formData, referencia: e.target.value })} />
              </div>

              <button type="submit" className="btnPrimary" style={{ justifyContent: 'center' }} disabled={saving}>
                <Check size={18} />
                {saving ? 'Registrando...' : 'Registrar Pago'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar eliminación de pago */}
      {confirmDelete && (
        <div className="overlay">
          <div className="glass confirmModal animate-scale">
            <div className="confirmIcon"><AlertTriangle size={40} /></div>
            <h3>¿Eliminar Pago?</h3>
            <p className="confirmMsg">
              Se eliminará el pago de <strong>{money(confirmDelete.importe)}</strong> de la factura{' '}
              <strong>{confirmDelete.folio}</strong>. El saldo de la factura se recalculará automáticamente.
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
