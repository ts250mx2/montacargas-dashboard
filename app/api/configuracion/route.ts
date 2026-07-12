import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query('SELECT * FROM configuracion WHERE id = 1');
    const config = (rows as any[])[0] || null;
    return NextResponse.json({ config });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const b = await request.json();
    await pool.query(
      `UPDATE configuracion SET nombre_empresa = ?, rfc = ?, domicilio = ?, telefono = ?, correo = ?,
       iva_porcentaje = ?, dias_alerta = ?, serie_folio = ? WHERE id = 1`,
      [
        b.nombre_empresa ?? '', b.rfc ?? '', b.domicilio ?? '', b.telefono ?? '', b.correo ?? '',
        b.iva_porcentaje ?? 16, b.dias_alerta ?? 7, b.serie_folio ?? 'F',
      ]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
