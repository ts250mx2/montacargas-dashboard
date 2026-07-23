import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { leerComprobanteDeFormulario } from '@/lib/adjuntos';
import { leerPdf } from '@/lib/pdf-texto';
import { leerCfdi } from '@/lib/cfdi';
import { empatarConceptos, empatarEntidad } from '@/lib/empatar-cfdi';

/**
 * Lee un PDF y devuelve los datos detectados. No guarda nada:
 * el archivo se adjunta después, cuando la factura ya existe.
 */
export async function POST(request: Request) {
  try {
    const { datos, nombreOriginal } = await leerComprobanteDeFormulario(await request.formData(), ['pdf']);

    let contenido;
    try {
      contenido = await leerPdf(datos);
    } catch (error: any) {
      // El detalle técnico se queda en el log del servidor, no viaja al navegador
      console.error('Error al leer el PDF:', error);
      return NextResponse.json(
        { message: 'No se pudo leer el PDF. Puede estar dañado o protegido con contraseña.' },
        { status: 400 }
      );
    }

    const cfdi = leerCfdi(contenido.texto, contenido.xml);

    // Un PDF escaneado no tiene capa de texto: conviene decirlo en vez de devolver todo vacío
    if (cfdi.origen === 'ninguno' && contenido.texto.trim().length < 20) {
      return NextResponse.json({
        nombreOriginal,
        cfdi,
        cliente: null,
        conceptos: [],
        aviso: 'El PDF no contiene texto legible (parece escaneado); captura los datos a mano.',
      });
    }

    const [clientes] = await pool.query(
      'SELECT id, razon_social, rfc, dias_credito FROM clientes WHERE activo = 1');
    const [productos] = await pool.query(
      'SELECT id, sku, descripcion, precio FROM productos WHERE activo = 1');

    // El comprobante puede ser emitido o recibido: se prueban los dos RFC
    const empate = empatarEntidad(
      [cfdi.rfcReceptor, cfdi.rfcEmisor],
      [cfdi.nombreReceptor, cfdi.nombreEmisor],
      clientes as any[]
    );

    return NextResponse.json({
      nombreOriginal,
      cfdi,
      cliente: empate ? { ...empate.entidad, rfcEmpatado: empate.rfc } : null,
      conceptos: empatarConceptos(cfdi.conceptos, productos as any[]),
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
