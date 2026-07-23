import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  borrarArchivo, generarNombreArchivo, guardarArchivo, leerArchivo, leerComprobanteDeFormulario,
} from '@/lib/adjuntos';
import { leerPdf } from '@/lib/pdf-texto';
import { leerCfdi } from '@/lib/cfdi';

type Contexto = { params: Promise<{ id: string }> };

async function adjuntoDe(idFactura: string) {
  const [filas] = await pool.query(
    'SELECT * FROM factura_adjuntos WHERE id_factura = ? ORDER BY id DESC LIMIT 1', [idFactura]);
  return (filas as any[])[0] ?? null;
}

/** Descarga el PDF adjunto (protegido por la sesión, como el resto de la API). */
export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  try {
    const adjunto = await adjuntoDe(id);
    if (!adjunto) return NextResponse.json({ message: 'La factura no tiene PDF adjunto' }, { status: 404 });

    const contenido = await leerArchivo('facturas', adjunto.archivo);
    return new NextResponse(new Uint8Array(contenido), {
      headers: {
        'Content-Type': 'application/pdf',
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

/** Adjunta (o reemplaza) el PDF de la factura. */
export async function POST(request: Request, { params }: Contexto) {
  const { id } = await params;
  try {
    const [facturas] = await pool.query('SELECT id FROM facturas WHERE id = ?', [id]);
    if ((facturas as any[]).length === 0) {
      return NextResponse.json({ message: 'Factura no encontrada' }, { status: 404 });
    }

    const { datos, nombreOriginal } = await leerComprobanteDeFormulario(await request.formData(), ['pdf']);

    // El UUID se guarda como referencia fiscal; que no se pueda leer no impide adjuntar
    let uuid = '';
    try {
      const contenido = await leerPdf(datos);
      uuid = leerCfdi(contenido.texto, contenido.xml).uuid;
    } catch { /* el PDF se adjunta igual */ }

    const anterior = await adjuntoDe(id);
    const nombre = generarNombreArchivo(id, 'pdf');
    await guardarArchivo('facturas', nombre, datos);

    try {
      await pool.query(
        `INSERT INTO factura_adjuntos (id_factura, nombre_original, archivo, tamano, uuid_cfdi)
         VALUES (?, ?, ?, ?, ?)`,
        [id, nombreOriginal, nombre, datos.length, uuid]
      );
    } catch (error) {
      // Sin registro en la base el archivo sería inalcanzable: no se deja tirado
      await borrarArchivo('facturas', nombre);
      throw error;
    }

    // Se reemplaza: primero se registra el nuevo, luego se retira el viejo
    if (anterior) {
      await pool.query('DELETE FROM factura_adjuntos WHERE id = ?', [anterior.id]);
      await borrarArchivo('facturas', anterior.archivo);
    }

    return NextResponse.json({ success: true, nombre_original: nombreOriginal, uuid_cfdi: uuid });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const { id } = await params;
  try {
    const adjunto = await adjuntoDe(id);
    if (!adjunto) return NextResponse.json({ message: 'La factura no tiene PDF adjunto' }, { status: 404 });

    await pool.query('DELETE FROM factura_adjuntos WHERE id = ?', [adjunto.id]);
    await borrarArchivo('facturas', adjunto.archivo);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
