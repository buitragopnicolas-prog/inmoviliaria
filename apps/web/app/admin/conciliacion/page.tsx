import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { apiFetch } from '@/lib/api';
import { fecha, pesos } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import type { BankPaymentNotification, ImportBatch, ReceivingBankAccount } from '@/lib/types';
import type { ManualPaymentReport } from '@/lib/types';
import { ManualPaymentReviewForm } from '@/components/ManualPaymentReviewForm';

export const metadata: Metadata = { title: 'Conciliación de pagos' };
export const dynamic = 'force-dynamic';

export default async function ReconciliationPage() {
  await requireUser('ADMIN');
  const [notifications, accounts, imports, manualPayments] = await Promise.all([
    apiFetch<BankPaymentNotification[]>('/admin/reconciliation/notifications', {}, true),
    apiFetch<ReceivingBankAccount[]>('/admin/reconciliation/accounts', {}, true),
    apiFetch<ImportBatch[]>('/admin/reconciliation/imports', {}, true),
    apiFetch<ManualPaymentReport[]>('/payments/manual/pending', {}, true),
  ]);

  return (
    <section className="section pageTop"><div className="container adminLayout"><AdminNav /><div className="adminContent">
      <div className="pageHeading compact"><span className="eyebrow">Automatización n8n</span><h1>Conciliación Bancolombia</h1><p>Consulta cuentas receptoras, cargas históricas de datos y notificaciones procesadas.</p></div>

      <div className="card tableCard"><div className="tableTitle"><div><span className="eyebrow">Verificación humana</span><h2>Pagos manuales pendientes</h2></div><span>{manualPayments.length} por revisar</span></div>
        <div className="manualPaymentsGrid">
          {manualPayments.map((payment) => <article className="manualPaymentAdminCard" key={payment.id}>
            <div className="manualPaymentAdminHead"><div><span className={`status ${payment.status === 'UNDER_REVIEW' ? 'review' : 'pending'}`}>{payment.status === 'UNDER_REVIEW' ? 'EN REVISIÓN' : 'PENDIENTE'}</span><h3>{payment.user?.name ?? payment.tenant?.name ?? 'Usuario'}</h3><p>{payment.invoice.lease.property.title} · {payment.invoice.code}</p></div><strong>{pesos(payment.amount)}</strong></div>
            <dl className="paymentAuditData"><div><dt>Método</dt><dd>{manualMethod(payment.manualMethod)}</dd></div><div><dt>Referencia</dt><dd>{payment.bankReference}</dd></div><div><dt>Pago informado</dt><dd>{fecha(payment.paidAt)}</dd></div><div><dt>Reporte</dt><dd>{fecha(payment.reportedAt)}</dd></div></dl>
            {payment.receiptFile ? <a className="button outline small" href={`/documentos/pagos/${payment.receiptFile.id}`} target="_blank" rel="noreferrer">Ver comprobante</a> : <p className="muted">Sin comprobante adjunto.</p>}
            <ManualPaymentReviewForm paymentId={payment.id} />
          </article>)}
          {manualPayments.length === 0 && <div className="empty">No hay reportes manuales pendientes.</div>}
        </div>
      </div>

      <div className="card tableCard"><div className="tableTitle"><h2>Cuentas receptoras</h2><span>{accounts.length} configuradas</span></div>
        <div className="responsiveTable"><table><thead><tr><th>Banco</th><th>Cuenta</th><th>Contratos</th><th>Notificaciones</th><th>Estado</th></tr></thead><tbody>
          {accounts.map((account) => <tr key={account.id}><td>{account.bank}</td><td>****{account.accountLast4}</td><td>{account._count.leaseLinks}</td><td>{account._count.notifications}</td><td><span className={`status ${account.active ? 'paid' : 'void'}`}>{account.active ? 'ACTIVA' : 'INACTIVA'}</span></td></tr>)}
          {accounts.length === 0 && <tr><td colSpan={5}>No hay cuentas configuradas. Ejecute el importador con BANCOLOMBIA_ACCOUNT_LAST4.</td></tr>}
        </tbody></table></div>
      </div>

      <div className="card tableCard"><div className="tableTitle"><h2>Cargas históricas</h2><span>{imports.length} lotes</span></div>
        <div className="responsiveTable"><table><thead><tr><th>Archivo</th><th>Inicio</th><th>Importados</th><th>Revisión</th><th>Estado</th></tr></thead><tbody>
          {imports.map((batch) => <tr key={batch.id}><td>{batch.sourceFile}</td><td>{fecha(batch.startedAt)}</td><td>{batch.importedRows}/{batch.totalRows}</td><td>{batch.reviewRows}</td><td><span className={`status ${batch.status === 'COMPLETED' ? 'paid' : batch.status === 'FAILED' ? 'overdue' : 'pending'}`}>{batch.status}</span></td></tr>)}
          {imports.length === 0 && <tr><td colSpan={5}>Todavía no se ha ejecutado el importador de arrendamientos.</td></tr>}
        </tbody></table></div>
      </div>

      <div className="card tableCard"><div className="tableTitle"><h2>Notificaciones bancarias</h2><span>{notifications.length} registros recientes</span></div>
        <div className="responsiveTable"><table><thead><tr><th>Fecha</th><th>Pagador</th><th>Valor</th><th>Cuenta</th><th>Factura</th><th>Estado</th><th>Motivo</th></tr></thead><tbody>
          {notifications.map((notification) => <tr key={notification.id}><td>{fecha(notification.receivedAt)}</td><td>{notification.payerName ?? 'Sin identificar'}</td><td>{notification.amount ? pesos(notification.amount) : '—'}</td><td>{notification.accountLast4 ? `****${notification.accountLast4}` : '—'}</td><td>{notification.matchedInvoice?.code ?? '—'}</td><td><span className={`status ${notification.status === 'MATCHED' ? 'paid' : notification.status === 'REJECTED' || notification.status === 'ERROR' ? 'overdue' : 'pending'}`}>{notification.status}</span></td><td>{notification.reviewReason ?? notification.payment?.reference ?? 'Procesada'}</td></tr>)}
          {notifications.length === 0 && <tr><td colSpan={7}>No se han recibido notificaciones bancarias.</td></tr>}
        </tbody></table></div>
      </div>
    </div></div></section>
  );
}

function manualMethod(method: string): string {
  if (method === 'QR') return 'Código QR';
  if (method === 'BREB') return 'Bre-B / llave';
  if (method === 'BANK_TRANSFER') return 'Transferencia bancaria';
  return 'Consignación';
}
