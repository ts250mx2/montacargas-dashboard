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
      `UPDATE proveedores SET razon_social = ?, rfc = ?, contacto = ?, telefono = ?, correo = ?,
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
    const [productos] = await pool.query('SELECT COUNT(*) AS n FROM productos WHERE id_proveedor = ?', [id]);
    if ((productos as any[])[0].n > 0) {
      await pool.query('UPDATE proveedores SET activo = 0 WHERE id = ?', [id]);
      return NextResponse.json({ success: true, message: 'El proveedor tiene productos: se desactivó en lugar de eliminar' });
    }
    await pool.query('DELETE FROM proveedores WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
