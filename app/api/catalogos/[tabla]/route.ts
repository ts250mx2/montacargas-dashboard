import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { CATALOGOS, esCatalogoValido } from '@/lib/catalogos';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tabla: string }> }
) {
  const { tabla } = await params;
  if (!esCatalogoValido(tabla)) {
    return NextResponse.json({ message: 'Catálogo inválido' }, { status: 400 });
  }
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${tabla}\` ORDER BY nombre`);
    return NextResponse.json({ rows });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tabla: string }> }
) {
  const { tabla } = await params;
  if (!esCatalogoValido(tabla)) {
    return NextResponse.json({ message: 'Catálogo inválido' }, { status: 400 });
  }
  try {
    const body = await request.json();
    const columnas = CATALOGOS[tabla].columnas;
    if (!body.nombre || !String(body.nombre).trim()) {
      return NextResponse.json({ message: 'El nombre es obligatorio' }, { status: 400 });
    }
    const valores = columnas.map(c => body[c] ?? '');
    const [result] = await pool.query(
      `INSERT INTO \`${tabla}\` (${columnas.map(c => `\`${c}\``).join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
      valores
    );
    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
