'use client';

import { Fragment, useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTableRegion } from '@/components/AdminTableRegion';
import { deleteInvoiceAction, updateInvoiceAction, type ActionState } from '@/app/actions';
import { fechaCalendario, pesos } from '@/lib/format';
import type { Invoice, InvoiceStatus } from '@/lib/types';
import { adminReturnHref, type AdminQuery } from '@/lib/admin-lists';
import { StatusNotice } from './StatusNotice';

export function AdminInvoiceManager({ invoices, query }: Readonly<{ invoices: Invoice[]; query?: AdminQuery }>) {
  if (invoices.length === 0) return <div className="empty">No hay facturas emitidas.</div>;
  return (
    <AdminTableRegion label="Facturas emitidas">
      <table>
        <thead><tr><th>Código</th><th>Usuario</th><th>Concepto</th><th>Vence</th><th>Facturado</th><th>Saldo</th><th>Estado de pago</th><th>Acciones</th></tr></thead>
        <tbody>{invoices.map((invoice) => <InvoiceRows invoice={invoice} query={query} key={invoice.id} />)}</tbody>
      </table></AdminTableRegion>
  );
}

function InvoiceRows({ invoice, query }: Readonly<{ invoice: Invoice; query?: AdminQuery }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [updateState, updateAction, updating] = useActionState(async (previous: ActionState, data: FormData) => {
    const result = await updateInvoiceAction(previous, data);
    if (result.success && query) {
      // La fila puede haber salido de la página durante la revalidación.
      setOpen(false);
      const href = adminReturnHref('/admin/facturas', query, invoice.id);
      if (location.pathname + location.search + location.hash === href) router.refresh();
      else router.push(href, { scroll: false });
    }
    return result;
  }, {});
  const [deleteState, deleteAction, deleting] = useActionState<ActionState, FormData>(deleteInvoiceAction, {});
  const lastPayment = invoice.payments?.[0];
  return (
    <Fragment>
      <tr>
        <td>{invoice.code}</td>
        <td>{invoice.user?.name ?? invoice.tenant?.name ?? 'Sin usuario web'}</td>
        <td>{invoice.lease?.property.title ?? invoice.lineItems?.[0]?.catalogItem.name ?? 'Servicios'}</td>
        <td>{fechaCalendario(invoice.dueDate)}</td>
        <td>{pesos(invoice.amount)}</td>
        <td><strong>{pesos(invoice.balance)}</strong></td>
        <td>
          <span className={`status ${invoice.status.toLowerCase()}`}>{statusLabel(invoice.status)}</span>
          {lastPayment && <small className="tableHint">Último movimiento: {paymentLabel(lastPayment.status)}</small>}
        </td>
        <td><button id={`editar-${invoice.id}`} type="button" className="button ghost small" aria-expanded={open} aria-controls={`invoice-editor-${invoice.id}`} aria-disabled={updating} aria-label={`${open ? 'Cerrar edición de' : 'Editar'} ${invoice.code}`} onClick={() => { if (!updating) setOpen(!open); }}>{open ? 'Cerrar' : 'Editar'}</button></td>
      </tr>
      {open && <tr className="invoiceEditorRow" id={`invoice-editor-${invoice.id}`}><td colSpan={8}>
        <div className="invoiceEditorGrid">
          <form className="form invoiceEditForm" action={updateAction} onReset={event => event.preventDefault()} onSubmit={event => { if (updating || deleting) event.preventDefault(); }}>
            <input type="hidden" name="id" value={invoice.id} />
            <input type="hidden" name="tenantId" value={invoice.tenant?.id ?? ''} />
            <h3>Modificar factura {invoice.code}</h3>
            <fieldset className="editFields" disabled={updating} aria-label="Datos de la factura">
              <div className="fourCols">
                <label>Saldo facturado<input type="number" name="amount" min={0} step={1} defaultValue={invoice.amount} required /></label>
                <label>Estado del pago<select name="status" defaultValue={invoice.status}>{(['PENDING', 'OVERDUE', 'PAID', 'VOID'] as InvoiceStatus[]).map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label>
                <label>Periodo<input type="date" name="period" defaultValue={dateInput(invoice.period)} required /></label>
                <label>Vencimiento<input type="date" name="dueDate" defaultValue={dateInput(invoice.dueDate)} required /></label>
              </div>
              <label>Observación administrativa<textarea name="note" rows={2} defaultValue={invoice.adminNotes ?? ''} placeholder="Motivo del ajuste o nota interna" /></label>
            </fieldset>
            <p className="muted">Pagos aprobados asociados: {pesos(invoice.approvedAmount ?? approvedTotal(invoice))}. El saldo visible se recalcula automáticamente.</p>
            {!updating && updateState.error && <StatusNotice message={updateState.error} tone="error" />}
            {!updating && updateState.success && <StatusNotice message={updateState.success} tone="success" />}
            <button type="submit" className="button small" disabled={deleting} aria-busy={updating} aria-disabled={updating}>{updating ? 'Guardando…' : 'Guardar cambios'}</button>
          </form>
          <form
            className="form invoiceDeleteForm"
            action={deleteAction}
            onSubmit={(event) => {
              if (!window.confirm(`¿Eliminar la factura ${invoice.code}? Dejará de aparecer al usuario.`)) event.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={invoice.id} />
            <input type="hidden" name="tenantId" value={invoice.tenant?.id ?? ''} />
            <h3>Eliminar factura</h3>
            <p className="muted">Se retira de las vistas y la cartera, pero se conserva una trazabilidad técnica para no perder el historial.</p>
            <label>Motivo<textarea name="reason" rows={3} placeholder="Ejemplo: factura duplicada" /></label>
            {deleteState.error && <p className="alert error" role="alert">{deleteState.error}</p>}
            {deleteState.success && <output className="alert success">{deleteState.success}</output>}
            <button type="submit" className="button danger small" disabled={updating || deleting}>{deleting ? 'Eliminando…' : 'Eliminar factura'}</button>
          </form>
        </div>
      </td></tr>}
    </Fragment>
  );
}

function dateInput(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function approvedTotal(invoice: Invoice): number {
  return (invoice.payments ?? []).filter((payment) => payment.status === 'APPROVED').reduce((sum, payment) => sum + payment.amount, 0);
}

function statusLabel(status: InvoiceStatus): string {
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'OVERDUE') return 'Vencida';
  if (status === 'PAID') return 'Pagada';
  return 'Anulada';
}

function paymentLabel(status: string): string {
  if (status === 'APPROVED') return 'Aprobado';
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'DECLINED') return 'Rechazado';
  if (status === 'VOIDED') return 'Anulado';
  return status;
}
