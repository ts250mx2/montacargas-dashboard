/**
 * Exportación de vistas: PDF (captura fiel de la pantalla) y Excel con formato.
 * Las librerías pesadas se cargan bajo demanda, al momento de exportar.
 */

import { soloFecha } from './periodos';

export const EMPRESA = 'Montacargas y Servicios MR';

/** Marca los elementos que no deben aparecer en el PDF (botones, acciones...). */
export const ATRIBUTO_OCULTAR = 'data-export-ocultar';

/* ─── Paleta corporativa aplicada a los reportes ─── */
const TINTA          = 'FF17181C';
const AMARILLO       = 'FFF2CF0A';
const AMARILLO_SUAVE = 'FFFDF6D8';
const BANDA          = 'FFF8F8F4';
const BORDE          = 'FFDCDCD5';
const TENUE          = 'FF6F7178';

const selloFecha = (): string =>
  new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

const nombreArchivo = (base: string, extension: string): string =>
  `${base}-${soloFecha(new Date())}.${extension}`;

function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════
   EXCEL
   ═══════════════════════════════════════════ */

export type TipoColumna = 'texto' | 'numero' | 'moneda' | 'porcentaje' | 'fecha';

export interface ColumnaExcel<T> {
  titulo: string;
  /** Determina formato numérico y alineación. Por defecto 'texto'. */
  tipo?: TipoColumna;
  /** Valor crudo de la celda. */
  valor: (fila: T) => string | number | null | undefined;
  /** Incluir la columna en la fila de totales. */
  total?: boolean;
}

export interface ExcelOpciones<T> {
  /** Nombre del archivo, sin extensión ni fecha. */
  archivo: string;
  hoja: string;
  titulo: string;
  subtitulo?: string;
  columnas: ColumnaExcel<T>[];
  filas: readonly T[];
}

const FORMATOS: Record<TipoColumna, string> = {
  texto:       '@',
  numero:      '#,##0',
  moneda:      '"$"#,##0.00',
  porcentaje:  '0.0"%"',
  fecha:       'dd/mmm/yyyy',
};

const ALINEACION: Record<TipoColumna, 'left' | 'right' | 'center'> = {
  texto: 'left', numero: 'right', moneda: 'right', porcentaje: 'right', fecha: 'center',
};

const esNumerico = (tipo: TipoColumna): boolean =>
  tipo === 'numero' || tipo === 'moneda' || tipo === 'porcentaje';

/** Convierte el valor crudo al tipo que Excel debe almacenar. */
function valorCelda(bruto: unknown, tipo: TipoColumna): string | number | Date | null {
  if (bruto === null || bruto === undefined || bruto === '') return null;

  if (tipo === 'fecha') {
    // En UTC: Excel guarda el instante tal cual, y la medianoche local se correría de día
    const [anio, mes, dia] = String(bruto).slice(0, 10).split('-').map(Number);
    if (!anio || !mes || !dia) return String(bruto);
    return new Date(Date.UTC(anio, mes - 1, dia));
  }

  if (esNumerico(tipo)) {
    const n = Number(bruto);
    return Number.isFinite(n) ? n : null;
  }

  return String(bruto);
}

/** Longitud aproximada del texto ya formateado, para calcular el ancho de columna. */
function largoAproximado(bruto: unknown, tipo: TipoColumna): number {
  if (bruto === null || bruto === undefined || bruto === '') return 0;
  if (tipo === 'fecha') return 11;
  if (tipo === 'moneda') return Number(bruto).toLocaleString('es-MX', { minimumFractionDigits: 2 }).length + 1;
  if (tipo === 'numero') return Number(bruto).toLocaleString('es-MX').length;
  if (tipo === 'porcentaje') return 7;
  return String(bruto).length;
}

const bordeFino = { style: 'thin' as const, color: { argb: BORDE } };

