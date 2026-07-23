import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { borrarArchivo } from '@/lib/adjuntos';
import { normalizarPartidas } from '@/lib/gastos';
import { guardarPartidas } from '@/lib/gastos-db';

type Contexto = { params: Promise<{ id: string }> };

/** Calcula el IVA cuando no viene capturado, a partir del total y el subtotal. */
function montos(b: any) {
  const subtotal = Number(b.subtotal) || 0;
  const ivaCapturado = b.iva === '' || b.iva === undefined || b.iva === null ? null : Number(b.iva);
  const totalCapturado = b.total === '' || b.total === undefined || b.total === null ? null : Number(b.total);

  const iva = ivaCapturado ?? (totalCapturado !== null ? totalCapturado - subtotal : 0);
  const total = totalCapturado ?? subtotal + iva;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    iva: Math.round(iva * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export async function PUT(request: Request, { params }: Contexto) {
  const { id } = await params;
  try {
    const b = await request.json();

    // Cancelar / reactivar
    if (b.accion === 'estado') {
      await pool.query('UPDATE gastos SET estado = ? WHERE id = ?', [b.estado, id]);
      return NextResponse.json({ success: true });
    }

    const concepto = String(b.concepto ?? '').trim();
    if (!concepto) return NextResponse.json({ message: 'El concepto es obligatorio' }, { status: 400 });

    const { subtotal, iva, total } = montos(b);
    if (total <= 0) return NextResponse.json({ message: 'El total debe ser mayor a cero' }, { status: 400 });

    const uuid = String(b.uuid_cfdi ?? '').trim().toUpperCase();
    if (uuid) {
      const [repetidos] = await pool.query(
        'SELECT id FROM gastos WHERE uuid_cfdi = ? AND id <> ? LIMIT 1', [uuid, id]);
      if ((repetidos as any[]).length > 0) {
        return NextResponse.json(
          { message: `Ese comprobante ya está registrado en el gasto #${(repetidos as any[])[0].id}` },
          { status: 409 }
        );
      }
    }

    await pool.query(
      `UPDATE gastos SET fecha = ?, folio = ?, concepto = ?, id_proveedor = ?, id_categoria = ?,
        id_forma_pago = ?, subtotal = ?, iva = ?, total = ?, uuid_cfdi = ?, rfc_emisor = ?,
        deducible = ?, notas = ?
       WHERE id = ?`,
      [
        b.fecha, String(b.folio ?? '').trim(), concepto,
        b.id_proveedor || null, b.id_categoria || null, b.id_forma_pago || null,
        subtotal, iva, total, uuid, String(b.rfc_emisor ?? '').trim().toUpperCase(),
        b.deducible === false || b.deducible === 0 ? 0 : 1,
        String(b.notas ?? '').slice(0, 300),
        id,
      ]
    );

    // Las partidas se reemplazan completas; si no vienen, el gasto se queda sin desglose
    await guardarPartidas(id, normalizarPartidas(b.partidas));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const { id } = await params;
  try {
    // Los comprobantes se van con el gasto para no dejar archivos huérfanos
    const [adjuntos] = await pool.query('SELECT archivo FROM gasto_adjuntos WHERE id_gasto = ?', [id]);
    for (const adjunto of adjuntos as any[]) await borrarArchivo('gastos', adjunto.archivo);
    await pool.query('DELETE FROM gasto_adjuntos WHERE id_gasto = ?', [id]);

    await pool.query('DELETE FROM gasto_detalle WHERE id_gasto = ?', [id]);
    await pool.query('DELETE FROM gastos WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
