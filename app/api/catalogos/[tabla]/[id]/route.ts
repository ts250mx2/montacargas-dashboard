import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { CATALOGOS, esCatalogoValido } from '@/lib/catalogos';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tabla: string; id: string }> }
) {
  const { tabla, id } = await params;
  if (!esCatalogoValido(tabla)) {
    return NextResponse.json({ message: 'Catálogo inválido' }, { status: 400 });
  }
  try {
    const body = await request.json();
    const columnas = [...CATALOGOS[tabla].columnas, 'activo'];
    const sets: string[] = [];
    const valores: any[] = [];
    for (const col of columnas) {
      if (body[col] !== undefined) {
        sets.push(`\`${col}\` = ?`);
        valores.push(body[col]);
      }
    }
    if (sets.length === 0) {
      return NextResponse.json({ message: 'Nada que actualizar' }, { status: 400 });
    }
    valores.push(id);
    await pool.query(`UPDATE \`${tabla}\` SET ${sets.join(', ')} WHERE id = ?`, valores);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tabla: string; id: string }> }
) {
  const { tabla, id } = await params;
  if (!esCatalogoValido(tabla)) {
    return NextResponse.json({ message: 'Catálogo inválido' }, { status: 400 });
  }
  try {
    await pool.query(`DELETE FROM \`${tabla}\` WHERE id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Si está referenciado, baja lógica
    await pool.query(`UPDATE \`${tabla}\` SET activo = 0 WHERE id = ?`, [id]);
    return NextResponse.json({ success: true, message: 'Registro en uso: se desactivó en lugar de eliminar' });
  }
}
