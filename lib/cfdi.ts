/**
 * Lectura de CFDI. Todo el procesamiento es local: expresiones regulares y
 * validación aritmética, sin servicios externos ni IA.
 *
 * Estrategia, de más a menos confiable:
 *  0. El XML del CFDI, si viene embebido como adjunto del PDF: datos exactos.
 *  1. La URL de verificación del SAT (la del código QR) trae UUID, ambos RFC y el total.
 *  2. Etiquetas del comprobante ("Folio", "Fecha", "Subtotal"...).
 *  3. Filas de conceptos que además cuadran aritméticamente (cantidad × precio ≈ importe).
 */

export interface ConceptoCfdi {
  clave: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  importe: number;
}

export interface DatosCfdi {
  uuid: string;
  serie: string;
  folio: string;
  fecha: string;              // 'YYYY-MM-DD'
  rfcEmisor: string;
  rfcReceptor: string;
  nombreEmisor: string;
  nombreReceptor: string;
  subtotal: number | null;
  iva: number | null;
  total: number | null;
  formaPago: string;
  metodoPago: string;
  conceptos: ConceptoCfdi[];
  /** De dónde salieron los datos, para mostrarlo en la interfaz. */
  origen: 'xml' | 'qr' | 'texto' | 'ninguno';
}

const RE_UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const RE_RFC = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g;

