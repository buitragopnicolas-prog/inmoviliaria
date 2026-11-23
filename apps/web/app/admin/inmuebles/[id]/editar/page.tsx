import type { Metadata } from 'next';
import { adminReturnHref, readAdminQuery, type AdminSearchParams } from '@/lib/admin-lists';
import { AdminPropertyEditForm } from '@/components/AdminPropertyEditForm';
import { apiFetch } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import type { Property, TenantOption } from '@/lib/types';

export const metadata: Metadata = { title: 'Editar inmueble' };
export const dynamic = 'force-dynamic';

export default async function EditPropertyPage({ params, searchParams }: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<AdminSearchParams> }>) {
  await requireUser('ADMIN');
  const { id } = await params;
  const query = readAdminQuery(await searchParams);
  const [property, tenants] = await Promise.all([
    apiFetch<Property>(`/admin/properties/${id}`, {}, true),
    apiFetch<TenantOption[]>('/admin/tenants', {}, true),
  ]);

  return (
    <>
          <div className="pageHeading compact">
            <span className="eyebrow">Administración</span>
            <h1>Editar inmueble</h1>
            <p>Actualiza los datos, imágenes y arrendatario asignado.</p>
            <a className="textLink" href={adminReturnHref('/admin/inmuebles', query, id)}>← Volver a inmuebles</a>
          </div>
          <AdminPropertyEditForm property={property} tenants={tenants} query={query} />
        </>
  );
}
