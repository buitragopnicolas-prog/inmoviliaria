import type { Metadata } from 'next';
import { AdminTableRegion } from '@/components/AdminTableRegion';
import { apiFetch } from '@/lib/api';
import { fecha, pesos } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import type { BankPaymentNotification, ImportBatch, ReceivingBankAccount } from '@/lib/types';
import type { ManualPaymentReport } from '@/lib/types';
import { ManualPaymentReviewForm } from '@/components/ManualPaymentReviewForm';
import { AdminEmptyState, AdminListControls, AdminPagination } from '@/components/AdminListControls';
import { adminMatches, adminStatusLabel, paginateAdmin, readAdminQuery, type AdminSearchParams } from '@/lib/admin-lists';
import styles from '@/components/AdminWorkspace.module.css';

export const metadata: Metadata = { title: 'Conciliación de pagos' };
export const dynamic = 'force-dynamic';

const importStatusClass: Record<string, string> = { COMPLETED: 'paid', FAILED: 'overdue' };
const notificationStatusClass: Record<string, string> = { MATCHED: 'paid', REJECTED: 'overdue', ERROR: 'overdue' };

export default async function ReconciliationPage({ searchParams }: { searchParams?: Promise<AdminSearchParams> }) {
  await requireUser('ADMIN');
  const query = readAdminQuery(await searchParams);
  const [notifications, accounts, imports, manualPayments] = await Promise.all([
    apiFetch<BankPaymentNotification[]>('/admin/reconciliation/notifications', {}, true),
    apiFetch<ReceivingBankAccount[]>('/admin/reconciliation/accounts', {}, true),
    apiFetch<ImportBatch[]>('/admin/reconciliation/imports', {}, true),
    apiFetch<ManualPaymentReport[]>('/payments/manual/pending', {}, true),
  ]);
  const result = paginateAdmin(notifications.filter((notification) => (!query.estado || notification.status === query.estado) && adminMatches(query.buscar, notification.payerName, notification.bankReference, notification.matchedInvoice?.code, notification.reviewReason, notification.accountLast4)), query.pagina);

  return (
    <>
      <div className="pageHeading compact"><span className="eyebrow">Control de pagos</span><h1>Conciliación de pagos</h1><p>Verifica reportes manuales y consulta las notificaciones bancarias, cuentas receptoras y cargas históricas.</p></div>
      <nav className={styles.detailLinks} aria-label="Secciones de conciliación"><a href="#pagos-manuales">Pagos por revisar · {manualPayments.length}</a><a href="#notificaciones">Notificaciones bancarias</a><a href="#cuentas">Cuentas receptoras</a><a href="#cargas">Cargas históricas</a></nav>

      <div className="card tableCard" id="pagos-manuales"><div className="tableTitle"><div><span className="eyebrow">Verificación humana</span><h2>Pagos manuales pendientes</h2></div><span>{manualPayments.length} por revisar</span></div>
        <div className="manualPaymentsGrid">
          {manualPayments.map((payment) => <article className="manualPaymentAdminCard" key={payment.id}>
            <div className="manualPaymentAdminHead"><div><span className={`status ${payment.status === 'UNDER_REVIEW' ? 'review' : 'pending'}`}>{payment.status === 'UNDER_REVIEW' ? 'EN REVISIÓN' : 'PENDIENTE'}</span><h3>{payment.user?.name ?? payment.tenant?.name ?? 'Usuario'}</h3><p>{payment.invoice.lease.property.title} · {payment.invoice.code}</p></div><strong>{pesos(payment.amount)}</strong></div>
            <dl className="paymentAuditData"><div><dt>Método</dt><dd>{manualMethod(payment.manualMethod)}</dd></div><div><dt>Referencia</dt><dd>{payment.bankReference}</dd></div><div><dt>Pago informado</dt><dd>{fecha(payment.paidAt)}</dd></div><div><dt>Reporte</dt><dd>{fecha(payment.reportedAt)}</dd></div></dl>
            {payment.receiptFile ? <a className="button outline small" href={`/documentos/pagos/${payment.receiptFile.id}`} target="_blank" rel="noreferrer">Ver comprobante</a> : <p className="muted">Sin comprobante adjunto.</p>}
            {payment.reviewNote && <p className="alert">Nota de revisión: {payment.reviewNote}</p>}
            <ManualPaymentReviewForm paymentId={payment.id} />
          </article>)}
          {manualPayments.length === 0 && <div className="empty">No hay reportes manuales pendientes.</div>}
        </div>
      </div>

      <div className="card tableCard" id="cuentas"><div className="tableTitle"><h2>Cuentas receptoras</h2><span>{accounts.length} configuradas</span></div>
        <AdminTableRegion label="Cuentas receptoras"><table><thead><tr><th scope="col">Banco</th><th scope="col">Cuenta</th><th scope="col">Contratos</th><th scope="col">Notificaciones</th><th scope="col">Estado</th></tr></thead><tbody>
          {accounts.map((account) => <tr key={account.id}><td>{account.bank}</td><td>****{account.accountLast4}</td><td>{account._count.leaseLinks}</td><td>{account._count.notifications}</td><td><span className={`status ${account.active ? 'paid' : 'void'}`}>{account.active ? 'ACTIVA' : 'INACTIVA'}</span></td></tr>)}
          {accounts.length === 0 && <tr><td colSpan={5}>No hay cuentas receptoras configuradas. Solicita su configuración al responsable del sistema.</td></tr>}
        </tbody></table></AdminTableRegion>
      </div>

      <div className="card tableCard" id="cargas"><div className="tableTitle"><h2>Cargas históricas</h2><span>{imports.length} lotes</span></div>
        <AdminTableRegion label="Cargas históricas"><table><thead><tr><th scope="col">Archivo</th><th scope="col">Inicio</th><th scope="col">Importados</th><th scope="col">Revisión</th><th scope="col">Estado</th></tr></thead><tbody>
          {imports.map((batch) => <tr key={batch.id}><td>{batch.sourceFile}</td><td>{fecha(batch.startedAt)}</td><td>{batch.importedRows}/{batch.totalRows}</td><td>{batch.reviewRows}</td><td><span className={`status ${importStatusClass[batch.status] ?? 'pending'}`}>{adminStatusLabel(batch.status)}</span></td></tr>)}
          {imports.length === 0 && <tr><td colSpan={5}>Todavía no se ha ejecutado el importador de arrendamientos.</td></tr>}
        </tbody></table></AdminTableRegion>
      </div>

      <div className="card tableCard" id="notificaciones"><div className="tableTitle"><h2>Notificaciones bancarias</h2><span>{notifications.length} registros recientes</span></div>
        <AdminListControls path="/admin/conciliacion" query={query} placeholder="Pagador, referencia, factura o cuenta" statuses={[[ 'RECEIVED', 'Recibida' ], ['MATCHED', 'Conciliada'], ['REVIEW_REQUIRED', 'Requiere revisión'], ['REJECTED', 'Rechazada'], ['DUPLICATE', 'Duplicada'], ['ERROR', 'Error']]} />
        {result.total > 0 ? <AdminTableRegion label="Notificaciones bancarias"><table><thead><tr><th scope="col">Fecha</th><th scope="col">Pagador</th><th scope="col">Valor</th><th scope="col">Cuenta</th><th scope="col">Factura</th><th scope="col">Estado</th><th scope="col">Motivo</th></tr></thead><tbody>
          {result.items.map((notification) => <tr key={notification.id}><td>{fecha(notification.receivedAt)}</td><td>{notification.payerName ?? 'Sin identificar'}</td><td>{notification.amount != null ? pesos(notification.amount) : '—'}</td><td>{notification.accountLast4 ? `****${notification.accountLast4}` : '—'}</td><td>{notification.matchedInvoice?.code ?? '—'}</td><td><span className={`status ${notificationStatusClass[notification.status] ?? 'pending'}`}>{adminStatusLabel(notification.status)}</span></td><td>{notification.reviewReason ?? notification.payment?.reference ?? 'Procesada'}</td></tr>)}
        </tbody></table></AdminTableRegion> : <AdminEmptyState filtered={Boolean(query.buscar || query.estado)} noun="notificaciones bancarias" />}
        <AdminPagination path="/admin/conciliacion" query={query} {...result} />
      </div>
    </>
  );
}

function manualMethod(method: string): string {
  if (method === 'QR') return 'Código QR';
  if (method === 'BREB') return 'Bre-B / llave';
  if (method === 'BANK_TRANSFER') return 'Transferencia bancaria';
  return 'Consignación';
}
