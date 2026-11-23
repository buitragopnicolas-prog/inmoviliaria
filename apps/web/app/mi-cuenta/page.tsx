import { portalDescriptions, portalNames } from '@/lib/portals';
import type { DocumentFile } from '@/lib/documents';
import { DocumentLinks } from '@/components/DocumentLinks';
import Link from 'next/link';
import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import { fechaCalendario, pesos } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import { StatusNotice } from '@/components/StatusNotice';
import { paymentAccountHref, paymentStatusLabel } from '@/lib/payment-status';
import type { Invoice, UserLease } from '@/lib/types';

export const metadata: Metadata = { title: 'Mi cuenta' };
export const dynamic = 'force-dynamic';

export default async function MyAccountPage({ searchParams }: { searchParams: Promise<{ referencia?: string | string[] }> }) {
  const user = await requireUser('USER');
  const tenant=user.portal==='TENANT';
  const [invoices, leases, documents] = await Promise.all([
    apiFetch<Invoice[]>('/invoices/me', {}, true),
    tenant ? apiFetch<UserLease[]>('/leases/me', {}, true) : [],
    tenant ? [] : apiFetch<DocumentFile[]>('/documents/mine',{},true),
  ]);
  const { referencia } = await searchParams;
  const pending = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const paid = invoices.filter((invoice) => invoice.status === 'PAID').reduce((sum, invoice) => sum + invoice.amount, 0);
  const availableContracts = leases.filter((lease) => lease.contractFile);
  return (
    <section className="section pageTop accountPage">
      <div className="container">
        <div className="pageHeading"><span className="eyebrow">{portalNames[user.portal]}</span><h1>Bienvenido, {user.name}</h1><p>{portalDescriptions[user.portal]}</p>{user.portal==='OWNER' && <Link className="button" href="/propietarios/publicaciones">Mis publicaciones</Link>} <Link className="button outline" href="/mi-cuenta/documentos">Mis documentos PDF</Link></div>
        {typeof referencia === 'string' && referencia && <AccountPaymentNotice invoices={invoices} reference={referencia} />}
        <div className="metricGrid userMetrics">
          <div className="metric"><span>Saldo pendiente</span><strong>{pesos(pending)}</strong></div>
          <div className="metric"><span>Total de facturas pagadas</span><strong>{pesos(paid)}</strong></div>
          <div className="metric"><span>{tenant?'Contratos disponibles':'Documentos disponibles'}</span><strong>{tenant?availableContracts.length:documents.length}</strong></div>
        </div>

        {tenant ? <div className="card tableCard accountContracts">
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
        </div> : <section className="card formPanel"><h2>{user.portal==='SERVICES'?'Contratos de prestación de servicios':'Documentos del propietario'}</h2>{documents.length?<DocumentLinks files={documents} scope="privados"/>:<p>Todavía no hay documentos asignados.</p>}</section>}

        <div className="card tableCard">
          <div className="tableTitle"><h2>Mis facturas</h2></div>
          <div className="responsiveTable">
            <table><thead><tr><th>Factura</th><th>Concepto</th><th>Periodo</th><th>Vence</th><th>Facturado</th><th>Saldo</th><th>Estado</th><th>Último pago</th><th /></tr></thead>
              <tbody>{invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.code}</td><td>{invoice.lease?.property.title ?? invoice.lineItems?.[0]?.catalogItem.name ?? 'Cobro de servicios'}</td><td>{fechaCalendario(invoice.period)}</td><td>{fechaCalendario(invoice.dueDate)}</td><td>{pesos(invoice.amount)}</td><td>{pesos(invoice.balance)}</td>
                  <td><span className={`status ${invoice.status.toLowerCase()}`}>{invoiceStatus(invoice.status)}</span></td>
                  <td>{invoice.payments?.[0] ? <Link className="textLink" href={paymentAccountHref(invoice.payments[0].reference)}>{paymentStatusLabel(invoice.payments[0].status)}</Link> : '—'}</td>
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

function AccountPaymentNotice({ invoices, reference }: { invoices: Invoice[]; reference: string }) {
  for (const invoice of invoices) {
    const payment = invoice.payments?.find(item => item.reference === reference);
    if (payment) {
      const message = `${paymentStatusLabel(payment.status)}. Factura ${invoice.code}. Referencia ${payment.reference}. Importe ${pesos(payment.amount)}. Saldo de la factura ${pesos(invoice.balance)}.`;
      return <StatusNotice message={message} tone={payment.status === 'APPROVED' ? 'success' : 'info'} />;
    }
  }
  return null;
}

function invoiceStatus(status: string): string {
  if (status === 'PAID') return 'Pagada';
  if (status === 'OVERDUE') return 'Vencida';
  if (status === 'VOID') return 'Anulada';
  return 'Pendiente';
}