/** Arma el libro y devuelve el binario .xlsx. Separado de la descarga para poder probarlo. */
export async function construirLibroExcel<T>(opciones: ExcelOpciones<T>): Promise<ArrayBuffer> {
  const { hoja, titulo, subtitulo, columnas, filas } = opciones;

  if (filas.length === 0) throw new Error('No hay registros que exportar con los filtros actuales');

  // El bundle de navegador es UMD: según el empaquetador las clases quedan en la raíz o en `default`
  const modulo = await import('exceljs');
  const ExcelJS = ('Workbook' in modulo
    ? modulo
    : (modulo as unknown as { default: typeof import('exceljs') }).default);

  const libro = new ExcelJS.Workbook();
  libro.creator = EMPRESA;
  libro.created = new Date();

  const nCols = columnas.length;
  const FILA_ENCABEZADO = 4;
  const PRIMERA_FILA = FILA_ENCABEZADO + 1;

  const ws = libro.addWorksheet(hoja, {
    views: [{ state: 'frozen', ySplit: FILA_ENCABEZADO }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${FILA_ENCABEZADO}:${FILA_ENCABEZADO}`,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  // ─── Título ───
  ws.mergeCells(1, 1, 1, nCols);
  const celdaTitulo = ws.getCell(1, 1);
  celdaTitulo.value = titulo.toUpperCase();
  celdaTitulo.font = { name: 'Calibri', size: 16, bold: true, color: { argb: AMARILLO } };
  celdaTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTA } };
  celdaTitulo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  // ─── Subtítulo y sello de generación ───
  ws.mergeCells(2, 1, 2, nCols);
  const celdaSub = ws.getCell(2, 1);
  celdaSub.value = [subtitulo, EMPRESA, `Generado el ${selloFecha()}`]
    .filter(Boolean).join('   ·   ');
  celdaSub.font = { name: 'Calibri', size: 9, italic: true, color: { argb: TENUE } };
  celdaSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO_SUAVE } };
  celdaSub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 6;

  // ─── Encabezados ───
  const filaEncabezado = ws.getRow(FILA_ENCABEZADO);
  filaEncabezado.height = 24;
  columnas.forEach((col, i) => {
    const celda = filaEncabezado.getCell(i + 1);
    celda.value = col.titulo;
    celda.font = { name: 'Calibri', size: 10, bold: true, color: { argb: TINTA } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } };
    celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    celda.border = { top: bordeFino, left: bordeFino, bottom: bordeFino, right: bordeFino };
  });

  // ─── Datos ───
  const totales = new Map<number, number>();

  filas.forEach((fila, indice) => {
    const numeroFila = PRIMERA_FILA + indice;
    const renglon = ws.getRow(numeroFila);
    const alterna = indice % 2 === 1;

    columnas.forEach((col, i) => {
      const tipo = col.tipo ?? 'texto';
      const bruto = col.valor(fila);
      const celda = renglon.getCell(i + 1);

      celda.value = valorCelda(bruto, tipo);
      celda.numFmt = FORMATOS[tipo];
      celda.font = { name: 'Calibri', size: 10, color: { argb: TINTA } };
      celda.alignment = { vertical: 'middle', horizontal: ALINEACION[tipo] };
      celda.border = { top: bordeFino, left: bordeFino, bottom: bordeFino, right: bordeFino };
      if (alterna) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BANDA } };

      if (col.total && typeof celda.value === 'number') {
        totales.set(i, (totales.get(i) ?? 0) + celda.value);
      }
    });
  });

  // ─── Fila de totales ───
  if (totales.size > 0) {
    const numeroFila = PRIMERA_FILA + filas.length;
    const renglon = ws.getRow(numeroFila);
    renglon.height = 22;

    columnas.forEach((col, i) => {
      const tipo = col.tipo ?? 'texto';
      const celda = renglon.getCell(i + 1);

      if (i === 0) celda.value = `TOTAL · ${filas.length} registros`;
      else if (totales.has(i)) celda.value = Math.round((totales.get(i) as number) * 100) / 100;

      celda.numFmt = totales.has(i) ? FORMATOS[tipo] : '@';
      celda.font = { name: 'Calibri', size: 10, bold: true, color: { argb: TINTA } };
      celda.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : ALINEACION[tipo] };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO_SUAVE } };
      celda.border = {
        top: { style: 'double', color: { argb: TINTA } },
        left: bordeFino, bottom: bordeFino, right: bordeFino,
      };
    });
  }

  // ─── Anchos de columna y filtro ───
  columnas.forEach((col, i) => {
    const tipo = col.tipo ?? 'texto';
    const largoDatos = filas.reduce(
      (max, fila) => Math.max(max, largoAproximado(col.valor(fila), tipo)), 0);
    ws.getColumn(i + 1).width = Math.min(46, Math.max(12, Math.max(col.titulo.length, largoDatos) + 3));
  });

  ws.autoFilter = {
    from: { row: FILA_ENCABEZADO, column: 1 },
    to: { row: PRIMERA_FILA + filas.length - 1, column: nCols },
  };

  return libro.xlsx.writeBuffer();
}

export async function exportarExcel<T>(opciones: ExcelOpciones<T>): Promise<void> {
  const buffer = await construirLibroExcel(opciones);
  descargar(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nombreArchivo(opciones.archivo, 'xlsx'),
  );
}

/* ═══════════════════════════════════════════
   PDF (captura de la pantalla)
   ═══════════════════════════════════════════ */

export interface PdfOpciones {
  /** Nombre del archivo, sin extensión ni fecha. */
  archivo: string;
  titulo: string;
  orientacion?: 'portrait' | 'landscape';
}

/** Captura el elemento tal como se ve y lo pagina en un PDF tamaño carta A4. */
export async function exportarPantallaPdf(
  elemento: HTMLElement,
  { archivo, titulo, orientacion = 'landscape' }: PdfOpciones,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);

  const fondo = getComputedStyle(document.body).backgroundColor || '#ffffff';

  const lienzo = await html2canvas(elemento, {
    scale: 2,
    backgroundColor: fondo,
    useCORS: true,
    logging: false,
    onclone: (documento: Document) => {
      // Sin animaciones el clon se captura en su estado final, no en el fotograma inicial
      const estilo = documento.createElement('style');
      estilo.textContent = '*,*::before,*::after{animation:none !important;transition:none !important;}';
      documento.head.appendChild(estilo);
      documento.querySelectorAll(`[${ATRIBUTO_OCULTAR}]`).forEach(el => el.remove());
    },
  });

  const pdf = new jsPDF({ orientation: orientacion, unit: 'pt', format: 'a4' });
  const anchoPagina = pdf.internal.pageSize.getWidth();
  const altoPagina = pdf.internal.pageSize.getHeight();

  const margen = 28;
  const altoPie = 18;
  const anchoUtil = anchoPagina - margen * 2;
  const altoUtil = altoPagina - margen * 2 - altoPie;

  const escala = anchoUtil / lienzo.width;
  const altoRebanada = Math.floor(altoUtil / escala); // píxeles del lienzo por página
  const paginas = Math.max(1, Math.ceil(lienzo.height / altoRebanada));

  const recorte = document.createElement('canvas');
  const ctx = recorte.getContext('2d');
  if (!ctx) throw new Error('El navegador no permitió preparar la imagen del PDF');

  for (let i = 0; i < paginas; i++) {
    const alto = Math.min(altoRebanada, lienzo.height - i * altoRebanada);
    recorte.width = lienzo.width;
    recorte.height = alto;
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, recorte.width, recorte.height);
    ctx.drawImage(lienzo, 0, i * altoRebanada, lienzo.width, alto, 0, 0, lienzo.width, alto);

    if (i > 0) pdf.addPage();
    pdf.addImage(recorte.toDataURL('image/png'), 'PNG', margen, margen, anchoUtil, alto * escala, undefined, 'FAST');

    pdf.setFontSize(8);
    pdf.setTextColor(130);
    pdf.text(`${titulo} · ${EMPRESA} · ${selloFecha()}`, margen, altoPagina - margen / 2);
    pdf.text(`Página ${i + 1} de ${paginas}`, anchoPagina - margen, altoPagina - margen / 2, { align: 'right' });
  }

  pdf.save(nombreArchivo(archivo, 'pdf'));
}
