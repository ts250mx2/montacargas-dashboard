'use client';

import { CalendarDays, SlidersHorizontal } from 'lucide-react';
import { fecha } from '@/lib/format';
import {
  PERIODOS, rangoDeFiltro, rangoPeriodo,
  type FiltroPeriodo, type PeriodoKey, type RangoFechas,
} from '@/lib/periodos';

interface PeriodoFilterProps {
  value: FiltroPeriodo;
  onChange: (filtro: FiltroPeriodo) => void;
  /** Texto de la etiqueta izquierda. */
  label?: string;
}

const textoRango = ({ desde, hasta }: RangoFechas): string => {
  if (!desde && !hasta) return 'Todos los registros';
  if (!hasta) return `Desde ${fecha(desde)}`;
  if (!desde) return `Hasta ${fecha(hasta)}`;
  return desde === hasta ? fecha(desde) : `${fecha(desde)} — ${fecha(hasta)}`;
};

export default function PeriodoFilter({ value, onChange, label = 'Periodo' }: PeriodoFilterProps) {
  const rango = rangoDeFiltro(value);
  const esPersonalizado = value.key === 'personalizado';

  const seleccionar = (key: PeriodoKey) => {
    if (key !== 'personalizado') {
      onChange({ key, desde: '', hasta: '' });
      return;
    }
    // Al pasar a personalizado se precargan las fechas del periodo que estaba activo
    const hoy = rangoPeriodo('hoy').desde;
    onChange({ key, desde: rango.desde || hoy, hasta: rango.hasta || hoy });
  };

  // El rango se mantiene coherente: la fecha inicial nunca queda después de la final
  const cambiarDesde = (desde: string) => onChange({
    key: 'personalizado',
    desde,
    hasta: value.hasta && desde && desde > value.hasta ? desde : value.hasta,
  });

  const cambiarHasta = (hasta: string) => onChange({
    key: 'personalizado',
    desde: value.desde && hasta && hasta < value.desde ? hasta : value.desde,
    hasta,
  });

  return (
    <div className="glass periodoBar">
      <span className="periodoLabel">
        <CalendarDays size={16} /> {label}
      </span>

      <div className="periodoChips" role="group" aria-label="Filtrar por periodo">
        {PERIODOS.map(p => (
          <button
            key={p.key}
            type="button"
            aria-pressed={value.key === p.key}
            className={`periodoChip ${value.key === p.key ? 'periodoChipActive' : ''}`}
            onClick={() => seleccionar(p.key)}
          >
            {p.key === 'personalizado' && <SlidersHorizontal size={13} />}
            {p.label}
          </button>
        ))}
      </div>

      {/* El rango depende de la fecha actual: puede diferir entre servidor y navegador */}
      <span className="periodoRango" suppressHydrationWarning>{textoRango(rango)}</span>

      {esPersonalizado && (
        <div className="periodoFechas">
          <label className="periodoFecha">
            <span>Desde</span>
            <input
              type="date"
              value={value.desde}
              max={value.hasta || undefined}
              onChange={e => cambiarDesde(e.target.value)}
            />
          </label>

          <label className="periodoFecha">
            <span>Hasta</span>
            <input
              type="date"
              value={value.hasta}
              min={value.desde || undefined}
              onChange={e => cambiarHasta(e.target.value)}
            />
          </label>

          {(value.desde || value.hasta) && (
            <button
              type="button"
              className="periodoLimpiar"
              onClick={() => onChange({ key: 'personalizado', desde: '', hasta: '' })}
            >
              Limpiar fechas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
