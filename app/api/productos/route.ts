import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [productos] = await pool.query(`
      SELECT p.*,
             m.nombre  AS marca,
             l.nombre  AS linea,
             u.nombre  AS unidad,
             u.abreviatura AS unidad_abrev,
             pr.razon_social AS proveedor
      FROM productos p
      LEFT JOIN marcas m       ON m.id = p.id_marca
      LEFT JOIN lineas l       ON l.id = p.id_linea
      LEFT JOIN unidades u     ON u.id = p.id_unidad
      LEFT JOIN proveedores pr ON pr.id = p.id_proveedor
      ORDER BY p.descripcion
    `);
    const [marcas]      = await pool.query('SELECT id, nombre FROM marcas WHERE activo = 1 ORDER BY nombre');
    const [lineas]      = await pool.query('SELECT id, nombre FROM lineas WHERE activo = 1 ORDER BY nombre');
    const [unidades]    = await pool.query('SELECT id, nombre, abreviatura FROM unidades WHERE activo = 1 ORDER BY nombre');
    const [proveedores] = await pool.query('SELECT id, razon_social FROM proveedores WHERE activo = 1 ORDER BY razon_social');
    return NextResponse.json({ productos, marcas, lineas, unidades, proveedores });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json();
    if (!b.sku?.trim() || !b.descripcion?.trim()) {
      return NextResponse.json({ message: 'SKU y descripción son obligatorios' }, { status: 400 });
    }
    const [result] = await pool.query(
      `INSERT INTO productos (sku, descripcion, id_marca, id_linea, id_unidad, id_proveedor, costo, precio, stock, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.sku.trim(), b.descripcion.trim(),
        b.id_marca || null, b.id_linea || null, b.id_unidad || null, b.id_proveedor || null,
        b.costo ?? 0, b.precio ?? 0, b.stock ?? 0, b.activo ?? 1,
      ]
    );
    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ message: 'Ya existe un producto con ese SKU' }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
