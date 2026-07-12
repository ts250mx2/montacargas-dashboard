'use client';

/**
 * Página CRUD compartida para Clientes y Proveedores
 * (misma estructura de datos: razón social, RFC, contacto, crédito...).
 */
import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, X, Check, AlertTriangle, type LucideIcon } from 'lucide-react';
import { money } from '@/lib/format';

interface Entidad {
  id: number;
  razon_social: string;
  rfc: string;
  contacto: string;
  telefono: string;
  correo: string;
  domicilio: string;
  dias_credito: number;
  limite_credito: number;
  activo: number;
}

const BLANK: Omit<Entidad, 'id'> = {
  razon_social: '', rfc: '', contacto: '', telefono: '', correo: '',
  domicilio: '', dias_credito: 0, limite_credito: 0, activo: 1,
};

interface Props {
  titulo: string;
  subtitulo: string;
  singular: string;       // "Cliente" | "Proveedor"
  api: string;            // "/api/clientes" | "/api/proveedores"
  dataKey: string;        // "clientes" | "proveedores"
  icon: LucideIcon;
}

export default function EntidadPage({ titulo, subtitulo, singular, api, dataKey, icon: Icon }: Props) {
  const [items, setItems] = useState<Entidad[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Entidad | null>(null);
  const [formData, setFormData] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Entidad | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const res = await fetch(api);
    const data = await res.json();
    setItems(data[dataKey] || []);
    setLoading(false);
  };

  const openModal = (item: Entidad | null = null) => {
    if (item) {
      setEditing(item);
      setFormData({
        razon_social: item.razon_social, rfc: item.rfc, contacto: item.contacto,
        telefono: item.telefono, correo: item.correo, domicilio: item.domicilio,
        dias_credito: item.dias_credito, limite_credito: item.limite_credito, activo: item.activo,
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
      const res = await fetch(editing ? `${api}/${editing.id}` : api, {
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
      const res = await fetch(`${api}/${confirmDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        if (data.message) alert(data.message);
        setConfirmDelete(null);
        fetchData();
      } else alert(data.message || 'Error al eliminar');
    } catch { alert('Error de conexión'); }
    finally { setDeleting(false); }
  };

  const filtered = items.filter(i =>
    i.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.rfc.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.contacto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pageContainer">
      <header className="pageHead">
        <div className="titleGroup">
          <div className="titleIcon"><Icon size={24} /></div>
          <div>
            <h1>{titulo}</h1>
            <p className="pageSubtitle">{subtitulo}</p>
          </div>
        </div>
        <button className="btnPrimary" onClick={() => openModal()}>
          <Plus size={18} /> Nuevo {singular}
        </button>
      </header>

      <div className="glass searchBar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Buscar por razón social, RFC o contacto..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="glass animate-fade tableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              <th>Razón Social</th>
              <th>RFC</th>
              <th>Contacto</th>
              <th>Teléfono</th>
              <th className="tdNum">Días Crédito</th>
              <th className="tdNum">Límite Crédito</th>
              <th>Estatus</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="emptyCell">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="emptyCell">No hay registros</td></tr>
            ) : filtered.map(item => (
              <tr key={item.id}>
                <td className="tdBold">{item.razon_social}</td>
                <td className="tdMuted">{item.rfc || '—'}</td>
                <td>{item.contacto || '—'}</td>
                <td className="tdMuted">{item.telefono || '—'}</td>
                <td className="tdNum">{item.dias_credito}</td>
                <td className="tdNum">{Number(item.limite_credito) > 0 ? money(item.limite_credito) : '—'}</td>
                <td>
                  <span className={`badge ${item.activo === 1 ? 'bVerde' : 'bGris'}`}>
                    {item.activo === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="rowActions">
                    <button className="iconBtn" onClick={() => openModal(item)} title="Editar"><Edit2 size={15} /></button>
                    <button className="iconBtn iconBtnDanger" onClick={() => setConfirmDelete(item)} title="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="overlay">
          <div className="glass modal modalWide animate-scale">
            <div className="modalHead">
              <h3>{editing ? `Editar ${singular}` : `Nuevo ${singular}`}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <div className="field">
                <label className="fieldLabel">Razón Social *</label>
                <input type="text" value={formData.razon_social}
                  onChange={e => setFormData({ ...formData, razon_social: e.target.value })} required autoFocus />
              </div>

              <div className="formGrid2">
                <div className="field">
                  <label className="fieldLabel">RFC</label>
                  <input type="text" value={formData.rfc} maxLength={13}
                    onChange={e => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })} />
                </div>
                <div className="field">
                  <label className="fieldLabel">Contacto</label>
                  <input type="text" value={formData.contacto}
                    onChange={e => setFormData({ ...formData, contacto: e.target.value })} />
                </div>
              </div>

              <div className="formGrid2">
                <div className="field">
                  <label className="fieldLabel">Teléfono</label>
                  <input type="tel" value={formData.telefono}
                    onChange={e => setFormData({ ...formData, telefono: e.target.value })} />
                </div>
                <div className="field">
                  <label className="fieldLabel">Correo</label>
                  <input type="email" value={formData.correo}
                    onChange={e => setFormData({ ...formData, correo: e.target.value })} />
                </div>
              </div>

              <div className="field">
                <label className="fieldLabel">Domicilio</label>
                <input type="text" value={formData.domicilio}
                  onChange={e => setFormData({ ...formData, domicilio: e.target.value })} />
              </div>

              <div className="formGrid2">
                <div className="field">
                  <label className="fieldLabel">Días de Crédito</label>
                  <input type="number" min="0" value={formData.dias_credito}
                    onChange={e => setFormData({ ...formData, dias_credito: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="field">
                  <label className="fieldLabel">Límite de Crédito ($)</label>
                  <input type="number" step="0.01" min="0" value={formData.limite_credito}
                    onChange={e => setFormData({ ...formData, limite_credito: parseFloat(e.target.value) || 0 })} />
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
                {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : `Crear ${singular}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="overlay">
          <div className="glass confirmModal animate-scale">
            <div className="confirmIcon"><AlertTriangle size={40} /></div>
            <h3>¿Eliminar {singular}?</h3>
            <p className="confirmMsg">
              Estás a punto de eliminar <strong>{confirmDelete.razon_social}</strong>.
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
