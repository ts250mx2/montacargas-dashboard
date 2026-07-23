/**
 * Extracción del texto de un PDF, del lado del servidor.
 *
 * pdf.js entrega fragmentos sueltos con su posición; aquí se reagrupan por
 * renglón (coordenada Y) para reconstruir las filas visuales, que es lo que
 * necesita el lector de CFDI para identificar las partidas.
 */

interface FragmentoTexto {
  str: string;
  transform: number[];
}

/** Tolerancia vertical, en puntos, para considerar que dos fragmentos van en el mismo renglón. */
const TOLERANCIA_RENGLON = 3;

/** Separación horizontal mínima, en puntos, para insertar un espacio entre fragmentos. */
const SEPARACION_ESPACIO = 1;

export interface ContenidoPdf {
  texto: string;
  /** XML del CFDI si venía embebido como adjunto del PDF. */
  xml: string | null;
}

export async function leerPdf(datos: Uint8Array): Promise<ContenidoPdf> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // pdf.js se apropia del buffer y lo deja desacoplado, así que recibe una copia:
  // quien llame puede seguir usando `datos` (por ejemplo, para guardar el archivo)
  const copia = new Uint8Array(datos);

  // Sin worker: en Node el proceso principal hace todo el trabajo
  const tarea = pdfjs.getDocument({
    data: copia,
    useWorkerFetch: false,
    useSystemFonts: false,
  });

  const documento = await tarea.promise;
  const paginas: string[] = [];

  try {
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n);
      const contenido = await pagina.getTextContent();
      paginas.push(reconstruirRenglones(contenido.items as FragmentoTexto[]));
    }
    return { texto: paginas.join('\n'), xml: await buscarXmlAdjunto(documento) };
  } finally {
    await tarea.destroy();
  }
}

/** Lo que necesitamos del documento de pdf.js para buscar adjuntos. */
interface DocumentoConAdjuntos {
  getAttachments: () => Promise<Map<string, { filename: string; content?: Uint8Array | null }> | null>;
  getAttachmentContent: (id: string) => Promise<Uint8Array | null>;
}

/** Muchos CFDI traen su XML embebido en el PDF: es la fuente más confiable. */
async function buscarXmlAdjunto(documento: DocumentoConAdjuntos): Promise<string | null> {
  let adjuntos;
  try {
    adjuntos = await documento.getAttachments();
  } catch {
    return null; // un PDF sin adjuntos no es un error
  }
  if (!adjuntos) return null;

  const decodificador = new TextDecoder('utf-8');

  for (const [id, adjunto] of adjuntos) {
    if (adjunto.filename && !/\.xml$/i.test(adjunto.filename)) continue;

    // El contenido puede venir ya cargado o pedirse aparte
    let contenido = adjunto.content ?? null;
    if (!contenido) {
      try {
        contenido = await documento.getAttachmentContent(id);
      } catch {
        continue;
      }
    }
    if (!contenido) continue;

    const texto = decodificador.decode(contenido);
    if (/<[a-z0-9]*:?Comprobante\b/i.test(texto)) return texto;
  }
  return null;
}

/** Agrupa los fragmentos por coordenada Y y los ordena por X dentro de cada renglón. */
function reconstruirRenglones(items: FragmentoTexto[]): string {
  const renglones: { y: number; piezas: { x: number; texto: string }[] }[] = [];

  for (const item of items) {
    if (!item.str || !item.transform) continue;
    const x = item.transform[4];
    const y = item.transform[5];

    let renglon = renglones.find(r => Math.abs(r.y - y) <= TOLERANCIA_RENGLON);
    if (!renglon) {
      renglon = { y, piezas: [] };
      renglones.push(renglon);
    }
    renglon.piezas.push({ x, texto: item.str });
  }

  renglones.sort((a, b) => b.y - a.y); // de arriba hacia abajo

  return renglones
    .map(renglon => {
      renglon.piezas.sort((a, b) => a.x - b.x);
      return renglon.piezas
        .reduce((acumulado, pieza, i) => {
          if (i === 0) return pieza.texto;
          const anterior = renglon.piezas[i - 1];
          const hueco = pieza.x - (anterior.x + anterior.texto.length * SEPARACION_ESPACIO);
          const necesitaEspacio = hueco > 0 || /\S$/.test(acumulado) && /^\S/.test(pieza.texto);
          return acumulado + (necesitaEspacio ? ' ' : '') + pieza.texto;
        }, '')
        .replace(/\s+/g, ' ')
        .trim();
    })
    .filter(Boolean)
    .join('\n');
}
