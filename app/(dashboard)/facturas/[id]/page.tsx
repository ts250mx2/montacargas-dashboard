'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText, ArrowLeft, Plus, Trash2, X, Check, Ban, DollarSign, AlertTriangle,
} from 'lucide-react';
import { money, fecha, badgeEstadoCobro } from '@/lib/format';

export default function FacturaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [factura, setFactura] = useState<any>(null);
  const [detalle, setDetalle] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Agregar partida
  const [lineaOpen, setLineaOpen] = useState(false);
  const [busquedaProd, setBusquedaProd] = useState('');
  const [linea, setLinea] = useState({ id_producto: 0, cantidad: 1, precio: '', descuento: 0 });
  const [savingLinea, setSavingLinea] = useState(false);

  // Cancelar factura
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/facturas/${id}`);
    if (res.status === 404) { setNotFound(true); setLoading(false); return; }
    const data = await res.json();
    setFactura(data.factura);
    setDetalle(data.detalle || []);
    setPagos(data.pagos || []);
    setProductos(data.productos || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prodSel = productos.find(p => p.id === linea.id_producto);
  const productosFiltrados = busquedaProd
    ? productos.filter(p =>
        p.descripcion.toLowerCase().includes(busquedaProd.toLowerCase()) ||
        p.sku.toLowerCase().includes(busquedaProd.toLowerCase()))
    : productos;

  const agregarLinea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linea.id_producto) { alert('Selecciona un producto'); return; }
    setSavingLinea(true);
    try {
      const res = await fetch(`/api/facturas/${id}/detalle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linea),
      });
      if (res.ok) {
        setLinea({ id_producto: 0, cantidad: 1, precio: '', descuento: 0 });
        setBusquedaProd('');
        setLineaOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Error al agregar');
      }
    } catch { alert('Error de conexión'); }
    finally { setSavingLinea(false); }
  };

  const quitarLinea = async (lineaId: number) => {
    const res = await fetch(`/api/facturas/${id}/detalle/${lineaId}`, { method: 'DELETE' });
    if (res.ok) fetchData();
    else { const err = await res.json(); alert(err.message || 'Error al quitar la partida'); }
  };

  const cancelarFactura = async () => {
    setCanceling(true);
    try {
      const res = await fetch(`/api/facturas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'estado', estado: 'Cancelada' }),
      });
      if (res.ok) { setConfirmCancel(false); fetchData(); }
      else alert('Error al cancelar');
    } finally { setCanceling(false); }
  };

  if (loading) {
    return <div className="glass card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Cargando factura...</div>;
  }
  if (notFound || !factura) {
    return (
      <div className="glass card" style={{ textAlign: 'center' }}>
        <p style={{ marginBottom: '1rem' }}>Factura no encontrada.</p>
        <button className="btnGhost" onClick={() => router.push('/facturas')}>
          <ArrowLeft size={16} /> Volver a Facturas
        </button>
      </div>
    );
  }

  const cancelada = factura.estado === 'Cancelada';
  const margenTotal = detalle.reduce((s, d) => s + (Number(d.importe) - Number(d.costo) * Number(d.cantidad)), 0);

  return (
    <div className="pageContainer">
      <header className="pageHead">
        <div className="titleGroup">
          <Link href="/facturas" className="iconBtn" title="Volver" style={{ width: 40, height: 40 }}>
            <ArrowLeft size={20} />
          </Link>
          <div className="titleIcon"><FileText size={24} /></div>
          <div>
            <h1>Factura {factura.folio}</h1>
            <p className="pageSubtitle">
              {factura.cliente} · {fecha(factura.fecha)} · Vence {fecha(factura.fecha_vencimiento)}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={badgeEstadoCobro(factura.estado_cobro)} style={{ fontSize: '0.85rem' }}>
            {factura.estado_cobro}
          </span>
          {!cancelada && (
            <>
              <Link href="/cobranza" className="btnGhost"><DollarSign size={16} /> Registrar Pago</Link>
              <button className="btnDanger" onClick={() => setConfirmCancel(true)}>
                <Ban size={16} /> Cancelar Factura
              </button>
            </>
          )}
        </div>
      </header>

      {cancelada && (
        <div className="glass card" style={{ borderLeft: '4px solid var(--danger)', marginBottom: '1rem', color: 'var(--danger)', fontWeight: 600 }}>
          Esta factura está CANCELADA. No admite cambios ni pagos.
        </div>
      )}

      {/* Totales */}
      <div className="kpiGrid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="glass kpiCard"><div>
          <div className="kpiLabel">Subtotal</div>
          <div className="kpiValue">{money(factura.subtotal)}</div>
        </div></div>
        <div className="glass kpiCard"><div>
          <div className="kpiLabel">IVA ({Number(factura.iva_porcentaje)}%)</div>
          <div className="kpiValue">{money(factura.iva)}</div>
        </div></div>
        <div className="glass kpiCard" style={{ border: '2px solid var(--yellow)' }}><div>
          <div className="kpiLabel">Total Factura</div>
          <div className="kpiValue">{money(factura.total)}</div>
        </div></div>
        <div className="glass kpiCard"><div>
          <div className="kpiLabel">Total Cobrado</div>
          <div className="kpiValue" style={{ color: 'var(--success)' }}>{money(factura.cobrado)}</div>
        </div></div>
        <div className="glass kpiCard"><div>
          <div className="kpiLabel">Saldo Pendiente</div>
          <div className="kpiValue" style={{ color: Number(factura.saldo) > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {money(factura.saldo)}
          </div>
        </div></div>
      </div>

      {/* Partidas */}
      <div className="glass card animate-fade" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.1rem' }}>Productos vendidos</h3>
          {!cancelada && (
            <button className="btnPrimary" onClick={() => setLineaOpen(true)}>
              <Plus size={16} /> Agregar Producto
            </button>
          )}
        </div>
        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Descripción</th>
                <th>Marca</th>
                <th>Unidad</th>
                <th className="tdNum">Cantidad</th>
                <th className="tdNum">Precio</th>
                <th className="tdNum">Desc %</th>
                <th className="tdNum">Importe</th>
                <th className="tdNum">Margen</th>
                {!cancelada && <th></th>}
              </tr>
            </thead>
            <tbody>
              {detalle.length === 0 ? (
                <tr><td colSpan={10} className="emptyCell">
                  Sin productos. {!cancelada && 'Agrega la primera partida con el botón "Agregar Producto".'}
                </td></tr>
              ) : detalle.map(d => {
                const margenLinea = Number(d.importe) - Number(d.costo) * Number(d.cantidad);
                return (
                  <tr key={d.id}>
                    <td className="tdBold">{d.sku}</td>
                    <td>{d.descripcion}</td>
                    <td className="tdMuted">{d.marca || '—'}</td>
                    <td className="tdMuted">{d.unidad || '—'}</td>
                    <td className="tdNum">{Number(d.cantidad)}</td>
                    <td className="tdNum">{money(d.precio)}</td>
                    <td className="tdNum">{Number(d.descuento) > 0 ? `${Number(d.descuento)}%` : '—'}</td>
                    <td className="tdNum tdBold">{money(d.importe)}</td>
                    <td className="tdNum" style={{ color: margenLinea >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {money(margenLinea)}
                    </td>
                    {!cancelada && (
                      <td>
                        <button className="iconBtn iconBtnDanger" onClick={() => quitarLinea(d.id)} title="Quitar">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {detalle.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={7} className="tdNum tdBold" style={{ borderTop: '2px solid var(--border)' }}>Margen total:</td>
                  <td colSpan={cancelada ? 2 : 3} className="tdNum tdBold"
                    style={{ borderTop: '2px solid var(--border)', color: margenTotal >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {money(margenTotal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Pagos */}
      <div className="glass card animate-fade">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.1rem' }}>Pagos recibidos</h3>
          {!cancelada && Number(factura.saldo) > 0 && (
            <Link href="/cobranza" className="btnGhost"><DollarSign size={16} /> Ir a Cobranza</Link>
          )}
        </div>
        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr><th>Fecha</th><th>Forma de Pago</th><th>Banco</th><th>Referencia</th><th className="tdNum">Importe</th></tr>
            </thead>
            <tbody>
              {pagos.length === 0 ? (
                <tr><td colSpan={5} className="emptyCell">Sin pagos registrados</td></tr>
              ) : pagos.map(p => (
                <tr key={p.id}>
                  <td className="tdMuted">{fecha(p.fecha)}</td>
                  <td>{p.forma_pago || '—'}</td>
                  <td className="tdMuted">{p.banco || '—'}</td>
                  <td className="tdMuted">{p.referencia || '—'}</td>
                  <td className="tdNum tdBold" style={{ color: 'var(--success)' }}>{money(p.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal agregar partida */}
      {lineaOpen && (
        <div className="overlay">
          <div className="glass modal modalWide animate-scale">
            <div className="modalHead">
              <h3>Agregar Producto</h3>
              <button onClick={() => setLineaOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={agregarLinea} className="form">
              <div className="field">
                <label className="fieldLabel">Buscar producto</label>
                <input type="text" placeholder="Filtrar por SKU o descripción..."
                  value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)} autoFocus />
              </div>

              <div className="field">
                <label className="fieldLabel">Producto *</label>
                <select value={linea.id_producto} size={6}
                  onChange={e => {
                    const idProd = +e.target.value;
                    const prod = productos.find(p => p.id === idProd);
                    setLinea({ ...linea, id_producto: idProd, precio: prod ? String(prod.precio) : '' });
                  }} required>
                  {productosFiltrados.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.descripcion} ({money(p.precio)})
                    </option>
                  ))}
                </select>
                {prodSel && (
                  <small style={{ color: 'var(--text-muted)' }}>
                    {prodSel.marca ? `Marca: ${prodSel.marca} · ` : ''}Precio de lista: {money(prodSel.precio)}
                  </small>
                )}
              </div>

              <div className="formGrid3">
                <div className="field">
                  <label className="fieldLabel">Cantidad *</label>
                  <input type="number" step="0.01" min="0.01" value={linea.cantidad}
                    onChange={e => setLinea({ ...linea, cantidad: parseFloat(e.target.value) || 0 })} required />
                </div>
                <div className="field">
                  <label className="fieldLabel">Precio ($)</label>
                  <input type="number" step="0.01" min="0" value={linea.precio}
                    placeholder="Precio de lista"
                    onChange={e => setLinea({ ...linea, precio: e.target.value })} />
                </div>
                <div className="field">
                  <label className="fieldLabel">Descuento (%)</label>
                  <input type="number" step="0.01" min="0" max="100" value={linea.descuento}
                    onChange={e => setLinea({ ...linea, descuento: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              {linea.id_producto > 0 && linea.cantidad > 0 && (
                <div className="glass card" style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                  Importe: {money(linea.cantidad * (parseFloat(linea.precio) || prodSel?.precio || 0) * (1 - linea.descuento / 100))}
                </div>
              )}

              <button type="submit" className="btnPrimary" style={{ justifyContent: 'center' }} disabled={savingLinea}>
                <Check size={18} />
                {savingLinea ? 'Agregando...' : 'Agregar a la Factura'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar cancelación */}
      {confirmCancel && (
        <div className="overlay">
          <div className="glass confirmModal animate-scale">
            <div className="confirmIcon"><AlertTriangle size={40} /></div>
            <h3>¿Cancelar Factura?</h3>
            <p className="confirmMsg">
              La factura <strong>{factura.folio}</strong> quedará como <strong>Cancelada</strong> y
              no podrá modificarse ni recibir pagos.
            </p>
            <div className="confirmBtns">
              <button className="btnGhost" onClick={() => setConfirmCancel(false)} disabled={canceling}>
                No, volver
              </button>
              <button className="btnDanger" onClick={cancelarFactura} disabled={canceling}>
                <Ban size={16} />
                {canceling ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
