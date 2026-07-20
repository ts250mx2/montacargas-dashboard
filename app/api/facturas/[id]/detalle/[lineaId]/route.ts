import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { recalcularTotales } from '@/lib/facturas';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; lineaId: string }> }
) {
  const { id, lineaId } = await params;
  try {
    const b = await request.json();
    if (!b.cantidad || Number(b.cantidad) <= 0) {
      return NextResponse.json({ message: 'La cantidad debe ser mayor a cero' }, { status: 400 });
    }

    const [facRows] = await pool.query(`
      SELECT f.estado, f.total, COALESCE(SUM(p.importe), 0) AS cobrado
      FROM facturas f
      LEFT JOIN pagos p ON p.id_factura = f.id
      WHERE f.id = ?
      GROUP BY f.id`, [id]);
    const factura = (facRows as any[])[0];
    if (!factura) return NextResponse.json({ message: 'Factura no encontrada' }, { status: 404 });
    if (factura.estado === 'Cancelada') {
      return NextResponse.json({ message: 'No se puede modificar una factura cancelada' }, { status: 400 });
    }

    const [lineaRows] = await pool.query(
      'SELECT importe FROM factura_detalle WHERE id = ? AND id_factura = ?', [lineaId, id]
    );
    const lineaActual = (lineaRows as any[])[0];
    if (!lineaActual) return NextResponse.json({ message: 'Partida no encontrada' }, { status: 404 });

    const cantidad = Number(b.cantidad);
    const precio = Number(b.precio ?? 0);
    const descuento = Number(b.descuento ?? 0);
    const nuevoImporte = Math.round(cantidad * precio * (1 - descuento / 100) * 100) / 100;

    const nuevoTotalAprox = Number(factura.total) - Number(lineaActual.importe) + nuevoImporte;
    if (nuevoTotalAprox < Number(factura.cobrado) - 0.01) {
      return NextResponse.json(
        { message: 'El nuevo importe dejaría el total por debajo de lo ya cobrado en esta factura' },
        { status: 400 }
      );
    }

    await pool.query(
      `UPDATE factura_detalle SET cantidad = ?, precio = ?, descuento = ?, importe = ? WHERE id = ? AND id_factura = ?`,
      [cantidad, precio, descuento, nuevoImporte, lineaId, id]
    );
    await recalcularTotales(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; lineaId: string }> }
) {
  const { id, lineaId } = await params;
  try {
    const [facRows] = await pool.query(`
      SELECT f.estado, f.total, COALESCE(SUM(p.importe), 0) AS cobrado
      FROM facturas f
      LEFT JOIN pagos p ON p.id_factura = f.id
      WHERE f.id = ?
      GROUP BY f.id`, [id]);
    const factura = (facRows as any[])[0];
    if (!factura) return NextResponse.json({ message: 'Factura no encontrada' }, { status: 404 });
    if (factura.estado === 'Cancelada') {
      return NextResponse.json({ message: 'No se puede modificar una factura cancelada' }, { status: 400 });
    }

    const [lineaRows] = await pool.query(
      'SELECT importe FROM factura_detalle WHERE id = ? AND id_factura = ?', [lineaId, id]
    );
    const lineaActual = (lineaRows as any[])[0];
    if (lineaActual) {
      const nuevoTotalAprox = Number(factura.total) - Number(lineaActual.importe);
      if (nuevoTotalAprox < Number(factura.cobrado) - 0.01) {
        return NextResponse.json(
          { message: 'No se puede quitar: el total quedaría por debajo de lo ya cobrado en esta factura' },
          { status: 400 }
        );
      }
    }

    await pool.query('DELETE FROM factura_detalle WHERE id = ? AND id_factura = ?', [lineaId, id]);
    await recalcularTotales(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
