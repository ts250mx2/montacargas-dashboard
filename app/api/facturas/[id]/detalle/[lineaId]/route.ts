import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { recalcularTotales } from '@/lib/facturas';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; lineaId: string }> }
) {
  const { id, lineaId } = await params;
  try {
    const [facRows] = await pool.query('SELECT estado FROM facturas WHERE id = ?', [id]);
    const factura = (facRows as any[])[0];
    if (!factura) return NextResponse.json({ message: 'Factura no encontrada' }, { status: 404 });
    if (factura.estado === 'Cancelada') {
      return NextResponse.json({ message: 'No se puede modificar una factura cancelada' }, { status: 400 });
    }

    await pool.query('DELETE FROM factura_detalle WHERE id = ? AND id_factura = ?', [lineaId, id]);
    await recalcularTotales(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
