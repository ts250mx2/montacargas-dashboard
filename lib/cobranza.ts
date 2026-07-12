/**
 * Cálculo del Estado de Cobro de una factura.
 * Estados: Pagada · Vencida · Pago parcial · Por vencer · Al corriente · Cancelada
 */
export type EstadoCobro =
  | 'Pagada'
  | 'Vencida'
  | 'Pago parcial'
  | 'Por vencer'
  | 'Al corriente'
  | 'Cancelada';

export function estadoCobro(params: {
  estadoFactura: string;          // Vigente | Cancelada
  total: number;
  cobrado: number;
  fechaVencimiento: string;       // YYYY-MM-DD
  diasAlerta: number;
}): EstadoCobro {
  const { estadoFactura, total, cobrado, fechaVencimiento, diasAlerta } = params;

  if (estadoFactura === 'Cancelada') return 'Cancelada';

  const saldo = Math.round((total - cobrado) * 100) / 100;
  if (total > 0 && saldo <= 0) return 'Pagada';

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(`${fechaVencimiento}T00:00:00`);

  if (venc < hoy) return 'Vencida';
  if (cobrado > 0) return 'Pago parcial';

  const diasRestantes = Math.round((venc.getTime() - hoy.getTime()) / 86400000);
  if (diasRestantes <= diasAlerta) return 'Por vencer';

  return 'Al corriente';
}
