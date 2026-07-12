'use client';

import { useState, useEffect } from 'react';
import { Settings, Check } from 'lucide-react';

const BLANK = {
  nombre_empresa: '', rfc: '', domicilio: '', telefono: '', correo: '',
  iva_porcentaje: 16, dias_alerta: 7, serie_folio: 'F',
};

export default function ConfiguracionPage() {
  const [formData, setFormData] = useState({ ...BLANK });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/configuracion')
      .then(r => r.json())
      .then(d => {
        if (d.config) {
          setFormData({
            nombre_empresa: d.config.nombre_empresa ?? '',
            rfc: d.config.rfc ?? '',
            domicilio: d.config.domicilio ?? '',
            telefono: d.config.telefono ?? '',
            correo: d.config.correo ?? '',
            iva_porcentaje: Number(d.config.iva_porcentaje ?? 16),
            dias_alerta: d.config.dias_alerta ?? 7,
            serie_folio: d.config.serie_folio ?? 'F',
          });
        }
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const err = await res.json();
        alert(err.message || 'Error al guardar');
      }
    } catch { alert('Error de conexión'); }
    finally { setSaving(false); }
  };

  return (
    <div className="pageContainer" style={{ maxWidth: 760 }}>
      <header className="pageHead">
        <div className="titleGroup">
          <div className="titleIcon"><Settings size={24} /></div>
          <div>
            <h1>Configuración</h1>
            <p className="pageSubtitle">Parámetros generales del sistema</p>
          </div>
        </div>
      </header>

      <div className="glass card animate-fade">
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Cargando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="form">
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Datos de la Empresa</h3>

            <div className="field">
              <label className="fieldLabel">Nombre / Razón Social</label>
              <input type="text" value={formData.nombre_empresa}
                onChange={e => setFormData({ ...formData, nombre_empresa: e.target.value })} />
            </div>

            <div className="formGrid2">
              <div className="field">
                <label className="fieldLabel">RFC</label>
                <input type="text" value={formData.rfc} maxLength={13}
                  onChange={e => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })} />
              </div>
              <div className="field">
                <label className="fieldLabel">Teléfono</label>
                <input type="tel" value={formData.telefono}
                  onChange={e => setFormData({ ...formData, telefono: e.target.value })} />
              </div>
            </div>

            <div className="formGrid2">
              <div className="field">
                <label className="fieldLabel">Correo</label>
                <input type="email" value={formData.correo}
                  onChange={e => setFormData({ ...formData, correo: e.target.value })} />
              </div>
              <div className="field">
                <label className="fieldLabel">Domicilio</label>
                <input type="text" value={formData.domicilio}
                  onChange={e => setFormData({ ...formData, domicilio: e.target.value })} />
              </div>
            </div>

            <div className="hazard" style={{ margin: '0.5rem 0' }} />
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Parámetros de Facturación y Cobranza</h3>

            <div className="formGrid3">
              <div className="field">
                <label className="fieldLabel">IVA (%)</label>
                <input type="number" step="0.01" min="0" max="100" value={formData.iva_porcentaje}
                  onChange={e => setFormData({ ...formData, iva_porcentaje: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="field">
                <label className="fieldLabel">Días alerta &quot;Por vencer&quot;</label>
                <input type="number" min="0" value={formData.dias_alerta}
                  onChange={e => setFormData({ ...formData, dias_alerta: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="field">
                <label className="fieldLabel">Serie de Folio</label>
                <input type="text" maxLength={10} value={formData.serie_folio}
                  onChange={e => setFormData({ ...formData, serie_folio: e.target.value.toUpperCase() })} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button type="submit" className="btnPrimary" disabled={saving}>
                <Check size={18} />
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
              {saved && <span className="badge bVerde">✓ Configuración guardada</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
