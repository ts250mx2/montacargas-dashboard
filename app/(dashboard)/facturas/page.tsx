'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Search, Plus, X, Check, Eye } from 'lucide-react';
import { money, fecha, badgeEstadoCobro } from '@/lib/format';

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
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
      if (res.ok) {
        // Ir directo al detalle para capturar los productos
        router.push(`/facturas/${data.id}`);
      } else {
        alert(data.message || 'Error al crear la factura');
      }
    } catch { alert('Error de conexión'); }
    finally { setSaving(false); }
  };

  const filtered = facturas.filter(f => {
    const coincideFiltro = filtro === 'Todas' || f.estado_cobro === filtro;
    const q = searchTerm.toLowerCase();
    const coincideBusqueda =
      f.folio.toLowerCase().includes(q) ||
      f.folio_interno.toLowerCase().includes(q) ||
      f.cliente.toLowerCase().includes(q);
    return coincideFiltro && coincideBusqueda;
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
        <button className="btnPrimary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Nueva Factura
        </button>
      </header>

      <div className="tabs">
        {FILTROS.map(f => (
          <button key={f} className={`tab ${filtro === f ? 'tabActive' : ''}`} onClick={() => setFiltro(f)}>
            {f}
          </button>
        ))}
      </div>

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
              <tr><td colSpan={11} className="emptyCell">No hay facturas</td></tr>
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
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="form">
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
