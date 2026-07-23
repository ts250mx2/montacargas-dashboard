import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  borrarArchivo, generarNombreArchivo, guardarArchivo, leerArchivo,
  leerComprobanteDeFormulario, TIPO_MIME, type Extension,
} from '@/lib/adjuntos';

type Contexto = { params: Promise<{ id: string }> };

async function adjuntoDe(idGasto: string) {
  const [filas] = await pool.query(
    'SELECT * FROM gasto_adjuntos WHERE id_gasto = ? ORDER BY id DESC LIMIT 1', [idGasto]);
  return (filas as any[])[0] ?? null;
}

/** Descarga el comprobante (protegido por la sesión, como el resto de la API). */
export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  try {
    const adjunto = await adjuntoDe(id);
    if (!adjunto) return NextResponse.json({ message: 'El gasto no tiene comprobante' }, { status: 404 });

    const contenido = await leerArchivo('gastos', adjunto.archivo);
    return new NextResponse(new Uint8Array(contenido), {
      headers: {
        'Content-Type': TIPO_MIME[adjunto.extension as Extension] ?? 'application/octet-stream',
        'Content-Length': String(contenido.length),
        // El nombre va entre comillas y sin caracteres de control para no romper la cabecera
        'Content-Disposition':
          `inline; filename="${adjunto.nombre_original.replace(/["\r\n]/g, '')}"`,
      },
    });
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ message: 'El archivo ya no está en el almacén' }, { status: 404 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

/** Adjunta (o reemplaza) el comprobante del gasto. */
export async function POST(request: Request, { params }: Contexto) {
  const { id } = await params;
  try {
    const [gastos] = await pool.query('SELECT id FROM gastos WHERE id = ?', [id]);
    if ((gastos as any[]).length === 0) {
      return NextResponse.json({ message: 'Gasto no encontrado' }, { status: 404 });
    }

    const { datos, nombreOriginal, extension } =
      await leerComprobanteDeFormulario(await request.formData());

    const anterior = await adjuntoDe(id);
    const nombre = generarNombreArchivo(id, extension);
    await guardarArchivo('gastos', nombre, datos);

    try {
      await pool.query(
        `INSERT INTO gasto_adjuntos (id_gasto, nombre_original, archivo, extension, tamano)
         VALUES (?, ?, ?, ?, ?)`,
        [id, nombreOriginal, nombre, extension, datos.length]
      );
    } catch (error) {
      // Sin registro en la base el archivo sería inalcanzable: no se deja tirado
      await borrarArchivo('gastos', nombre);
      throw error;
    }

    // Se reemplaza: primero se registra el nuevo, luego se retira el viejo
    if (anterior) {
      await pool.query('DELETE FROM gasto_adjuntos WHERE id = ?', [anterior.id]);
      await borrarArchivo('gastos', anterior.archivo);
    }

    return NextResponse.json({ success: true, nombre_original: nombreOriginal, extension });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const { id } = await params;
  try {
    const adjunto = await adjuntoDe(id);
    if (!adjunto) return NextResponse.json({ message: 'El gasto no tiene comprobante' }, { status: 404 });

    await pool.query('DELETE FROM gasto_adjuntos WHERE id = ?', [adjunto.id]);
    await borrarArchivo('gastos', adjunto.archivo);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
