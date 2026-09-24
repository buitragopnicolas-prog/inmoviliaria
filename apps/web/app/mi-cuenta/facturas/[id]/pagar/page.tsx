import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import { fechaCalendario, pesos } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import type { Invoice } from '@/lib/types';
import { approveMockAction, beginPaymentAction } from '@/app/actions';

export const metadata: Metadata = { title: 'Pagar factura' };
export const dynamic = 'force-dynamic';

export default async function PayInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reference?: string }> }) {
  await requireUser('USER');
  const { id } = await params;
  const { reference } = await searchParams;
  const invoice = await apiFetch<Invoice>(`/invoices/me/${id}`, {}, true);
  return (
    <section className="section pageTop">
      <div className="container paymentWrap">
        <div className="card paymentCard">
          <span className="eyebrow">Pago de factura</span>
          <h1>{invoice.code}</h1>
          <div className="paymentData"><p>Inmueble <strong>{invoice.lease.property.title}</strong></p><p>Periodo <strong>{fechaCalendario(invoice.period)}</strong></p><p>Vencimiento <strong>{fechaCalendario(invoice.dueDate)}</strong></p></div>
          <div className="amountDue"><span>Total a pagar</span><strong>{pesos(invoice.balance)}</strong></div>
          {invoice.status === 'PAID' || invoice.balance <= 0 ? <p className="alert success">Esta factura no tiene saldo pendiente.</p> : invoice.status === 'VOID' ? <p className="alert error">Esta factura fue anulada.</p> : reference ? (
            <>
              <p className="muted">Modo de desarrollo activo: confirma la aprobación para completar el ciclo de la factura sin realizar un cobro real.</p>
              <form action={approveMockAction}><input type="hidden" name="reference" value={reference} /><button className="button wide">Simular pago aprobado</button></form>
            </>
          ) : (
            <form action={beginPaymentAction}><input type="hidden" name="invoiceId" value={invoice.id} /><button className="button wide">Continuar al pago</button></form>
          )}
        </div>
      </div>
    </section>
  );
}
