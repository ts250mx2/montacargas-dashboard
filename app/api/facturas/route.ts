import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { estadoCobro } from '@/lib/cobranza';
import { diasAlerta } from '@/lib/facturas';

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT f.*,
             c.razon_social AS cliente,
             v.nombre       AS vendedor,
             fp.nombre      AS forma_pago,
             COALESCE(p.cobrado, 0) AS cobrado
      FROM facturas f
      JOIN clientes c        ON c.id = f.id_cliente
      LEFT JOIN vendedores v ON v.id = f.id_vendedor
      LEFT JOIN formas_pago fp ON fp.id = f.id_forma_pago
      LEFT JOIN (
        SELECT id_factura, SUM(importe) AS cobrado FROM pagos GROUP BY id_factura
      ) p ON p.id_factura = f.id
      ORDER BY f.id DESC
    `);

    const alerta = await diasAlerta();
    const facturas = (rows as any[]).map(f => {
      const total = Number(f.total);
      const cobrado = Number(f.cobrado);
      return {
        ...f,
        saldo: Math.round((total - cobrado) * 100) / 100,
        estado_cobro: estadoCobro({
          estadoFactura: f.estado,
          total,
          cobrado,
          fechaVencimiento: f.fecha_vencimiento,
          diasAlerta: alerta,
        }),
      };
    });

    // Datos para el formulario de nueva factura
    const [clientes]   = await pool.query('SELECT id, razon_social, dias_credito FROM clientes WHERE activo = 1 ORDER BY razon_social');
    const [vendedores] = await pool.query('SELECT id, nombre FROM vendedores WHERE activo = 1 ORDER BY nombre');
    const [formasPago] = await pool.query('SELECT id, nombre FROM formas_pago WHERE activo = 1 ORDER BY nombre');

    return NextResponse.json({ facturas, clientes, vendedores, formasPago });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json();
    if (!b.id_cliente) {
      return NextResponse.json({ message: 'El cliente es obligatorio' }, { status: 400 });
    }
    const folioInterno = String(b.folio_interno ?? '').trim().toUpperCase();
    if (!folioInterno) {
      return NextResponse.json({ message: 'El folio interno es obligatorio' }, { status: 400 });
    }

    const [cfgRows] = await pool.query('SELECT iva_porcentaje, serie_folio FROM configuracion WHERE id = 1');
    const cfg = (cfgRows as any[])[0] || { iva_porcentaje: 16, serie_folio: 'F' };

    const fecha: string = b.fecha || new Date().toISOString().slice(0, 10);

    // Vencimiento: el indicado, o fecha + días de crédito del cliente
    let vencimiento: string = b.fecha_vencimiento || '';
    if (!vencimiento) {
      const [cliRows] = await pool.query('SELECT dias_credito FROM clientes WHERE id = ?', [b.id_cliente]);
      const dias = (cliRows as any[])[0]?.dias_credito ?? 0;
      const d = new Date(`${fecha}T00:00:00`);
      d.setDate(d.getDate() + dias);
      vencimiento = d.toISOString().slice(0, 10);
    }

    // Folio consecutivo: SERIE-#### (usa el mayor consecutivo existente de la serie)
    const [folRows] = await pool.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(folio, '-', -1) AS UNSIGNED)), 0) AS ultimo
       FROM facturas WHERE folio LIKE ?`,
      [`${cfg.serie_folio}-%`]
    );
    const consecutivo = ((folRows as any[])[0]?.ultimo ?? 0) + 1;
    const folio = b.folio?.trim() || `${cfg.serie_folio}-${String(consecutivo).padStart(4, '0')}`;

    const [result] = await pool.query(
      `INSERT INTO facturas (folio, folio_interno, fecha, id_cliente, id_vendedor, id_forma_pago, fecha_vencimiento, estado, iva_porcentaje, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Vigente', ?, ?)`,
      [
        folio, folioInterno, fecha, b.id_cliente, b.id_vendedor || null, b.id_forma_pago || null,
        vencimiento, cfg.iva_porcentaje, b.notas ?? '',
      ]
    );
    return NextResponse.json({ success: true, id: (result as any).insertId, folio });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ message: 'Ya existe una factura con ese folio' }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
