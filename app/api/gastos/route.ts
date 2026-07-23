import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { normalizarPartidas } from '@/lib/gastos';
import { guardarPartidas } from '@/lib/gastos-db';

const CONSULTA_GASTOS = `
  SELECT g.*,
         p.razon_social AS proveedor,
         c.nombre       AS categoria,
         fp.nombre      AS forma_pago,
         a.id           AS id_adjunto,
         a.nombre_original AS adjunto_nombre,
         a.extension    AS adjunto_extension
  FROM gastos g
  LEFT JOIN proveedores p      ON p.id = g.id_proveedor
  LEFT JOIN categorias_gasto c ON c.id = g.id_categoria
  LEFT JOIN formas_pago fp     ON fp.id = g.id_forma_pago
  LEFT JOIN (
    SELECT ga.* FROM gasto_adjuntos ga
    JOIN (SELECT id_gasto, MAX(id) AS ultimo FROM gasto_adjuntos GROUP BY id_gasto) u
      ON u.ultimo = ga.id
  ) a ON a.id_gasto = g.id
  ORDER BY g.fecha DESC, g.id DESC
`;

export async function GET() {
  try {
    const [gastos] = await pool.query(CONSULTA_GASTOS);

    // Las partidas van en una sola consulta y se agrupan aquí, para no hacer una por gasto
    const [partidas] = await pool.query(
      'SELECT id, id_gasto, clave, descripcion, cantidad, precio, importe FROM gasto_detalle ORDER BY id');
    const porGasto = new Map<number, any[]>();
    for (const partida of partidas as any[]) {
      const lista = porGasto.get(partida.id_gasto) ?? [];
      lista.push(partida);
      porGasto.set(partida.id_gasto, lista);
    }

    const gastosConPartidas = (gastos as any[]).map(g => ({
      ...g,
      partidas: porGasto.get(g.id) ?? [],
    }));

    const [proveedores] = await pool.query(
      'SELECT id, razon_social, rfc FROM proveedores WHERE activo = 1 ORDER BY razon_social');
    const [categorias] = await pool.query(
      'SELECT id, nombre FROM categorias_gasto WHERE activo = 1 ORDER BY nombre');
    const [formasPago] = await pool.query(
      'SELECT id, nombre FROM formas_pago WHERE activo = 1 ORDER BY nombre');

    return NextResponse.json({ gastos: gastosConPartidas, proveedores, categorias, formasPago });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

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

export async function POST(request: Request) {
  try {
    const b = await request.json();

    const concepto = String(b.concepto ?? '').trim();
    if (!concepto) return NextResponse.json({ message: 'El concepto es obligatorio' }, { status: 400 });

    const { subtotal, iva, total } = montos(b);
    if (total <= 0) return NextResponse.json({ message: 'El total debe ser mayor a cero' }, { status: 400 });

    const uuid = String(b.uuid_cfdi ?? '').trim().toUpperCase();

    // El UUID es único por comprobante: avisa antes de duplicar un gasto ya capturado
    if (uuid) {
      const [repetidos] = await pool.query(
        'SELECT id, folio, concepto FROM gastos WHERE uuid_cfdi = ? LIMIT 1', [uuid]);
      const repetido = (repetidos as any[])[0];
      if (repetido) {
        return NextResponse.json(
          { message: `Ese comprobante ya está registrado como gasto #${repetido.id} (${repetido.concepto})` },
          { status: 409 }
        );
      }
    }

    const [resultado] = await pool.query(
      `INSERT INTO gastos
        (fecha, folio, concepto, id_proveedor, id_categoria, id_forma_pago,
         subtotal, iva, total, uuid_cfdi, rfc_emisor, deducible, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.fecha || new Date().toISOString().slice(0, 10),
        String(b.folio ?? '').trim(),
        concepto,
        b.id_proveedor || null,
        b.id_categoria || null,
        b.id_forma_pago || null,
        subtotal, iva, total,
        uuid,
        String(b.rfc_emisor ?? '').trim().toUpperCase(),
        b.deducible === false || b.deducible === 0 ? 0 : 1,
        String(b.notas ?? '').slice(0, 300),
      ]
    );

    const idGasto = (resultado as any).insertId;

    // Las partidas son opcionales: solo desglosan el comprobante
    const partidas = normalizarPartidas(b.partidas);
    if (partidas.length > 0) await guardarPartidas(idGasto, partidas);

    return NextResponse.json({ success: true, id: idGasto, partidas: partidas.length });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