/** Convierte "1,234.56" o "$ 1,234.56" a número. */
export function aNumero(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const limpio = texto.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!/\d/.test(limpio)) return null; // sin dígitos Number('') daría 0
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Normaliza para comparar descripciones y claves (sin acentos, ni signos, ni dobles espacios). */
export const normalizar = (texto: string): string =>
  texto
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Fecha de cualquier formato común del CFDI a 'YYYY-MM-DD'. */
function extraerFecha(texto: string): string {
  // Fecha de emisión ISO: 2026-07-15T10:23:45
  const iso = texto.match(/\b(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Etiquetada: "Fecha de emisión: 15/07/2026"
  const etiquetada = texto.match(
    /fecha(?:\s+(?:de\s+)?(?:emisi[oó]n|expedici[oó]n|factura))?\s*[:\s]\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i);
  if (etiquetada) {
    const [, d, m, a] = etiquetada;
    return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // ISO suelta
  const soloIso = texto.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (soloIso) return `${soloIso[1]}-${soloIso[2]}-${soloIso[3]}`;

  return '';
}

/**
 * Valor numérico que sigue a una etiqueta ("Subtotal: $1,234.56").
 * Admite una tasa intermedia, como en "IVA 16%: $769.60".
 */
function montoTrasEtiqueta(texto: string, etiqueta: RegExp): number | null {
  const tasa = '(?:\\s*\\d{1,2}(?:\\.\\d+)?\\s*%)?';
  const re = new RegExp(`${etiqueta.source}${tasa}[^\\d\\-]{0,40}(-?[\\d,]+\\.\\d{2})`, 'i');
  return aNumero(texto.match(re)?.[1]);
}

/** Texto que sigue a una etiqueta, hasta el fin de línea. */
function textoTrasEtiqueta(texto: string, etiqueta: RegExp): string {
  const re = new RegExp(`${etiqueta.source}\\s*[:\\s]\\s*([^\\n]{1,80})`, 'i');
  return (texto.match(re)?.[1] ?? '').trim();
}

/**
 * Datos de la URL de verificación del SAT, que suele venir junto al QR:
 * ...?id=<uuid>&re=<rfc emisor>&rr=<rfc receptor>&tt=<total>&fe=<sello>
 */
function leerUrlSat(texto: string) {
  const url = texto.match(/[?&]id=([0-9A-F-]{36})[^\s]*/i);
  if (!url) return null;
  const crudo = url[0];
  const parametro = (nombre: string) =>
    crudo.match(new RegExp(`[?&]${nombre}=([^&\\s]*)`, 'i'))?.[1] ?? '';
  return {
    uuid: parametro('id').toUpperCase(),
    rfcEmisor: decodeURIComponent(parametro('re')).toUpperCase(),
    rfcReceptor: decodeURIComponent(parametro('rr')).toUpperCase(),
    total: aNumero(decodeURIComponent(parametro('tt'))),
  };
}

const RUIDO_CONCEPTO = /^(sub\s?total|total|iva|impuest|descuento|traslad|reten|importe con letra|forma de pago|m[eé]todo)/i;

/**
 * Filas de conceptos. Se acepta una fila solo si la aritmética cuadra
 * (cantidad × precio ≈ importe), lo que descarta totales y encabezados.
 */
export function extraerConceptos(lineas: string[]): ConceptoCfdi[] {
  const conceptos: ConceptoCfdi[] = [];

  for (const linea of lineas) {
    const limpia = linea.replace(/\s+/g, ' ').trim();
    if (limpia.length < 8 || RUIDO_CONCEPTO.test(limpia)) continue;

    // Los dos últimos importes de la fila son valor unitario e importe
    const montos = limpia.match(/-?\$?\s*[\d,]+\.\d{2}/g);
    if (!montos || montos.length < 2) continue;

    const importe = aNumero(montos[montos.length - 1]);
    const precio = aNumero(montos[montos.length - 2]);
    if (importe === null || precio === null || precio <= 0 || importe <= 0) continue;

    // El inicio de la fila es ambiguo: la clave puede ser numérica (SKU "32") y
    // confundirse con la cantidad. Se prueban las dos lecturas y gana la que cuadre.
    const conClave = limpia.match(/^(\S+)\s+(\d+(?:[.,]\d+)?)\s+(.+)$/);
    const sinClave = limpia.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);

    const candidatos = [
      conClave && { clave: conClave[1], cantidad: aNumero(conClave[2]), resto: conClave[3] },
      sinClave && { clave: '', cantidad: aNumero(sinClave[1]), resto: sinClave[2] },
    ];

    // Validación aritmética: es lo que distingue una partida real de una fila cualquiera
    const tolerancia = (cantidad: number) => Math.max(0.02, cantidad * precio * 0.01);
    const elegido = candidatos.find((c): c is { clave: string; cantidad: number; resto: string } =>
      Boolean(c) && c!.cantidad !== null && c!.cantidad > 0 &&
      Math.abs(c!.cantidad! * precio - importe) <= tolerancia(c!.cantidad!));

    if (!elegido) continue;

    // La descripción es lo que queda entre la cantidad y los montos finales
    const descripcion = elegido.resto
      .replace(/-?\$?\s*[\d,]+\.\d{2}/g, ' ')
      .replace(/\b(pieza|piezas|pza|pzas|unidad|kg|lt|mt|h87|e48|act)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (descripcion.length < 3) continue;

    conceptos.push({ clave: elegido.clave, descripcion, cantidad: elegido.cantidad, precio, importe });
  }

  return conceptos;
}

/** Lee un CFDI a partir del texto plano del PDF (una línea por renglón visual). */
export function extraerCfdi(texto: string): DatosCfdi {
  const lineas = texto.split('\n');
  const plano = texto.replace(/[ \t]+/g, ' ');

  const sat = leerUrlSat(plano);

  // UUID: primero el del QR, si no el "Folio Fiscal" del cuerpo
  const uuid = (sat?.uuid || plano.match(RE_UUID)?.[0] || '').toUpperCase();

  // RFC: los del QR son fiables; si no, se toman por orden de aparición
  let rfcEmisor = sat?.rfcEmisor ?? '';
  let rfcReceptor = sat?.rfcReceptor ?? '';
  if (!rfcEmisor || !rfcReceptor) {
    const encontrados = [...new Set(plano.toUpperCase().match(RE_RFC) ?? [])];
    rfcEmisor = rfcEmisor || encontrados[0] || '';
    rfcReceptor = rfcReceptor || encontrados.find(r => r !== rfcEmisor) || '';
  }

  const totalEtiqueta = montoTrasEtiqueta(plano, /\btotal\b/);
  const total = sat?.total ?? totalEtiqueta;

  return {
    uuid,
    serie: textoTrasEtiqueta(plano, /\bserie\b/).split(/\s/)[0] ?? '',
    folio: (textoTrasEtiqueta(plano, /\bfolio(?!\s*fiscal)\b/).match(/[A-Za-z0-9\-]{1,20}/)?.[0] ?? ''),
    fecha: extraerFecha(plano),
    rfcEmisor,
    rfcReceptor,
    nombreEmisor: textoTrasEtiqueta(plano, /(?:nombre|raz[oó]n social)(?:\s+del?\s+emisor)?/),
    nombreReceptor: textoTrasEtiqueta(plano, /(?:nombre|raz[oó]n social)\s+del?\s+receptor/),
    subtotal: montoTrasEtiqueta(plano, /sub\s?total/),
    iva: montoTrasEtiqueta(plano, /\b(?:iva|impuestos?\s+trasladados?)\b/),
    total,
    formaPago: textoTrasEtiqueta(plano, /forma\s+de\s+pago/),
    metodoPago: textoTrasEtiqueta(plano, /m[eé]todo\s+de\s+pago/),
    conceptos: extraerConceptos(lineas),
    origen: sat ? 'qr' : uuid || rfcEmisor || total !== null ? 'texto' : 'ninguno',
  };
}

/* ═══════════════════════════════════════════
   CFDI desde el XML embebido (fuente exacta)
   ═══════════════════════════════════════════ */

/** Valor de un atributo XML, sin importar el prefijo de espacio de nombres. */
const atributo = (fragmento: string, nombre: string): string => {
  const m = fragmento.match(new RegExp(`\\b${nombre}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? desescaparXml(m[1]) : '';
};

const desescaparXml = (texto: string): string =>
  texto
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** Primera etiqueta cuyo nombre local coincide (ignora el prefijo cfdi:, tfd:, etc.). */
const etiqueta = (xml: string, local: string): string =>
  xml.match(new RegExp(`<[a-z0-9]*:?${local}\\b[^>]*>`, 'i'))?.[0] ?? '';

/** Lee un CFDI desde su XML. Devuelve null si el XML no es un comprobante. */
export function extraerCfdiDeXml(xml: string): DatosCfdi | null {
  const comprobante = etiqueta(xml, 'Comprobante');
  if (!comprobante) return null;

  const emisor = etiqueta(xml, 'Emisor');
  const receptor = etiqueta(xml, 'Receptor');
  const timbre = etiqueta(xml, 'TimbreFiscalDigital');

  const conceptos: ConceptoCfdi[] = [];
  for (const nodo of xml.match(/<[a-z0-9]*:?Concepto\b[^>]*>/gi) ?? []) {
    const cantidad = aNumero(atributo(nodo, 'Cantidad'));
    const precio = aNumero(atributo(nodo, 'ValorUnitario'));
    const importe = aNumero(atributo(nodo, 'Importe'));
    const descripcion = atributo(nodo, 'Descripcion');
    if (cantidad === null || precio === null || importe === null || !descripcion) continue;
    conceptos.push({
      clave: atributo(nodo, 'NoIdentificacion'),
      descripcion,
      cantidad,
      precio,
      importe,
    });
  }

  const total = aNumero(atributo(comprobante, 'Total'));
  const subtotal = aNumero(atributo(comprobante, 'SubTotal'));

  // El IVA no es un atributo del comprobante: se toma del nodo de traslados
  const traslados = xml.match(/<[a-z0-9]*:?Traslado\b[^>]*>/gi) ?? [];
  const ivaTrasladado = traslados
    .filter(t => atributo(t, 'Impuesto') === '002')
    .reduce((suma, t) => suma + (aNumero(atributo(t, 'Importe')) ?? 0), 0);
  const iva = ivaTrasladado > 0
    ? Math.round(ivaTrasladado * 100) / 100
    : total !== null && subtotal !== null ? Math.round((total - subtotal) * 100) / 100 : null;

  return {
    uuid: atributo(timbre, 'UUID').toUpperCase(),
    serie: atributo(comprobante, 'Serie'),
    folio: atributo(comprobante, 'Folio'),
    fecha: atributo(comprobante, 'Fecha').slice(0, 10),
    rfcEmisor: atributo(emisor, 'Rfc').toUpperCase(),
    rfcReceptor: atributo(receptor, 'Rfc').toUpperCase(),
    nombreEmisor: atributo(emisor, 'Nombre'),
    nombreReceptor: atributo(receptor, 'Nombre'),
    subtotal,
    iva,
    total,
    formaPago: atributo(comprobante, 'FormaPago'),
    metodoPago: atributo(comprobante, 'MetodoPago'),
    conceptos,
    origen: 'xml',
  };
}

/** Punto de entrada: prefiere el XML embebido y cae al texto del PDF. */
export function leerCfdi(texto: string, xml: string | null): DatosCfdi {
  if (xml) {
    const desdeXml = extraerCfdiDeXml(xml);
    if (desdeXml) return desdeXml;
  }
  return extraerCfdi(texto);
}
