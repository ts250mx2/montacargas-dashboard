import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { estadoCobro } from '@/lib/cobranza';
import { diasAlerta } from '@/lib/facturas';
import { fechaValida } from '@/lib/periodos';

/** Construye el fragmento SQL del rango de fechas para la columna indicada. */
function filtroRango(columna: string, desde: string, hasta: string) {
  const partes: string[] = [];
  const params: string[] = [];
  if (desde) { partes.push(`${columna} >= ?`); params.push(desde); }
  if (hasta) { partes.push(`${columna} <= ?`); params.push(hasta); }
  return { sql: partes.length ? ` AND ${partes.join(' AND ')}` : '', params };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const desde = fechaValida(searchParams.get('desde'));
    const hasta = fechaValida(searchParams.get('hasta'));

    const rangoFacturas = filtroRango('fecha', desde, hasta);
    const rangoPagos = filtroRango('fecha', desde, hasta);
    const rangoFacturasAlias = filtroRango('f.fecha', desde, hasta);

    const [factPeriodo] = await pool.query(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS monto
       FROM facturas WHERE estado = 'Vigente'${rangoFacturas.sql}`, rangoFacturas.params);

    const [cobPeriodo] = await pool.query(
      `SELECT COUNT(*) AS n, COALESCE(SUM(importe), 0) AS monto
       FROM pagos WHERE 1 = 1${rangoPagos.sql}`, rangoPagos.params);

    const [saldos] = await pool.query(`
      SELECT f.id, f.folio, f.folio_interno, f.total, f.fecha, f.fecha_vencimiento, f.estado,
             c.razon_social AS cliente,
             COALESCE(p.cobrado, 0) AS cobrado
      FROM facturas f
      JOIN clientes c ON c.id = f.id_cliente
      LEFT JOIN (SELECT id_factura, SUM(importe) AS cobrado FROM pagos GROUP BY id_factura) p
        ON p.id_factura = f.id
      WHERE f.estado = 'Vigente'${rangoFacturasAlias.sql}
    `, rangoFacturasAlias.params);

    const alerta = await diasAlerta();
    let saldoPendiente = 0;
    let vencidasMonto = 0;
    let vencidasN = 0;
    let porVencerMonto = 0;
    let porVencerN = 0;

    const conEstado = (saldos as any[]).map(f => {
      const total = Number(f.total);
      const cobrado = Number(f.cobrado);
      const saldo = Math.round((total - cobrado) * 100) / 100;
      const estado = estadoCobro({
        estadoFactura: f.estado,
        total,
        cobrado,
        fechaVencimiento: f.fecha_vencimiento,
        diasAlerta: alerta,
      });
      if (saldo > 0) saldoPendiente += saldo;
      if (estado === 'Vencida') { vencidasMonto += saldo; vencidasN++; }
      if (estado === 'Por vencer') { porVencerMonto += saldo; porVencerN++; }
      return { ...f, saldo, estado_cobro: estado };
    });

    // Facturas con saldo, las más urgentes primero (vencidas y por vencer)
    const urgentes = conEstado
      .filter(f => f.saldo > 0)
      .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))
      .slice(0, 8);

    const [ultimas] = await pool.query(`
      SELECT f.id, f.folio, f.folio_interno, f.fecha, f.total, f.estado, c.razon_social AS cliente
      FROM facturas f JOIN clientes c ON c.id = f.id_cliente
      WHERE 1 = 1${rangoFacturasAlias.sql}
      ORDER BY f.id DESC LIMIT 6
    `, rangoFacturasAlias.params);

    return NextResponse.json({
      facturadoPeriodo: { n: (factPeriodo as any[])[0].n, monto: Number((factPeriodo as any[])[0].monto) },
      cobradoPeriodo:   { n: (cobPeriodo as any[])[0].n,  monto: Number((cobPeriodo as any[])[0].monto) },
      saldoPendiente: Math.round(saldoPendiente * 100) / 100,
      vencidas:  { n: vencidasN,  monto: Math.round(vencidasMonto * 100) / 100 },
      porVencer: { n: porVencerN, monto: Math.round(porVencerMonto * 100) / 100 },
      urgentes,
      ultimas,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
