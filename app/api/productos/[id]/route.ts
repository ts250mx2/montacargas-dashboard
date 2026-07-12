import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const b = await request.json();
    await pool.query(
      `UPDATE productos SET sku = ?, descripcion = ?, id_marca = ?, id_linea = ?, id_unidad = ?,
       id_proveedor = ?, costo = ?, precio = ?, stock = ?, activo = ? WHERE id = ?`,
      [
        b.sku, b.descripcion,
        b.id_marca || null, b.id_linea || null, b.id_unidad || null, b.id_proveedor || null,
        b.costo ?? 0, b.precio ?? 0, b.stock ?? 0, b.activo ?? 1, id,
      ]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ message: 'Ya existe un producto con ese SKU' }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [ventas] = await pool.query('SELECT COUNT(*) AS n FROM factura_detalle WHERE id_producto = ?', [id]);
    if ((ventas as any[])[0].n > 0) {
      await pool.query('UPDATE productos SET activo = 0 WHERE id = ?', [id]);
      return NextResponse.json({ success: true, message: 'El producto tiene ventas: se desactivó en lugar de eliminar' });
    }
    await pool.query('DELETE FROM productos WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
