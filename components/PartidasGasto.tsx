'use client';

import { Plus, Trash2, ListPlus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { money } from '@/lib/format';

export interface PartidaEditable {
  clave: string;
  descripcion: string;
  cantidad: string;
  precio: string;
}

export const PARTIDA_VACIA: PartidaEditable = { clave: '', descripcion: '', cantidad: '1', precio: '' };

const aNumero = (valor: string): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

export const importeDePartida = (partida: PartidaEditable): number =>
  Math.round(aNumero(partida.cantidad) * aNumero(partida.precio) * 100) / 100;

export const sumaDePartidas = (partidas: readonly PartidaEditable[]): number =>
  Math.round(partidas.reduce((suma, p) => suma + importeDePartida(p), 0) * 100) / 100;

interface Props {
  partidas: PartidaEditable[];
  onCambio: (partidas: PartidaEditable[]) => void;
  /** Subtotal del comprobante, para avisar si el desglose no cuadra. */
  subtotal: number;
}

export default function PartidasGasto({ partidas, onCambio, subtotal }: Props) {
  const actualizar = (indice: number, campo: keyof PartidaEditable, valor: string) =>
    onCambio(partidas.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)));

  const agregar = () => onCambio([...partidas, { ...PARTIDA_VACIA }]);
  const quitar = (indice: number) => onCambio(partidas.filter((_, i) => i !== indice));

  const suma = sumaDePartidas(partidas);
  const conDatos = partidas.filter(p => p.descripcion.trim() && aNumero(p.cantidad) > 0);
  const diferencia = Math.round((suma - subtotal) * 100) / 100;
  const cuadra = Math.abs(diferencia) <= Math.max(0.01, partidas.length * 0.01);

  return (
    <div className="partidas">
      <div className="partidasHead">
        <span className="fieldLabel">Partidas (opcional)</span>
        <button type="button" className="btnGhost partidasAgregar" onClick={agregar}>
          <Plus size={15} /> Agregar partida
        </button>
      </div>

      {partidas.length === 0 ? (
        <button type="button" className="partidasVacio" onClick={agregar}>
          <ListPlus size={16} />
          Desglosa el gasto en partidas si lo necesitas. Los importes del gasto no cambian.
        </button>
      ) : (
        <>
          <div className="tableWrap">
            <table className="dataTable partidasTabla">
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>Descripción</th>
                  <th className="tdNum">Cantidad</th>
                  <th className="tdNum">P. Unitario</th>
                  <th className="tdNum">Importe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {partidas.map((partida, i) => (
                  <tr key={i}>
                    <td>
                      <input type="text" value={partida.clave} placeholder="—"
                        onChange={e => actualizar(i, 'clave', e.target.value)} />
                    </td>
                    <td>
                      <input type="text" value={partida.descripcion} placeholder="Descripción del concepto"
                        onChange={e => actualizar(i, 'descripcion', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.01" min="0" value={partida.cantidad} className="tdNum"
                        onChange={e => actualizar(i, 'cantidad', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.01" min="0" value={partida.precio} className="tdNum"
                        onChange={e => actualizar(i, 'precio', e.target.value)} />
                    </td>
                    <td className="tdNum tdBold">{money(importeDePartida(partida))}</td>
                    <td>
                      <button type="button" className="iconBtn iconBtnDanger"
                        onClick={() => quitar(i)} title="Quitar partida">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={`partidasCuadre ${cuadra ? 'lectorOk' : 'lectorPendiente'}`}>
            {cuadra ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            Suma de partidas: <strong>{money(suma)}</strong>
            {' · '}Subtotal del gasto: <strong>{money(subtotal)}</strong>
            {!cuadra && <> · diferencia de <strong>{money(Math.abs(diferencia))}</strong></>}
          </p>

          {!cuadra && (
            <p className="lectorAviso">
              El desglose no cuadra con el subtotal. Se guarda igual: los importes del gasto
              son los del comprobante, las partidas solo lo detallan.
            </p>
          )}

          {conDatos.length < partidas.length && (
            <p className="lectorAviso">
              Las partidas sin descripción o con cantidad en cero no se guardan.
            </p>
          )}
        </>
      )}
    </div>
  );
}
