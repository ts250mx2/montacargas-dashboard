import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query('SELECT * FROM clientes ORDER BY razon_social');
    return NextResponse.json({ clientes: rows });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json();
    if (!b.razon_social?.trim()) {
      return NextResponse.json({ message: 'La razón social es obligatoria' }, { status: 400 });
    }
    const [result] = await pool.query(
      `INSERT INTO clientes (razon_social, rfc, contacto, telefono, correo, domicilio, dias_credito, limite_credito, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.razon_social.trim(), b.rfc ?? '', b.contacto ?? '', b.telefono ?? '', b.correo ?? '',
        b.domicilio ?? '', b.dias_credito ?? 0, b.limite_credito ?? 0, b.activo ?? 1,
      ]
    );
    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
