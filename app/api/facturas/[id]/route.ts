import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { estadoCobro } from '@/lib/cobranza';
import { diasAlerta } from '@/lib/facturas';
import { borrarArchivo } from '@/lib/adjuntos';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [facRows] = await pool.query(`
      SELECT f.*,
             c.razon_social AS cliente, c.rfc AS cliente_rfc, c.dias_credito,
             v.nombre AS vendedor,
             fp.nombre AS forma_pago
      FROM facturas f
      JOIN clientes c          ON c.id = f.id_cliente
      LEFT JOIN vendedores v   ON v.id = f.id_vendedor
      LEFT JOIN formas_pago fp ON fp.id = f.id_forma_pago
      WHERE f.id = ?`, [id]);
    const factura = (facRows as any[])[0];
    if (!factura) {
      return NextResponse.json({ message: 'Factura no encontrada' }, { status: 404 });
    }

    const [detalle] = await pool.query(`
      SELECT d.*,
             p.sku, p.descripcion,
             m.nombre AS marca, l.nombre AS linea, u.abreviatura AS unidad
      FROM factura_detalle d
      JOIN productos p   ON p.id = d.id_producto
      LEFT JOIN marcas m ON m.id = p.id_marca
      LEFT JOIN lineas l ON l.id = p.id_linea
      LEFT JOIN unidades u ON u.id = p.id_unidad
      WHERE d.id_factura = ?
      ORDER BY d.id`, [id]);

    const [pagos] = await pool.query(`
      SELECT pg.*, fp.nombre AS forma_pago, bk.nombre AS banco
      FROM pagos pg
      LEFT JOIN formas_pago fp ON fp.id = pg.id_forma_pago
      LEFT JOIN bancos bk      ON bk.id = pg.id_banco
      WHERE pg.id_factura = ?
      ORDER BY pg.fecha, pg.id`, [id]);

    const cobrado = (pagos as any[]).reduce((s, p) => s + Number(p.importe), 0);
    const total = Number(factura.total);
    const alerta = await diasAlerta();

    // Productos activos para agregar partidas
    const [productos] = await pool.query(`
      SELECT p.id, p.sku, p.descripcion, p.precio, p.costo, u.abreviatura AS unidad, m.nombre AS marca
      FROM productos p
      LEFT JOIN unidades u ON u.id = p.id_unidad
      LEFT JOIN marcas m   ON m.id = p.id_marca
      WHERE p.activo = 1 ORDER BY p.descripcion`);

    // Catálogos para editar el encabezado de la factura
    // (incluye el cliente actual aunque haya sido desactivado, para no perderlo del selector)
    const [clientes] = await pool.query(
      'SELECT id, razon_social, dias_credito FROM clientes WHERE activo = 1 OR id = ? ORDER BY razon_social',
      [factura.id_cliente]
    );
    const [vendedores] = await pool.query('SELECT id, nombre FROM vendedores WHERE activo = 1 ORDER BY nombre');
    const [formasPago] = await pool.query('SELECT id, nombre FROM formas_pago WHERE activo = 1 ORDER BY nombre');

    const [adjuntos] = await pool.query(
      `SELECT id, nombre_original, tamano, uuid_cfdi, subido_en
       FROM factura_adjuntos WHERE id_factura = ? ORDER BY id DESC LIMIT 1`, [id]);

    return NextResponse.json({
      clientes,
      vendedores,
      formasPago,
      adjunto: (adjuntos as any[])[0] ?? null,
      factura: {
        ...factura,
        cobrado: Math.round(cobrado * 100) / 100,
        saldo: Math.round((total - cobrado) * 100) / 100,
        estado_cobro: estadoCobro({
          estadoFactura: factura.estado,
          total,
          cobrado,
          fechaVencimiento: factura.fecha_vencimiento,
          diasAlerta: alerta,
        }),
      },
      detalle,
      pagos,
      productos,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const b = await request.json();

    // Cancelar / reactivar factura
    if (b.accion === 'estado') {
      await pool.query('UPDATE facturas SET estado = ? WHERE id = ?', [b.estado, id]);
      return NextResponse.json({ success: true });
    }

    // Editar solo el folio interno
    if (b.accion === 'folio_interno') {
      const [estadoRows] = await pool.query('SELECT estado FROM facturas WHERE id = ?', [id]);
      const facturaActual = (estadoRows as any[])[0];
      if (!facturaActual) return NextResponse.json({ message: 'Factura no encontrada' }, { status: 404 });
      if (facturaActual.estado === 'Cancelada') {
        return NextResponse.json({ message: 'No se puede modificar una factura cancelada' }, { status: 400 });
      }
      const folioInterno = String(b.folio_interno ?? '').trim().toUpperCase();
      if (!folioInterno) {
        return NextResponse.json({ message: 'El folio interno es obligatorio' }, { status: 400 });
      }
      await pool.query('UPDATE facturas SET folio_interno = ? WHERE id = ?', [folioInterno, id]);
      return NextResponse.json({ success: true });
    }

    // Editar encabezado completo (cliente, vendedor, forma de pago, fechas, notas)
    const [estadoRows] = await pool.query('SELECT estado FROM facturas WHERE id = ?', [id]);
    const facturaActual = (estadoRows as any[])[0];
    if (!facturaActual) return NextResponse.json({ message: 'Factura no encontrada' }, { status: 404 });
    if (facturaActual.estado === 'Cancelada') {
      return NextResponse.json({ message: 'No se puede modificar una factura cancelada' }, { status: 400 });
    }
    if (!b.id_cliente) {
      return NextResponse.json({ message: 'El cliente es obligatorio' }, { status: 400 });
    }
    const folioInterno = String(b.folio_interno ?? '').trim().toUpperCase();
    if (!folioInterno) {
      return NextResponse.json({ message: 'El folio interno es obligatorio' }, { status: 400 });
    }

    await pool.query(
      `UPDATE facturas SET id_cliente = ?, folio_interno = ?, fecha = ?, id_vendedor = ?, id_forma_pago = ?, fecha_vencimiento = ?, notas = ? WHERE id = ?`,
      [b.id_cliente, folioInterno, b.fecha, b.id_vendedor || null, b.id_forma_pago || null, b.fecha_vencimiento, b.notas ?? '', id]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [pagos] = await pool.query('SELECT COUNT(*) AS n FROM pagos WHERE id_factura = ?', [id]);
    if ((pagos as any[])[0].n > 0) {
      return NextResponse.json(
        { message: 'La factura tiene pagos registrados. Cancélala en lugar de eliminarla.' },
        { status: 400 }
      );
    }
    // Los PDF adjuntos se van con la factura para no dejar archivos huérfanos
    const [adjuntos] = await pool.query('SELECT archivo FROM factura_adjuntos WHERE id_factura = ?', [id]);
    for (const adjunto of adjuntos as any[]) await borrarArchivo('facturas', adjunto.archivo);
    await pool.query('DELETE FROM factura_adjuntos WHERE id_factura = ?', [id]);

    await pool.query('DELETE FROM factura_detalle WHERE id_factura = ?', [id]);
    await pool.query('DELETE FROM facturas WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
