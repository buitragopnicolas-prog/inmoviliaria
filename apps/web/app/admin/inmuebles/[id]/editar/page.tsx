import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPropertyEditForm } from '@/components/AdminPropertyEditForm';
import { apiFetch } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import type { Property, TenantOption } from '@/lib/types';

export const metadata: Metadata = { title: 'Editar inmueble' };
export const dynamic = 'force-dynamic';

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser('ADMIN');
  const { id } = await params;
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
            <Link className="textLink" href="/admin/inmuebles">← Volver a inmuebles</Link>
          </div>
          <AdminPropertyEditForm property={property} tenants={tenants} />
        </>
  );
}
