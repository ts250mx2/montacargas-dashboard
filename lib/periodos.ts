/** Periodos predefinidos para filtrar Inicio, Facturas y Cobranza. */

import { fecha } from './format';

export type PeriodoKey = 'hoy' | 'ayer' | 'semana' | 'mes' | 'todo' | 'personalizado';

export interface Periodo {
  key: PeriodoKey;
  /** Texto del botón. */
  label: string;
  /** Sufijo para etiquetas: "Facturado del mes", "Cobrado hoy"... */
  sufijo: string;
}

export interface RangoFechas {
  /** 'YYYY-MM-DD' inclusivo. Cadena vacía = sin límite. */
  desde: string;
  hasta: string;
}

/** Periodo seleccionado. `desde`/`hasta` solo aplican cuando key === 'personalizado'. */
export interface FiltroPeriodo extends RangoFechas {
  key: PeriodoKey;
}

export const PERIODOS: readonly Periodo[] = [
  { key: 'hoy',           label: 'Hoy',           sufijo: 'hoy' },
  { key: 'ayer',          label: 'Ayer',          sufijo: 'ayer' },
  { key: 'semana',        label: 'Esta semana',   sufijo: 'de la semana' },
  { key: 'mes',           label: 'Este mes',      sufijo: 'del mes' },
  { key: 'todo',          label: 'Todo',          sufijo: 'histórico' },
  { key: 'personalizado', label: 'Personalizado', sufijo: 'del periodo' },
];

/** Filtro sin fechas propias: el rango se calcula a partir de la key. */
export const filtroPeriodo = (key: PeriodoKey): FiltroPeriodo => ({ key, desde: '', hasta: '' });

const RANGO_ABIERTO: RangoFechas = { desde: '', hasta: '' };
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const esPeriodoKey = (valor: unknown): valor is PeriodoKey =>
  typeof valor === 'string' && PERIODOS.some(p => p.key === valor);

/** Sufijo descriptivo del periodo, para etiquetas de KPIs y subtítulos. */
export const sufijoPeriodo = (key: PeriodoKey): string =>
  PERIODOS.find(p => p.key === key)?.sufijo ?? '';

/** Fecha local (no UTC) en formato 'YYYY-MM-DD'. */
const aIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const sumarDias = (d: Date, dias: number): Date => {
  const copia = new Date(d);
  copia.setDate(copia.getDate() + dias);
  return copia;
};

/** Rango de fechas inclusivo del periodo indicado. La semana va de lunes a domingo. */
export function rangoPeriodo(key: PeriodoKey, referencia: Date = new Date()): RangoFechas {
  switch (key) {
    case 'hoy':
      return { desde: aIso(referencia), hasta: aIso(referencia) };

    case 'ayer': {
      const ayer = sumarDias(referencia, -1);
      return { desde: aIso(ayer), hasta: aIso(ayer) };
    }

    case 'semana': {
      const diaSemana = (referencia.getDay() + 6) % 7; // 0 = lunes
      const lunes = sumarDias(referencia, -diaSemana);
      return { desde: aIso(lunes), hasta: aIso(sumarDias(lunes, 6)) };
    }

    case 'mes': {
      const primero = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
      const ultimo = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
      return { desde: aIso(primero), hasta: aIso(ultimo) };
    }

    default:
      return RANGO_ABIERTO;
  }
}

/** Rango efectivo del filtro: fechas capturadas a mano o el periodo predefinido. */
export function rangoDeFiltro(filtro: FiltroPeriodo, referencia?: Date): RangoFechas {
  return filtro.key === 'personalizado'
    ? { desde: filtro.desde, hasta: filtro.hasta }
    : rangoPeriodo(filtro.key, referencia);
}

/** Descripción legible del periodo activo, para encabezados de reportes. */
export function describirPeriodo(filtro: FiltroPeriodo): string {
  const { desde, hasta } = rangoDeFiltro(filtro);
  const etiqueta = PERIODOS.find(p => p.key === filtro.key)?.label ?? '';

  if (!desde && !hasta) return `${etiqueta}: todos los registros`;
  if (!hasta) return `${etiqueta}: desde ${fecha(desde)}`;
  if (!desde) return `${etiqueta}: hasta ${fecha(hasta)}`;
  if (desde === hasta) return `${etiqueta}: ${fecha(desde)}`;
  return `${etiqueta}: ${fecha(desde)} — ${fecha(hasta)}`;
}

/** Normaliza cualquier fecha ('YYYY-MM-DD' o ISO completo) a 'YYYY-MM-DD'. */
export const soloFecha = (valor: string | Date | null | undefined): string => {
  if (!valor) return '';
  return valor instanceof Date ? aIso(valor) : String(valor).slice(0, 10);
};

/** ¿La fecha cae dentro del rango? Un rango sin límites acepta todo. */
export function enRango(valor: string | Date | null | undefined, rango: RangoFechas): boolean {
  if (!rango.desde && !rango.hasta) return true;
  const f = soloFecha(valor);
  if (!f) return false;
  if (rango.desde && f < rango.desde) return false;
  if (rango.hasta && f > rango.hasta) return false;
  return true;
}

/** Valida una fecha recibida por query string; devuelve '' si no es válida. */
export const fechaValida = (valor: string | null): string =>
  valor && FORMATO_FECHA.test(valor) ? valor : '';
