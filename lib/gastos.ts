/**
 * Partidas de un gasto. Son opcionales: sirven para desglosar el comprobante,
 * pero los importes del gasto siguen siendo los del CFDI, que es el documento
 * que vale ante el SAT. Por eso aquí solo se normaliza y se compara, nunca se
 * sobreescriben los totales capturados.
 */

export interface PartidaGasto {
  clave: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  importe: number;
}

const redondear = (n: number): number => Math.round(n * 100) / 100;

const aNumero = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Deja las partidas en forma canónica y descarta las inservibles.
 * El importe siempre se recalcula: así una fila nunca queda inconsistente
 * consigo misma, y cualquier diferencia contra el comprobante queda a la vista.
 */
export function normalizarPartidas(entrada: unknown): PartidaGasto[] {
  if (!Array.isArray(entrada)) return [];

  return entrada.reduce<PartidaGasto[]>((validas, fila) => {
    if (!fila || typeof fila !== 'object') return validas;

    const descripcion = String((fila as any).descripcion ?? '').trim().slice(0, 300);
    const cantidad = aNumero((fila as any).cantidad);
    const precio = aNumero((fila as any).precio);

    // Sin descripción o sin cantidad la partida no aporta nada
    if (!descripcion || cantidad <= 0) return validas;

    validas.push({
      clave: String((fila as any).clave ?? '').trim().slice(0, 50),
      descripcion,
      cantidad: redondear(cantidad),
      precio: redondear(precio),
      importe: redondear(cantidad * precio),
    });
    return validas;
  }, []);
}

export const sumaPartidas = (partidas: readonly PartidaGasto[]): number =>
  redondear(partidas.reduce((suma, p) => suma + p.importe, 0));

/**
 * ¿La suma de las partidas cuadra con el subtotal del comprobante?
 * Se tolera un centavo por partida: los CFDI redondean cada renglón por separado.
 */
export function cuadranPartidas(partidas: readonly PartidaGasto[], subtotal: number): boolean {
  if (partidas.length === 0) return true;
  const tolerancia = Math.max(0.01, partidas.length * 0.01);
  // La diferencia se redondea antes de comparar: en coma flotante
  // |100 - 100.01| da 0.010000000000005, que se pasaría de la tolerancia
  return redondear(Math.abs(sumaPartidas(partidas) - subtotal)) <= tolerancia;
}
