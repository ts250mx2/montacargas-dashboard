/**
 * Definición de catálogos simples administrables desde /catalogos.
 * Solo las tablas y columnas listadas aquí son accesibles por la API genérica.
 */
export const CATALOGOS: Record<string, { titulo: string; columnas: string[] }> = {
  formas_pago: { titulo: 'Formas de Pago', columnas: ['nombre'] },
  bancos:      { titulo: 'Bancos',          columnas: ['nombre'] },
  marcas:      { titulo: 'Marcas',          columnas: ['nombre'] },
  lineas:      { titulo: 'Líneas de Producto', columnas: ['nombre'] },
  unidades:    { titulo: 'Unidades de Medida', columnas: ['nombre', 'abreviatura'] },
  vendedores:  { titulo: 'Vendedores',      columnas: ['nombre', 'telefono', 'correo'] },
};

export function esCatalogoValido(tabla: string): boolean {
  return Object.prototype.hasOwnProperty.call(CATALOGOS, tabla);
}
