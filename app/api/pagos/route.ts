import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { estadoCobro } from '@/lib/cobranza';
import { diasAlerta } from '@/lib/facturas';

export async function GET() {
  try {
    const [pagos] = await pool.query(`
      SELECT pg.*,
             f.folio, f.folio_interno, f.total AS factura_total,
             c.razon_social AS cliente,
             fp.nombre AS forma_pago,
             bk.nombre AS banco
      FROM pagos pg
      JOIN facturas f          ON f.id = pg.id_factura
      JOIN clientes c          ON c.id = f.id_cliente
      LEFT JOIN formas_pago fp ON fp.id = pg.id_forma_pago
      LEFT JOIN bancos bk      ON bk.id = pg.id_banco
      ORDER BY pg.id DESC
    `);

    // Facturas vigentes con saldo pendiente (para registrar pagos)
    const [pendRows] = await pool.query(`
      SELECT f.id, f.folio, f.folio_interno, f.total, f.fecha_vencimiento, f.estado,
             c.razon_social AS cliente,
             COALESCE(p.cobrado, 0) AS cobrado
      FROM facturas f
      JOIN clientes c ON c.id = f.id_cliente
      LEFT JOIN (SELECT id_factura, SUM(importe) AS cobrado FROM pagos GROUP BY id_factura) p
        ON p.id_factura = f.id
      WHERE f.estado = 'Vigente' AND f.total > COALESCE(p.cobrado, 0)
      ORDER BY f.fecha_vencimiento
    `);

    const alerta = await diasAlerta();
    const facturasPendientes = (pendRows as any[]).map(f => ({
      ...f,
      saldo: Math.round((Number(f.total) - Number(f.cobrado)) * 100) / 100,
      estado_cobro: estadoCobro({
        estadoFactura: f.estado,
        total: Number(f.total),
        cobrado: Number(f.cobrado),
        fechaVencimiento: f.fecha_vencimiento,
        diasAlerta: alerta,
      }),
    }));

    const [formasPago] = await pool.query('SELECT id, nombre FROM formas_pago WHERE activo = 1 ORDER BY nombre');
    const [bancos]     = await pool.query('SELECT id, nombre FROM bancos WHERE activo = 1 ORDER BY nombre');

    return NextResponse.json({ pagos, facturasPendientes, formasPago, bancos });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json();
    if (!b.id_factura || !b.importe || Number(b.importe) <= 0) {
      return NextResponse.json({ message: 'Factura e importe son obligatorios' }, { status: 400 });
    }

    const [facRows] = await pool.query(`
      SELECT f.total, f.estado, COALESCE(SUM(p.importe), 0) AS cobrado
      FROM facturas f
      LEFT JOIN pagos p ON p.id_factura = f.id
      WHERE f.id = ?
      GROUP BY f.id`, [b.id_factura]);
    const factura = (facRows as any[])[0];
    if (!factura) return NextResponse.json({ message: 'Factura no encontrada' }, { status: 404 });
    if (factura.estado === 'Cancelada') {
      return NextResponse.json({ message: 'No se pueden registrar pagos a una factura cancelada' }, { status: 400 });
    }

    const saldo = Math.round((Number(factura.total) - Number(factura.cobrado)) * 100) / 100;
    if (Number(b.importe) > saldo + 0.01) {
      return NextResponse.json(
        { message: `El importe excede el saldo pendiente ($${saldo.toFixed(2)})` },
        { status: 400 }
      );
    }

    const fecha: string = b.fecha || new Date().toISOString().slice(0, 10);
    const [result] = await pool.query(
      `INSERT INTO pagos (fecha, id_factura, id_forma_pago, id_banco, referencia, importe)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fecha, b.id_factura, b.id_forma_pago || null, b.id_banco || null, b.referencia ?? '', b.importe]
    );
    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
