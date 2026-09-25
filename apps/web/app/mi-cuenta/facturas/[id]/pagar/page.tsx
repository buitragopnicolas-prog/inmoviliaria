import { randomUUID } from 'node:crypto';
import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import { fechaCalendario, pesos } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import type { Invoice, ManualPaymentConfig } from '@/lib/types';
import { approveMockAction, beginPaymentAction } from '@/app/actions';
import { ManualPaymentForm } from '@/components/ManualPaymentForm';

export const metadata: Metadata = { title: 'Pagar factura' };
export const dynamic = 'force-dynamic';

export default async function PayInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reference?: string }> }) {
  await requireUser('USER');
  const { id } = await params;
  const { reference } = await searchParams;
  const [invoice, config] = await Promise.all([
    apiFetch<Invoice>(`/invoices/me/${id}`, {}, true),
    apiFetch<ManualPaymentConfig>('/payments/manual/config', {}, true),
  ]);
  const activeManual = invoice.payments?.find((payment) => payment.provider === 'MANUAL' && ['AWAITING_VERIFICATION', 'UNDER_REVIEW'].includes(payment.status));

  return <section className="section pageTop">
    <div className="container paymentWrap paymentPage">
      <div className="card paymentSummaryCard">
        <span className="eyebrow">Pago de factura</span><h1>{invoice.code}</h1>
        <div className="paymentData"><p>Inmueble <strong>{invoice.lease.property.title}</strong></p><p>Periodo <strong>{fechaCalendario(invoice.period)}</strong></p><p>Vencimiento <strong>{fechaCalendario(invoice.dueDate)}</strong></p></div>
        <div className="amountDue"><span>Saldo a pagar</span><strong>{pesos(invoice.balance)}</strong></div>
        <div className="trustNote"><strong>Proceso seguro y verificable</strong><span>Ningún reporte se marca como pagado antes de su validación.</span></div>
      </div>

      <div className="card paymentMainCard">
        {invoice.status === 'PAID' || invoice.balance <= 0 ? <p className="alert success">Esta factura no tiene saldo pendiente.</p>
          : invoice.status === 'VOID' ? <p className="alert error">Esta factura fue anulada.</p>
          : activeManual ? <div className="reportedPaymentState"><span className="status pending">{activeManual.status === 'UNDER_REVIEW' ? 'EN REVISIÓN' : 'PENDIENTE DE VERIFICACIÓN'}</span><h2>Recibimos tu reporte de pago</h2><p>Referencia interna: <strong>{activeManual.reference}</strong></p><p>Te notificaremos cuando el pago haya sido confirmado. La factura conserva su saldo mientras termina la validación.</p></div>
          : config.mode === 'manual' ? <ManualPaymentForm invoiceId={invoice.id} amount={invoice.balance} idempotencyKey={randomUUID()} config={config} />
          : reference && config.mode === 'mock' ? <><p className="muted">Modo de desarrollo activo: confirma la aprobación para completar el ciclo sin realizar un cobro real.</p><form action={approveMockAction}><input type="hidden" name="reference" value={reference} /><button className="button wide">Simular pago aprobado</button></form></>
          : <form action={beginPaymentAction}><input type="hidden" name="invoiceId" value={invoice.id} /><button className="button wide">Continuar al pago</button></form>}
      </div>
    </div>
  </section>;
}
