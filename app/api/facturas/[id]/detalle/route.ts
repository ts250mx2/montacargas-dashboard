import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { recalcularTotales } from '@/lib/facturas';

interface LineaEntrada {
  id_producto?: number;
  cantidad?: number | string;
  precio?: number | string;
  descuento?: number | string;
}

/** Inserta una partida. Devuelve un mensaje de error o null si todo salió bien. */
async function insertarLinea(idFactura: string, linea: LineaEntrada): Promise<string | null> {
  if (!linea.id_producto || !linea.cantidad || Number(linea.cantidad) <= 0) {
    return 'Producto y cantidad son obligatorios';
  }

  const [prodRows] = await pool.query('SELECT precio, costo FROM productos WHERE id = ?', [linea.id_producto]);
  const producto = (prodRows as any[])[0];
  if (!producto) return 'Producto no encontrado';

  const cantidad = Number(linea.cantidad);
  const precio = linea.precio !== undefined && linea.precio !== '' ? Number(linea.precio) : Number(producto.precio);
  const descuento = Number(linea.descuento ?? 0); // porcentaje 0-100
  const importe = Math.round(cantidad * precio * (1 - descuento / 100) * 100) / 100;

  await pool.query(
    `INSERT INTO factura_detalle (id_factura, id_producto, cantidad, precio, descuento, importe, costo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [idFactura, linea.id_producto, cantidad, precio, descuento, importe, producto.costo]
  );
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const b = await request.json();

    const [facRows] = await pool.query('SELECT estado FROM facturas WHERE id = ?', [id]);
    const factura = (facRows as any[])[0];
    if (!factura) return NextResponse.json({ message: 'Factura no encontrada' }, { status: 404 });
    if (factura.estado === 'Cancelada') {
      return NextResponse.json({ message: 'No se puede modificar una factura cancelada' }, { status: 400 });
    }

    // Alta múltiple: se usa al volcar las partidas leídas de un PDF
    if (Array.isArray(b.lineas)) {
      let agregadas = 0;
      const errores: string[] = [];

      for (const [i, linea] of (b.lineas as LineaEntrada[]).entries()) {
        const error = await insertarLinea(id, linea);
        if (error) errores.push(`Partida ${i + 1}: ${error}`);
        else agregadas++;
      }

      if (agregadas > 0) await recalcularTotales(id);
      return NextResponse.json({ success: true, agregadas, errores });
    }

    const error = await insertarLinea(id, b);
    if (error) return NextResponse.json({ message: error }, { status: 400 });

    await recalcularTotales(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
