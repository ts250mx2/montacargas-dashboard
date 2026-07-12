'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tags, Plus, Edit2, Trash2, X, Check, AlertTriangle } from 'lucide-react';

/** Catálogos administrables — deben coincidir con lib/catalogos.ts */
const TABS: { tabla: string; titulo: string; campos: { key: string; label: string }[] }[] = [
  { tabla: 'formas_pago', titulo: 'Formas de Pago', campos: [{ key: 'nombre', label: 'Nombre' }] },
  { tabla: 'bancos', titulo: 'Bancos', campos: [{ key: 'nombre', label: 'Nombre' }] },
  { tabla: 'marcas', titulo: 'Marcas', campos: [{ key: 'nombre', label: 'Nombre' }] },
  { tabla: 'lineas', titulo: 'Líneas de Producto', campos: [{ key: 'nombre', label: 'Nombre' }] },
  {
    tabla: 'unidades', titulo: 'Unidades de Medida',
    campos: [{ key: 'nombre', label: 'Nombre' }, { key: 'abreviatura', label: 'Abreviatura' }],
  },
  {
    tabla: 'vendedores', titulo: 'Vendedores',
    campos: [
      { key: 'nombre', label: 'Nombre' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'correo', label: 'Correo' },
    ],
  },
];

export default function CatalogosPage() {
  const [tab, setTab] = useState(TABS[0]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/catalogos/${tab.tabla}`);
    const data = await res.json();
    setRows(data.rows || []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (row: any | null = null) => {
    setEditing(row);
    const base: Record<string, any> = {};
    for (const c of tab.campos) base[c.key] = row ? row[c.key] : '';
    base.activo = row ? row.activo : 1;
    setFormData(base);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/catalogos/${tab.tabla}/${editing.id}` : `/api/catalogos/${tab.tabla}`;
      const res = await fetch(url, {
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
      const res = await fetch(`/api/catalogos/${tab.tabla}/${confirmDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        if (data.message) alert(data.message);
        setConfirmDelete(null);
        fetchData();
      } else alert(data.message || 'Error al eliminar');
    } catch { alert('Error de conexión'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="pageContainer">
      <header className="pageHead">
        <div className="titleGroup">
          <div className="titleIcon"><Tags size={24} /></div>
          <div>
            <h1>Catálogos</h1>
            <p className="pageSubtitle">Información base utilizada por todo el sistema</p>
          </div>
        </div>
        <button className="btnPrimary" onClick={() => openModal()}>
          <Plus size={18} /> Nuevo Registro
        </button>
      </header>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.tabla}
            className={`tab ${t.tabla === tab.tabla ? 'tabActive' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.titulo}
          </button>
        ))}
      </div>

      <div className="glass animate-fade tableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              {tab.campos.map(c => <th key={c.key}>{c.label}</th>)}
              <th>Estatus</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={tab.campos.length + 2} className="emptyCell">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={tab.campos.length + 2} className="emptyCell">No hay registros</td></tr>
            ) : rows.map(row => (
              <tr key={row.id}>
                {tab.campos.map((c, i) => (
                  <td key={c.key} className={i === 0 ? 'tdBold' : 'tdMuted'}>{row[c.key] || '—'}</td>
                ))}
                <td>
                  <span className={`badge ${row.activo === 1 ? 'bVerde' : 'bGris'}`}>
                    {row.activo === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="rowActions">
                    <button className="iconBtn" onClick={() => openModal(row)} title="Editar"><Edit2 size={15} /></button>
                    <button className="iconBtn iconBtnDanger" onClick={() => setConfirmDelete(row)} title="Eliminar"><Trash2 size={15} /></button>
                  </div>
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
              <h3>{editing ? `Editar — ${tab.titulo}` : `Nuevo — ${tab.titulo}`}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              {tab.campos.map((c, i) => (
                <div className="field" key={c.key}>
                  <label className="fieldLabel">{c.label}{i === 0 ? ' *' : ''}</label>
                  <input
                    type="text"
                    value={formData[c.key] ?? ''}
                    onChange={e => setFormData({ ...formData, [c.key]: e.target.value })}
                    required={i === 0}
                    autoFocus={i === 0}
                  />
                </div>
              ))}

              <label className="toggle">
                <div className={`toggleTrack ${formData.activo === 1 ? 'on' : ''}`}
                  onClick={() => setFormData({ ...formData, activo: formData.activo === 1 ? 0 : 1 })}>
                  <div className="toggleThumb" />
                </div>
                <span>Activo</span>
              </label>

              <button type="submit" className="btnPrimary" style={{ justifyContent: 'center' }} disabled={saving}>
                <Check size={18} />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="overlay">
          <div className="glass confirmModal animate-scale">
            <div className="confirmIcon"><AlertTriangle size={40} /></div>
            <h3>¿Eliminar Registro?</h3>
            <p className="confirmMsg">
              Estás a punto de eliminar <strong>{confirmDelete.nombre}</strong> de {tab.titulo}.
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
