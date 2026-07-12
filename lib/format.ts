/** Utilidades de formato para la interfaz. */

export const money = (n: number | string) =>
  Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

export const fecha = (s: string) => {
  if (!s) return '—';
  const d = new Date(`${s.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Clase de badge según el estado de cobro. */
export const badgeEstadoCobro = (estado: string): string => {
  switch (estado) {
    case 'Pagada':       return 'badge bVerde';
    case 'Vencida':      return 'badge bRojo';
    case 'Por vencer':   return 'badge bAmbar';
    case 'Pago parcial': return 'badge bAzul';
    case 'Al corriente': return 'badge bAmarillo';
    case 'Cancelada':    return 'badge bGris';
    default:             return 'badge bGris';
  }
};
