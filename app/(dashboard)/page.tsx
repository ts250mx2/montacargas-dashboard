'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, FileText, DollarSign, AlertTriangle, Clock, Wallet, ArrowRight,
} from 'lucide-react';
import { money, fecha, badgeEstadoCobro } from '@/lib/format';
import CountUp from '@/components/CountUp';

interface Stats {
  facturadoMes: { n: number; monto: number };
  cobradoMes: { n: number; monto: number };
  saldoPendiente: number;
  vencidas: { n: number; monto: number };
  porVencer: { n: number; monto: number };
  urgentes: any[];
  ultimas: any[];
}

function KpiSkeleton() {
  return (
    <div className="glass kpiCard">
      <div className="kpiIcon skeleton" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 12, width: '60%' }} />
        <div className="skeleton" style={{ height: 24, width: '80%' }} />
        <div className="skeleton" style={{ height: 10, width: '45%' }} />
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0.5rem 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 34, width: '100%' }} />
      ))}
    </div>
  );
}

export default function InicioPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.json())
      .then(d => (d.message ? setError(d.message) : setStats(d)))
      .catch(() => setError('Error de conexión'));
  }, []);

  return (
    <div className="pageContainer">
      <header className="pageHead">
        <div className="titleGroup">
          <div className="titleIcon"><LayoutDashboard size={24} /></div>
          <div>
            <h1>Inicio</h1>
            <p className="pageSubtitle">Resumen de facturación y cobranza</p>
          </div>
        </div>
        <Link href="/facturas" className="btnPrimary">
          <FileText size={18} /> Nueva Factura
        </Link>
      </header>

      {error && <div className="glass card" style={{ color: 'var(--danger)' }}>{error}</div>}

      {!stats && !error && (
        <>
          <div className="kpiGrid">
            {Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
            <div className="glass card"><TableSkeleton /></div>
            <div className="glass card"><TableSkeleton /></div>
          </div>
        </>
      )}

      {stats && (
        <>
          <div className="kpiGrid">
            <div className="glass kpiCard">
              <div className="kpiIcon" style={{ background: 'var(--yellow-soft)', color: '#8a7500' }}>
                <FileText size={22} />
              </div>
              <div>
                <div className="kpiLabel">Facturado del mes</div>
                <div className="kpiValue"><CountUp value={stats.facturadoMes.monto} format={money} /></div>
                <div className="kpiSub">{stats.facturadoMes.n} facturas vigentes</div>
              </div>
            </div>

            <div className="glass kpiCard">
              <div className="kpiIcon" style={{ background: 'rgba(48,164,108,0.12)', color: 'var(--success)' }}>
                <DollarSign size={22} />
              </div>
              <div>
                <div className="kpiLabel">Cobrado del mes</div>
                <div className="kpiValue"><CountUp value={stats.cobradoMes.monto} format={money} /></div>
                <div className="kpiSub">{stats.cobradoMes.n} pagos recibidos</div>
              </div>
            </div>

            <div className="glass kpiCard">
              <div className="kpiIcon" style={{ background: 'rgba(0,145,255,0.12)', color: 'var(--info)' }}>
                <Wallet size={22} />
              </div>
              <div>
                <div className="kpiLabel">Saldo por cobrar</div>
                <div className="kpiValue"><CountUp value={stats.saldoPendiente} format={money} /></div>
                <div className="kpiSub">cartera total vigente</div>
              </div>
            </div>

            <div className="glass kpiCard">
              <div className="kpiIcon" style={{ background: 'rgba(229,72,77,0.12)', color: 'var(--danger)' }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="kpiLabel">Vencido</div>
                <div className="kpiValue"><CountUp value={stats.vencidas.monto} format={money} /></div>
                <div className="kpiSub">{stats.vencidas.n} facturas vencidas</div>
              </div>
            </div>

            <div className="glass kpiCard">
              <div className="kpiIcon" style={{ background: 'rgba(247,107,21,0.12)', color: 'var(--warning)' }}>
                <Clock size={22} />
              </div>
              <div>
                <div className="kpiLabel">Por vencer</div>
                <div className="kpiValue"><CountUp value={stats.porVencer.monto} format={money} /></div>
                <div className="kpiSub">{stats.porVencer.n} facturas próximas</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
            <div className="glass card animate-fade">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem' }}>Cobranza urgente</h3>
                <Link href="/cobranza" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
                  Ver todo <ArrowRight size={14} />
                </Link>
              </div>
              <div className="tableWrap">
                <table className="dataTable">
                  <thead>
                    <tr><th>Folio</th><th>Folio Interno</th><th>Cliente</th><th>Vence</th><th className="tdNum">Saldo</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {stats.urgentes.length === 0 ? (
                      <tr><td colSpan={6} className="emptyCell">Sin facturas pendientes de cobro 🎉</td></tr>
                    ) : stats.urgentes.map(f => (
                      <tr key={f.id}>
                        <td><Link href={`/facturas/${f.id}`} className="tdBold" style={{ color: 'var(--info)' }}>{f.folio}</Link></td>
                        <td className="tdBold">{f.folio_interno}</td>
                        <td>{f.cliente}</td>
                        <td className="tdMuted">{fecha(f.fecha_vencimiento)}</td>
                        <td className="tdNum tdBold">{money(f.saldo)}</td>
                        <td><span className={badgeEstadoCobro(f.estado_cobro)}>{f.estado_cobro}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass card animate-fade">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem' }}>Últimas facturas</h3>
                <Link href="/facturas" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
                  Ver todo <ArrowRight size={14} />
                </Link>
              </div>
              <div className="tableWrap">
                <table className="dataTable">
                  <thead>
                    <tr><th>Folio</th><th>Folio Interno</th><th>Cliente</th><th>Fecha</th><th className="tdNum">Total</th></tr>
                  </thead>
                  <tbody>
                    {stats.ultimas.length === 0 ? (
                      <tr><td colSpan={5} className="emptyCell">Aún no hay facturas</td></tr>
                    ) : stats.ultimas.map(f => (
                      <tr key={f.id}>
                        <td><Link href={`/facturas/${f.id}`} className="tdBold" style={{ color: 'var(--info)' }}>{f.folio}</Link></td>
                        <td className="tdBold">{f.folio_interno}</td>
                        <td>{f.cliente}</td>
                        <td className="tdMuted">{fecha(f.fecha)}</td>
                        <td className="tdNum tdBold">{money(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
