import type { Metadata } from 'next';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { pesos } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import { UiIcon, type IconName } from '@/components/UiIcon';
import type { ManualPaymentReport } from '@/lib/types';
import styles from '@/components/AdminWorkspace.module.css';

export const metadata: Metadata = { title: 'Administración' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireUser('ADMIN');
  const [metrics, manualPayments] = await Promise.all([
    apiFetch<{ availableProperties: number; pendingInvoices: number; newContacts: number; collectedAmount: number }>('/admin/dashboard', {}, true),
    apiFetch<ManualPaymentReport[]>('/payments/manual/pending', {}, true).catch(() => null),
  ]);
  const pendingPaymentCount = manualPayments?.length;
  let paymentSummary = 'No hay reportes pendientes de verificación.';
  if (pendingPaymentCount === undefined) paymentSummary = 'No pudimos consultar los reportes. Revisar en conciliación.';
  else if (pendingPaymentCount > 0) paymentSummary = 'Comprueba los soportes antes de confirmar cada pago.';
  const cards: Array<{ label: string; value: string | number; description: string; href: string; icon: IconName }> = [
    { label: 'Inmuebles disponibles', value: metrics.availableProperties, description: 'Publicados en el catálogo', href: '/admin/inmuebles?estado=PUBLISHED_AVAILABLE', icon: 'home' },
    { label: 'Facturas por cobrar', value: metrics.pendingInvoices, description: 'Pendientes y vencidas', href: '/admin/facturas?estado=OUTSTANDING', icon: 'document' },
    { label: 'Contactos nuevos', value: metrics.newContacts, description: 'Solicitudes por atender', href: '/admin/contactos?estado=NEW', icon: 'message' },
    { label: 'Facturas pagadas', value: pesos(metrics.collectedAmount), description: 'Valor histórico de facturas pagadas', href: '/admin/facturas?estado=PAID', icon: 'check' },
  ];
  const quickActions: Array<[string, string, IconName]> = [
    ['/admin/inmuebles?crear=1', 'Publicar inmueble', 'home'],
    ['/admin/usuarios?crear=1', 'Crear usuario', 'users'],
    ['/admin/facturas?crear=1', 'Crear factura', 'document'],
    ['/admin/noticias?crear=1', 'Publicar noticia', 'document'],
    ['/admin/archivos?crear=1', 'Subir archivos', 'folder'],
  ];
  return (
    <>
          <div className={styles.dashboardHeading}><div className="pageHeading compact"><span className="eyebrow">Tu operación, en un solo lugar</span><h1>Resumen operativo</h1><p>Consulta el estado de la inmobiliaria y continúa con lo que necesita atención.</p></div><Link className="button small" href="/admin/inmuebles?crear=1"><UiIcon name="home" />Publicar inmueble</Link></div>
          <div className="metricGrid">
            {cards.map((card) => <Link className={`metric ${styles.metricLink}`} href={card.href} key={card.label}><span className={styles.metricLabel}>{card.label}<UiIcon name={card.icon} /></span><strong>{card.value}</strong><small>{card.description} <span aria-hidden="true">↗</span></small></Link>)}
          </div>
          <div className={styles.dashboardGrid}>
            <section className={styles.panel} aria-labelledby="admin-priorities"><h2 id="admin-priorities">Necesita tu atención</h2><p className={styles.panelIntro}>Accede directamente a cada tarea pendiente.</p><ul className={styles.taskList}>
              <li><Link href="/admin/conciliacion#pagos-manuales"><span className={styles.taskCount}>{pendingPaymentCount ?? '—'}</span><span><strong>Verificar pagos reportados</strong><small>{paymentSummary}</small></span><span aria-hidden="true">→</span></Link></li>
              <li><Link href="/admin/facturas?estado=OUTSTANDING"><span className={styles.taskCount}>{metrics.pendingInvoices}</span><span><strong>Dar seguimiento a los cobros</strong><small>{metrics.pendingInvoices ? 'Consulta facturas pendientes y vencidas.' : 'No hay facturas pendientes ni vencidas.'}</small></span><span aria-hidden="true">→</span></Link></li>
              <li><Link href="/admin/contactos?estado=NEW"><span className={styles.taskCount}>{metrics.newContacts}</span><span><strong>Atender nuevos contactos</strong><small>{metrics.newContacts ? 'Consulta los mensajes y los datos para responder.' : 'No hay solicitudes nuevas por atender.'}</small></span><span aria-hidden="true">→</span></Link></li>
            </ul></section>
            <section className={styles.panel} aria-labelledby="admin-shortcuts"><h2 id="admin-shortcuts">Acciones rápidas</h2><p className={styles.panelIntro}>Crea y publica sin recorrer el menú.</p><ul className={styles.quickActions}>{quickActions.map(([href, label, icon]) => <li key={href}><Link href={href}><UiIcon name={icon} />{label}<span aria-hidden="true">+</span></Link></li>)}</ul></section>
          </div>
          <p className={styles.dataNote}>Cifras acumuladas del sistema; se consultan al abrir esta página. El valor de facturas pagadas no incluye abonos a facturas pendientes.</p>
        </>
  );
}
