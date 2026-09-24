import Link from 'next/link';
import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import { fechaCalendario, pesos } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import type { Invoice, UserLease } from '@/lib/types';

export const metadata: Metadata = { title: 'Mi cuenta' };
export const dynamic = 'force-dynamic';

export default async function MyAccountPage({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const user = await requireUser('USER');
  const [invoices, leases] = await Promise.all([
    apiFetch<Invoice[]>('/invoices/me', {}, true),
    apiFetch<UserLease[]>('/leases/me', {}, true),
  ]);
  const query = await searchParams;
  const pending = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const paid = invoices.filter((invoice) => invoice.status === 'PAID').reduce((sum, invoice) => sum + invoice.amount, 0);
  const availableContracts = leases.filter((lease) => lease.contractFile);
  return (
    <section className="section pageTop accountPage">
      <div className="container">
        {query.pago === 'aprobado' && <p className="alert success">Tu pago fue aprobado y la factura ya se encuentra actualizada.</p>}
        <div className="pageHeading"><span className="eyebrow">Mi cuenta</span><h1>Bienvenido, {user.name}</h1><p>Consulta tus facturas, pagos e inmuebles, y visualiza o descarga tus contratos firmados.</p></div>
        <div className="metricGrid userMetrics">
          <div className="metric"><span>Saldo pendiente</span><strong>{pesos(pending)}</strong></div>
          <div className="metric"><span>Total pagado</span><strong>{pesos(paid)}</strong></div>
          <div className="metric"><span>Contratos disponibles</span><strong>{availableContracts.length}</strong></div>
        </div>

        <div className="card tableCard accountContracts">
          <div className="tableTitle"><h2>Mis contratos firmados</h2><span>{availableContracts.length} disponibles</span></div>
          <div className="contractUserGrid">
            {leases.map((lease) => <article className="contractUserCard" key={lease.id}>
              <div><span className={`status ${lease.active ? 'paid' : 'archived'}`}>{lease.active ? 'Activo' : 'Finalizado'}</span><h3>{lease.property.title}</h3><p>{lease.property.address}, {lease.property.city}</p><small>Vigencia: {lease.startDate ? fechaCalendario(lease.startDate) : 'sin fecha inicial'}{lease.endDate ? ` – ${fechaCalendario(lease.endDate)}` : ''}</small></div>
              {lease.contractFile ? <div className="contractActions">
                <Link className="button small" href={`/mi-cuenta/contratos/${lease.id}`}>Visualizar PDF</Link>
                <Link className="button ghost small" href={`/documentos/contratos/${lease.id}?download=1`}>Descargar</Link>
              </div> : <p className="muted">La inmobiliaria todavía no ha cargado el contrato firmado.</p>}
            </article>)}
          </div>
          {leases.length === 0 && <div className="empty">No tienes contratos asociados.</div>}
        </div>

        <div className="card tableCard">
          <div className="tableTitle"><h2>Mis facturas</h2></div>
          <div className="responsiveTable">
            <table><thead><tr><th>Factura</th><th>Inmueble</th><th>Periodo</th><th>Vence</th><th>Facturado</th><th>Saldo</th><th>Estado</th><th /></tr></thead>
              <tbody>{invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.code}</td><td>{invoice.lease.property.title}</td><td>{fechaCalendario(invoice.period)}</td><td>{fechaCalendario(invoice.dueDate)}</td><td>{pesos(invoice.amount)}</td><td>{pesos(invoice.balance)}</td>
                  <td><span className={`status ${invoice.status.toLowerCase()}`}>{invoiceStatus(invoice.status)}</span></td>
                  <td>{invoice.balance > 0 && invoice.status !== 'VOID' ? <Link className="button small" href={`/mi-cuenta/facturas/${invoice.id}/pagar`}>Pagar</Link> : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {invoices.length === 0 && <div className="empty">No tienes facturas registradas.</div>}
        </div>
      </div>
    </section>
  );
}

function invoiceStatus(status: string): string {
  if (status === 'PAID') return 'Pagada';
  if (status === 'OVERDUE') return 'Vencida';
  if (status === 'VOID') return 'Anulada';
  return 'Pendiente';
}
