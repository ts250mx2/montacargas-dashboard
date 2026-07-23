/**
 * Empate de lo leído en el CFDI contra los catálogos propios.
 * Solo comparaciones exactas tras normalizar: se prefiere no empatar
 * a empatar mal, porque un empate equivocado mete precios erróneos.
 */

import { normalizar, type ConceptoCfdi } from './cfdi';

export interface ProductoCatalogo {
  id: number;
  sku: string;
  descripcion: string;
  precio: number | string;
}

export interface EntidadCatalogo {
  id: number;
  razon_social: string;
  rfc: string;
}

export type CriterioEmpate = 'sku' | 'descripcion' | 'ninguno';

export interface ConceptoEmpatado extends ConceptoCfdi {
  id_producto: number | null;
  producto: string | null;
  criterio: CriterioEmpate;
}

/** Empata cada concepto del CFDI con un producto del catálogo. */
export function empatarConceptos(
  conceptos: readonly ConceptoCfdi[],
  productos: readonly ProductoCatalogo[],
): ConceptoEmpatado[] {
  const porSku = new Map<string, ProductoCatalogo>();
  const porDescripcion = new Map<string, ProductoCatalogo>();

  for (const producto of productos) {
    const sku = normalizar(producto.sku);
    const descripcion = normalizar(producto.descripcion);
    // El primero gana: si hay duplicados normalizados no se inventa un desempate
    if (sku && !porSku.has(sku)) porSku.set(sku, producto);
    if (descripcion && !porDescripcion.has(descripcion)) porDescripcion.set(descripcion, producto);
  }

  return conceptos.map(concepto => {
    const porClave = concepto.clave ? porSku.get(normalizar(concepto.clave)) : undefined;
    if (porClave) {
      return { ...concepto, id_producto: porClave.id, producto: porClave.descripcion, criterio: 'sku' };
    }

    const porTexto = porDescripcion.get(normalizar(concepto.descripcion));
    if (porTexto) {
      return { ...concepto, id_producto: porTexto.id, producto: porTexto.descripcion, criterio: 'descripcion' };
    }

    return { ...concepto, id_producto: null, producto: null, criterio: 'ninguno' };
  });
}

/**
 * Busca en el catálogo la entidad que corresponda a alguno de los RFC del CFDI.
 * Como el comprobante puede ser emitido o recibido, se prueban ambos.
 */
export function empatarEntidad(
  rfcs: readonly string[],
  nombres: readonly string[],
  entidades: readonly EntidadCatalogo[],
): { entidad: EntidadCatalogo; rfc: string } | null {
  for (const rfc of rfcs) {
    const buscado = normalizar(rfc);
    if (!buscado) continue;
    const entidad = entidades.find(e => normalizar(e.rfc) === buscado);
    if (entidad) return { entidad, rfc };
  }

  // Sin RFC en el catálogo se intenta por razón social exacta
  for (const nombre of nombres) {
    const buscado = normalizar(nombre);
    if (!buscado) continue;
    const entidad = entidades.find(e => normalizar(e.razon_social) === buscado);
    if (entidad) return { entidad, rfc: entidad.rfc };
  }

  return null;
}
