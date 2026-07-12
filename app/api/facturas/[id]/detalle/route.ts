import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { recalcularTotales } from '@/lib/facturas';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const b = await request.json();
    if (!b.id_producto || !b.cantidad || b.cantidad <= 0) {
      return NextResponse.json({ message: 'Producto y cantidad son obligatorios' }, { status: 400 });
    }

    const [facRows] = await pool.query('SELECT estado FROM facturas WHERE id = ?', [id]);
    const factura = (facRows as any[])[0];
    if (!factura) return NextResponse.json({ message: 'Factura no encontrada' }, { status: 404 });
    if (factura.estado === 'Cancelada') {
      return NextResponse.json({ message: 'No se puede modificar una factura cancelada' }, { status: 400 });
    }

    const [prodRows] = await pool.query('SELECT precio, costo FROM productos WHERE id = ?', [b.id_producto]);
    const producto = (prodRows as any[])[0];
    if (!producto) return NextResponse.json({ message: 'Producto no encontrado' }, { status: 404 });

    const cantidad = Number(b.cantidad);
    const precio = b.precio !== undefined && b.precio !== '' ? Number(b.precio) : Number(producto.precio);
    const descuento = Number(b.descuento ?? 0); // porcentaje 0-100
    const importe = Math.round(cantidad * precio * (1 - descuento / 100) * 100) / 100;

    await pool.query(
      `INSERT INTO factura_detalle (id_factura, id_producto, cantidad, precio, descuento, importe, costo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, b.id_producto, cantidad, precio, descuento, importe, producto.costo]
    );

    await recalcularTotales(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
