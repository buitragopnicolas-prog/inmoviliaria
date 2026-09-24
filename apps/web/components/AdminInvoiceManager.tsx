'use client';

import { Fragment, useActionState, useState } from 'react';
import { deleteInvoiceAction, updateInvoiceAction, type ActionState } from '@/app/actions';
import { fechaCalendario, pesos } from '@/lib/format';
import type { Invoice, InvoiceStatus } from '@/lib/types';

export function AdminInvoiceManager({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) return <div className="empty">No hay facturas emitidas.</div>;
  return (
    <div className="responsiveTable">
      <table>
        <thead><tr><th>Código</th><th>Usuario</th><th>Inmueble</th><th>Vence</th><th>Facturado</th><th>Saldo</th><th>Estado de pago</th><th>Acciones</th></tr></thead>
        <tbody>{invoices.map((invoice) => <InvoiceRows invoice={invoice} key={invoice.id} />)}</tbody>
      </table>
    </div>
  );
}

function InvoiceRows({ invoice }: { invoice: Invoice }) {
  const [open, setOpen] = useState(false);
  const [updateState, updateAction, updating] = useActionState<ActionState, FormData>(updateInvoiceAction, {});
  const [deleteState, deleteAction, deleting] = useActionState<ActionState, FormData>(deleteInvoiceAction, {});
  const lastPayment = invoice.payments?.[0];
  return (
    <Fragment>
      <tr>
        <td>{invoice.code}</td>
        <td>{invoice.user?.name ?? invoice.tenant?.name ?? 'Sin usuario web'}</td>
        <td>{invoice.lease.property.title}</td>
        <td>{fechaCalendario(invoice.dueDate)}</td>
        <td>{pesos(invoice.amount)}</td>
        <td><strong>{pesos(invoice.balance)}</strong></td>
        <td>
          <span className={`status ${invoice.status.toLowerCase()}`}>{statusLabel(invoice.status)}</span>
          {lastPayment && <small className="tableHint">Último movimiento: {paymentLabel(lastPayment.status)}</small>}
        </td>
        <td><button type="button" className="button ghost small" onClick={() => setOpen((value) => !value)}>{open ? 'Cerrar' : 'Editar'}</button></td>
      </tr>
      {open && <tr className="invoiceEditorRow"><td colSpan={8}>
        <div className="invoiceEditorGrid">
          <form className="form invoiceEditForm" action={updateAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <input type="hidden" name="tenantId" value={invoice.tenant?.id ?? ''} />
            <h3>Modificar factura {invoice.code}</h3>
            <div className="fourCols">
              <label>Saldo facturado<input type="number" name="amount" min={0} step={1} defaultValue={invoice.amount} required /></label>
              <label>Estado del pago<select name="status" defaultValue={invoice.status}>{(['PENDING', 'OVERDUE', 'PAID', 'VOID'] as InvoiceStatus[]).map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></label>
              <label>Periodo<input type="date" name="period" defaultValue={dateInput(invoice.period)} required /></label>
              <label>Vencimiento<input type="date" name="dueDate" defaultValue={dateInput(invoice.dueDate)} required /></label>
            </div>
            <label>Observación administrativa<textarea name="note" rows={2} defaultValue={invoice.adminNotes ?? ''} placeholder="Motivo del ajuste o nota interna" /></label>
            <p className="muted">Pagos aprobados asociados: {pesos(invoice.approvedAmount ?? approvedTotal(invoice))}. El saldo visible se recalcula automáticamente.</p>
            {updateState.error && <p className="alert error">{updateState.error}</p>}
            {updateState.success && <p className="alert success">{updateState.success}</p>}
            <button className="button small" disabled={updating}>{updating ? 'Guardando…' : 'Guardar cambios'}</button>
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
            {deleteState.error && <p className="alert error">{deleteState.error}</p>}
            {deleteState.success && <p className="alert success">{deleteState.success}</p>}
            <button className="button danger small" disabled={deleting}>{deleting ? 'Eliminando…' : 'Eliminar factura'}</button>
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
