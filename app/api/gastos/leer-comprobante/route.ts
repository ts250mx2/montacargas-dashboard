import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { leerComprobanteDeFormulario } from '@/lib/adjuntos';
import { leerPdf } from '@/lib/pdf-texto';
import { leerCfdi, extraerCfdiDeXml, type DatosCfdi } from '@/lib/cfdi';
import { empatarEntidad } from '@/lib/empatar-cfdi';

/**
 * Lee un comprobante (PDF o XML) y devuelve los datos detectados para
 * prellenar el gasto. No guarda nada: el archivo se adjunta después.
 */
export async function POST(request: Request) {
  try {
    const { datos, nombreOriginal, extension } =
      await leerComprobanteDeFormulario(await request.formData());

    let cfdi: DatosCfdi | null = null;

    if (extension === 'xml') {
      cfdi = extraerCfdiDeXml(new TextDecoder('utf-8').decode(datos));
      if (!cfdi) {
        return NextResponse.json(
          { message: 'El XML no es un CFDI: no se encontró el nodo Comprobante.' },
          { status: 400 }
        );
      }
    } else {
      let contenido;
      try {
        contenido = await leerPdf(datos);
      } catch (error) {
        console.error('Error al leer el PDF del gasto:', error);
        return NextResponse.json(
          { message: 'No se pudo leer el PDF. Puede estar dañado o protegido con contraseña.' },
          { status: 400 }
        );
      }
      cfdi = leerCfdi(contenido.texto, contenido.xml);

      if (cfdi.origen === 'ninguno' && contenido.texto.trim().length < 20) {
        return NextResponse.json({
          nombreOriginal, extension, cfdi, proveedor: null, duplicado: null,
          aviso: 'El PDF no contiene texto legible (parece escaneado); captura los datos a mano.',
        });
      }
    }

    // En un gasto el comprobante lo emite el proveedor: se prueba primero su RFC
    const [proveedores] = await pool.query(
      'SELECT id, razon_social, rfc FROM proveedores WHERE activo = 1');
    const empate = empatarEntidad(
      [cfdi.rfcEmisor, cfdi.rfcReceptor],
      [cfdi.nombreEmisor, cfdi.nombreReceptor],
      proveedores as any[]
    );

    // Avisar de un comprobante ya capturado evita duplicar el gasto
    let duplicado = null;
    if (cfdi.uuid) {
      const [repetidos] = await pool.query(
        'SELECT id, fecha, concepto, total FROM gastos WHERE uuid_cfdi = ? LIMIT 1', [cfdi.uuid]);
      duplicado = (repetidos as any[])[0] ?? null;
    }

    return NextResponse.json({
      nombreOriginal,
      extension,
      cfdi,
      proveedor: empate ? { ...empate.entidad, rfcEmpatado: empate.rfc } : null,
      duplicado,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
