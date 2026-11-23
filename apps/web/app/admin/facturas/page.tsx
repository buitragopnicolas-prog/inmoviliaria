import type { Metadata } from 'next';
import { AdminInvoiceForm } from '@/components/AdminInvoiceForm';
import { AdminInvoiceManager } from '@/components/AdminInvoiceManager';
import { apiFetch } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import type { ChargeCatalogItem, Invoice, Lease } from '@/lib/types';
import { AdminCreatePanel } from '@/components/AdminCreatePanel';
import { AdminEmptyState, AdminListControls, AdminPagination } from '@/components/AdminListControls';
import { adminEditResults, adminListHref, adminMatches, readAdminQuery, type AdminSearchParams } from '@/lib/admin-lists';
import { AdminReturnFocus } from '@/components/AdminReturnFocus';

export const metadata: Metadata = { title: 'Administrar facturas' };
export const dynamic = 'force-dynamic';

export default async function AdminInvoicesPage({ searchParams }: Readonly<{ searchParams?: Promise<AdminSearchParams> }>) {
  await requireUser('ADMIN');
  const params = await searchParams;
  const query = readAdminQuery(params);
  const [invoices, leases, catalog, accounts] = await Promise.all([
    apiFetch<Invoice[]>('/admin/invoices', {}, true),
    apiFetch<Lease[]>('/admin/leases', {}, true),
    apiFetch<{ services: ChargeCatalogItem[]; products: ChargeCatalogItem[] }>('/admin/invoices/catalog', {}, true),
    apiFetch<import('@/lib/documents').DocumentAccount[]>('/admin/documents/accounts',{},true),
  ]);
  const filtered = invoices.filter((invoice) => (!query.estado || (query.estado === 'OUTSTANDING' ? ['PENDING', 'OVERDUE'].includes(invoice.status) : invoice.status === query.estado)) && adminMatches(query.buscar, invoice.code, invoice.user?.name, invoice.tenant?.name, invoice.lease?.property.title ?? invoice.lineItems?.[0]?.catalogItem.name));
  const result = adminEditResults(filtered, query, params?.fila);
  return (
    <>
      <div className="pageHeading compact"><span className="eyebrow">Administración</span><h1>Facturación</h1><p>Genera, modifica o elimina facturas y controla el saldo y el estado de pago de cada usuario.</p></div>
      <AdminCreatePanel title="Crear factura" description="Selecciona el contrato de arriendo o la cuenta y agrega los conceptos del cobro." open={params?.crear === '1'}><AdminInvoiceForm accounts={accounts.filter(a=>a.portal!=='TENANT')} leases={leases} services={catalog.services} products={catalog.products} /></AdminCreatePanel>
      <div className="card tableCard"><div className="tableTitle"><h2 id="resultados-edicion" tabIndex={-1}>Facturas emitidas</h2><span>{invoices.length} registros</span></div>
        <AdminReturnFocus target={result.focusId} listHref={adminListHref('/admin/facturas', query, result.page)} />
        <AdminListControls path="/admin/facturas" query={query} placeholder="Código, usuario o inmueble" statuses={[[ 'OUTSTANDING', 'Pendientes y vencidas' ], ['PENDING', 'Pendiente'], ['OVERDUE', 'Vencida'], ['PAID', 'Pagada'], ['VOID', 'Anulada']]} />
        {result.total > 0 ? <AdminInvoiceManager invoices={result.items} query={{ ...query, pagina: result.page }} /> : <AdminEmptyState filtered={Boolean(query.buscar || query.estado)} noun="facturas" />}
        <AdminPagination path="/admin/facturas" query={query} {...result} />
      </div>
    </>
  );
}
