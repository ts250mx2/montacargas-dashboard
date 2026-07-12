import pool from './db';

/** Recalcula subtotal, IVA y total de una factura a partir de su detalle. */
export async function recalcularTotales(idFactura: number | string) {
  await pool.query(
    `UPDATE facturas f
     SET f.subtotal = COALESCE((SELECT SUM(d.importe) FROM factura_detalle d WHERE d.id_factura = f.id), 0),
         f.iva      = ROUND(COALESCE((SELECT SUM(d.importe) FROM factura_detalle d WHERE d.id_factura = f.id), 0) * f.iva_porcentaje / 100, 2),
         f.total    = f.subtotal + f.iva
     WHERE f.id = ?`,
    [idFactura]
  );
  // MySQL evalúa los SET en orden, pero por claridad recalculamos total con valores frescos
  await pool.query(
    `UPDATE facturas SET total = ROUND(subtotal + iva, 2) WHERE id = ?`,
    [idFactura]
  );
}

/** Días de alerta configurados (para estado "Por vencer"). */
export async function diasAlerta(): Promise<number> {
  const [rows] = await pool.query('SELECT dias_alerta FROM configuracion WHERE id = 1');
  return (rows as any[])[0]?.dias_alerta ?? 7;
}
