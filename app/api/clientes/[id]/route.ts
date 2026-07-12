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
      `UPDATE clientes SET razon_social = ?, rfc = ?, contacto = ?, telefono = ?, correo = ?,
       domicilio = ?, dias_credito = ?, limite_credito = ?, activo = ? WHERE id = ?`,
      [
        b.razon_social, b.rfc ?? '', b.contacto ?? '', b.telefono ?? '', b.correo ?? '',
        b.domicilio ?? '', b.dias_credito ?? 0, b.limite_credito ?? 0, b.activo ?? 1, id,
      ]
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
    const [facturas] = await pool.query('SELECT COUNT(*) AS n FROM facturas WHERE id_cliente = ?', [id]);
    if ((facturas as any[])[0].n > 0) {
      await pool.query('UPDATE clientes SET activo = 0 WHERE id = ?', [id]);
      return NextResponse.json({ success: true, message: 'El cliente tiene facturas: se desactivó en lugar de eliminar' });
    }
    await pool.query('DELETE FROM clientes WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
