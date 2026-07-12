'use client';

import { useState, useEffect } from 'react';
import { Package, Search, Plus, Edit2, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import { money } from '@/lib/format';

interface Producto {
  id: number;
  sku: string;
  descripcion: string;
  id_marca: number | null;
  id_linea: number | null;
  id_unidad: number | null;
  id_proveedor: number | null;
  costo: number;
  precio: number;
  stock: number;
  activo: number;
  marca?: string;
  linea?: string;
  unidad_abrev?: string;
  proveedor?: string;
}

interface Opcion { id: number; nombre?: string; razon_social?: string; abreviatura?: string; }

const BLANK = {
  sku: '', descripcion: '', id_marca: 0, id_linea: 0, id_unidad: 0, id_proveedor: 0,
  costo: 0, precio: 0, stock: 0, activo: 1,
};

const margen = (costo: number, precio: number) => {
  if (!precio || precio <= 0) return null;
  return ((precio - costo) / precio) * 100;
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [marcas, setMarcas] = useState<Opcion[]>([]);
  const [lineas, setLineas] = useState<Opcion[]>([]);
  const [unidades, setUnidades] = useState<Opcion[]>([]);
  const [proveedores, setProveedores] = useState<Opcion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [formData, setFormData] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Producto | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const res = await fetch('/api/productos');
    const data = await res.json();
    setProductos(data.productos || []);
    setMarcas(data.marcas || []);
    setLineas(data.lineas || []);
    setUnidades(data.unidades || []);
    setProveedores(data.proveedores || []);
    setLoading(false);
  };

  const openModal = (p: Producto | null = null) => {
    if (p) {
      setEditing(p);
      setFormData({
        sku: p.sku, descripcion: p.descripcion,
        id_marca: p.id_marca || 0, id_linea: p.id_linea || 0,
        id_unidad: p.id_unidad || 0, id_proveedor: p.id_proveedor || 0,
        costo: Number(p.costo), precio: Number(p.precio), stock: Number(p.stock), activo: p.activo,
      });
    } else {
      setEditing(null);
      setFormData({ ...BLANK });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/productos/${editing.id}` : '/api/productos', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) { setIsModalOpen(false); fetchData(); }
      else { const err = await res.json(); alert(err.message || 'Error al guardar'); }
    } catch { alert('Error de conexión'); }
    finally { setSaving(false); }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/productos/${confirmDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        if (data.message) alert(data.message);
        setConfirmDelete(null);
        fetchData();
      } else alert(data.message || 'Error al eliminar');
    } catch { alert('Error de conexión'); }
    finally { setDeleting(false); }
  };

  const filtered = productos.filter(p =>
    p.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.marca || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.linea || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mForm = margen(formData.costo, formData.precio);

  return (
    <div className="pageContainer">
      <header className="pageHead">
        <div className="titleGroup">
          <div className="titleIcon"><Package size={24} /></div>
          <div>
            <h1>Productos</h1>
            <p className="pageSubtitle">Refacciones, precios, costos y márgenes</p>
          </div>
        </div>
        <button className="btnPrimary" onClick={() => openModal()}>
          <Plus size={18} /> Nuevo Producto
        </button>
      </header>

      <div className="glass searchBar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Buscar por SKU, descripción, marca o línea..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="glass animate-fade tableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Descripción</th>
              <th>Marca</th>
              <th>Línea</th>
              <th>Unidad</th>
              <th className="tdNum">Costo</th>
              <th className="tdNum">Precio</th>
              <th className="tdNum">Margen</th>
              <th>Estatus</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="emptyCell">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="emptyCell">No hay productos</td></tr>
            ) : filtered.map(p => {
              const m = margen(Number(p.costo), Number(p.precio));
              return (
                <tr key={p.id}>
                  <td className="tdBold">{p.sku}</td>
                  <td>{p.descripcion}</td>
                  <td><span className="badge bGris">{p.marca || '—'}</span></td>
                  <td className="tdMuted">{p.linea || '—'}</td>
                  <td className="tdMuted">{p.unidad_abrev || '—'}</td>
                  <td className="tdNum">{money(p.costo)}</td>
                  <td className="tdNum tdBold">{money(p.precio)}</td>
                  <td className="tdNum">
                    {m === null ? '—' : (
                      <span className={`badge ${m >= 30 ? 'bVerde' : m >= 15 ? 'bAmbar' : 'bRojo'}`}>
                        {m.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${p.activo === 1 ? 'bVerde' : 'bGris'}`}>
                      {p.activo === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="rowActions">
                      <button className="iconBtn" onClick={() => openModal(p)} title="Editar"><Edit2 size={15} /></button>
                      <button className="iconBtn iconBtnDanger" onClick={() => setConfirmDelete(p)} title="Eliminar"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="overlay">
          <div className="glass modal modalWide animate-scale">
            <div className="modalHead">
              <h3>{editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <div className="formGrid2">
                <div className="field">
                  <label className="fieldLabel">Código / SKU *</label>
                  <input type="text" value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} required autoFocus />
                </div>
                <div className="field">
                  <label className="fieldLabel">Unidad de Medida</label>
                  <select value={formData.id_unidad}
                    onChange={e => setFormData({ ...formData, id_unidad: +e.target.value })}>
                    <option value={0}>— Selecciona —</option>
                    {unidades.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="fieldLabel">Descripción *</label>
                <input type="text" value={formData.descripcion}
                  onChange={e => setFormData({ ...formData, descripcion: e.target.value })} required />
              </div>

              <div className="formGrid2">
                <div className="field">
                  <label className="fieldLabel">Marca</label>
                  <select value={formData.id_marca}
                    onChange={e => setFormData({ ...formData, id_marca: +e.target.value })}>
                    <option value={0}>— Selecciona —</option>
                    {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="fieldLabel">Línea de Producto</label>
                  <select value={formData.id_linea}
                    onChange={e => setFormData({ ...formData, id_linea: +e.target.value })}>
                    <option value={0}>— Selecciona —</option>
                    {lineas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="fieldLabel">Proveedor Principal</label>
                <select value={formData.id_proveedor}
                  onChange={e => setFormData({ ...formData, id_proveedor: +e.target.value })}>
                  <option value={0}>— Selecciona —</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                </select>
              </div>

              <div className="formGrid3">
                <div className="field">
                  <label className="fieldLabel">Costo ($)</label>
                  <input type="number" step="0.01" min="0" value={formData.costo}
                    onChange={e => setFormData({ ...formData, costo: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="field">
                  <label className="fieldLabel">Precio de Venta ($) *</label>
                  <input type="number" step="0.01" min="0" value={formData.precio}
                    onChange={e => setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })} required />
                </div>
                <div className="field">
                  <label className="fieldLabel">Margen</label>
                  <input type="text" readOnly value={mForm === null ? '—' : `${mForm.toFixed(1)} %`}
                    style={{ background: 'var(--surface-2)', fontWeight: 700 }} />
                </div>
              </div>

              <label className="toggle">
                <div className={`toggleTrack ${formData.activo === 1 ? 'on' : ''}`}
                  onClick={() => setFormData({ ...formData, activo: formData.activo === 1 ? 0 : 1 })}>
                  <div className="toggleThumb" />
                </div>
                <span>Activo</span>
              </label>

              <button type="submit" className="btnPrimary" style={{ justifyContent: 'center' }} disabled={saving}>
                <Check size={18} />
                {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="overlay">
          <div className="glass confirmModal animate-scale">
            <div className="confirmIcon"><AlertTriangle size={40} /></div>
            <h3>¿Eliminar Producto?</h3>
            <p className="confirmMsg">
              Estás a punto de eliminar <strong>{confirmDelete.descripcion}</strong> ({confirmDelete.sku}).
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
