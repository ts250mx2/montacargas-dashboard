/** Acceso a base de datos para las partidas de gastos (la lógica pura vive en gastos.ts). */

import pool from './db';
import type { PartidaGasto } from './gastos';

/** Reemplaza por completo las partidas de un gasto. */
export async function guardarPartidas(
  idGasto: number | string,
  partidas: readonly PartidaGasto[],
): Promise<void> {
  await pool.query('DELETE FROM gasto_detalle WHERE id_gasto = ?', [idGasto]);
  if (partidas.length === 0) return;

  await pool.query(
    'INSERT INTO gasto_detalle (id_gasto, clave, descripcion, cantidad, precio, importe) VALUES ?',
    [partidas.map(p => [idGasto, p.clave, p.descripcion, p.cantidad, p.precio, p.importe])]
  );
}
