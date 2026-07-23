/**
 * Almacenamiento de los comprobantes adjuntos (PDF y XML) de facturas y gastos.
 *
 * Los archivos viven fuera de `public/` a propósito: se sirven por una ruta de
 * API que pasa por el control de sesión, no como archivos estáticos abiertos.
 */

import { randomBytes } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

export type Modulo = 'facturas' | 'gastos';
export type Extension = 'pdf' | 'xml';

/** Carpeta raíz del almacén, configurable por si se monta en otro disco. */
const RAIZ = process.env.ALMACEN_ADJUNTOS
  ? path.resolve(process.env.ALMACEN_ADJUNTOS)
  : path.join(process.cwd(), 'almacen');

export const TAMANO_MAXIMO = 15 * 1024 * 1024; // 15 MB

const FIRMA_PDF = '%PDF-';
const MODULOS: readonly Modulo[] = ['facturas', 'gastos'];

export const TIPO_MIME: Record<Extension, string> = {
  pdf: 'application/pdf',
  xml: 'application/xml',
};

/** Nombre en disco: aleatorio, sin datos del usuario, con extensión controlada. */
export const generarNombreArchivo = (id: number | string, extension: Extension): string =>
  `${id}-${Date.now()}-${randomBytes(6).toString('hex')}.${extension}`;

/** Solo se aceptan nombres generados por nosotros: evita salirse de la carpeta. */
const NOMBRE_VALIDO = /^\d+-\d+-[0-9a-f]{12}\.(pdf|xml)$/;

export function rutaDeArchivo(modulo: Modulo, nombre: string): string {
  if (!MODULOS.includes(modulo)) throw new Error('Módulo de almacén no válido');
  if (!NOMBRE_VALIDO.test(nombre)) throw new Error('Nombre de archivo no válido');
  return path.join(RAIZ, modulo, nombre);
}

export const extensionDe = (nombre: string): Extension =>
  nombre.toLowerCase().endsWith('.xml') ? 'xml' : 'pdf';

/* ─── Detección por contenido, no por extensión ─── */

export function esPdf(datos: Uint8Array): boolean {
  if (datos.length < FIRMA_PDF.length) return false;
  return Buffer.from(datos.subarray(0, FIRMA_PDF.length)).toString('latin1') === FIRMA_PDF;
}

export function esXml(datos: Uint8Array): boolean {
  // Se inspecciona solo el arranque: basta para distinguirlo de un binario
  const inicio = Buffer.from(datos.subarray(0, 512)).toString('utf8').replace(/^﻿/, '').trimStart();
  return inicio.startsWith('<?xml') || /^<[A-Za-z_]/.test(inicio);
}

/* ─── Operaciones de archivo ─── */

export async function guardarArchivo(modulo: Modulo, nombre: string, datos: Uint8Array): Promise<void> {
  const ruta = rutaDeArchivo(modulo, nombre);
  await mkdir(path.dirname(ruta), { recursive: true });
  await writeFile(ruta, datos);
}

export const leerArchivo = (modulo: Modulo, nombre: string): Promise<Buffer> =>
  readFile(rutaDeArchivo(modulo, nombre));

/** Borra el archivo; si ya no existe no es un error. */
export async function borrarArchivo(modulo: Modulo, nombre: string): Promise<void> {
  try {
    await unlink(rutaDeArchivo(modulo, nombre));
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export interface ArchivoRecibido {
  datos: Uint8Array;
  nombreOriginal: string;
  extension: Extension;
}

/**
 * Lee el comprobante de un `FormData`, validando tipo y tamaño.
 * `permitidas` acota qué formatos acepta el módulo que lo llama.
 */
export async function leerComprobanteDeFormulario(
  formulario: FormData,
  permitidas: readonly Extension[] = ['pdf', 'xml'],
): Promise<ArchivoRecibido> {
  const archivo = formulario.get('archivo');
  if (!(archivo instanceof File)) throw new Error('No se recibió ningún archivo');
  if (archivo.size === 0) throw new Error('El archivo está vacío');
  if (archivo.size > TAMANO_MAXIMO) {
    throw new Error(`El archivo supera el máximo de ${TAMANO_MAXIMO / 1024 / 1024} MB`);
  }

  const datos = new Uint8Array(await archivo.arrayBuffer());

  let extension: Extension;
  if (permitidas.includes('pdf') && esPdf(datos)) extension = 'pdf';
  else if (permitidas.includes('xml') && esXml(datos)) extension = 'xml';
  else {
    const nombres = permitidas.map(e => e.toUpperCase()).join(' o ');
    throw new Error(`El archivo no es un ${nombres} válido`);
  }

  return { datos, nombreOriginal: archivo.name.slice(0, 255), extension };
}
