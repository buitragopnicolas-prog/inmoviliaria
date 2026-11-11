import type { Metadata } from 'next';
import { AdminTableRegion } from '@/components/AdminTableRegion';
import Image from 'next/image';
import Link from 'next/link';
import { AdminPropertyForm } from '@/components/AdminPropertyForm';
import { AdminDeletePropertyButton } from '@/components/AdminDeletePropertyButton';
import { apiFetch } from '@/lib/api';
import { assetUrl, pesos } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import type { Property, TenantOption } from '@/lib/types';
import { AdminCreatePanel } from '@/components/AdminCreatePanel';
import { AdminEmptyState, AdminListControls, AdminPagination } from '@/components/AdminListControls';
import { adminMatches, adminStatusLabel, paginateAdmin, readAdminQuery, type AdminSearchParams } from '@/lib/admin-lists';

export const metadata: Metadata = { title: 'Administrar inmuebles' };
export const dynamic = 'force-dynamic';

export default async function AdminPropertiesPage({ searchParams }: Readonly<{ searchParams?: Promise<AdminSearchParams> }>) {
  await requireUser('ADMIN');
  const params = await searchParams;
  const query = readAdminQuery(params);
  const [properties, tenants] = await Promise.all([
    apiFetch<Property[]>('/admin/properties', {}, true),
    apiFetch<TenantOption[]>('/admin/tenants', {}, true),
  ]);
  const filtered = properties.filter((property) => (!query.estado || (query.estado === 'PUBLISHED_AVAILABLE' ? property.status === 'AVAILABLE' && property.published : property.status === query.estado)) && adminMatches(query.buscar, property.title, property.address, property.city, property.neighborhood, property.leases?.[0]?.tenant?.name, property.leases?.[0]?.user?.name));
  const result = paginateAdmin(filtered, query.pagina);

  return (
    <>
      <div className="pageHeading compact"><span className="eyebrow">Administración</span><h1>Inmuebles</h1><p>Agrega, edita, asigna y elimina inmuebles.</p></div>
      <AdminCreatePanel title="Publicar inmueble" description="Agrega los datos, fotografías y la asignación del inmueble." open={params?.crear === '1'}><AdminPropertyForm tenants={tenants} /></AdminCreatePanel>
      <div className="card tableCard"><div className="tableTitle"><h2>Publicaciones</h2><span>{properties.length} registros</span></div>
        <AdminListControls path="/admin/inmuebles" query={query} placeholder="Título, dirección, barrio o arrendatario" statuses={[[ 'AVAILABLE', 'Disponible' ], ['PUBLISHED_AVAILABLE', 'Disponibles y publicados'], ['RENTED', 'Arrendado'], ['ARCHIVED', 'Archivado']]} />
        {result.total > 0 ? <AdminTableRegion label="Publicaciones de inmuebles"><table><thead><tr><th scope="col">Inmueble</th><th scope="col">Ubicación</th><th scope="col">Canon</th><th scope="col">Asignado a</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>{result.items.map((property) => {
          const activeLease = property.leases?.[0];
          const assignedName = activeLease?.tenant?.name ?? activeLease?.user?.name;
          return <tr key={property.id}>
            <td className="propertyRow"><div className="thumb"><Image src={assetUrl(property.images[0]?.url)} alt={property.title} fill sizes="54px" /></div>{property.title}</td>
            <td>{property.neighborhood}, {property.city}</td>
            <td>{pesos(property.monthlyRent)}</td>
            <td>{assignedName ?? <span className="muted">Sin asignar</span>}</td>
            <td><span className={`status ${property.status.toLowerCase()}`}>{adminStatusLabel(property.status)}</span><small className="tableHint">{property.published ? 'Publicado' : 'Oculto'}</small></td>
            <td><div className="tableActions"><Link className="textButton" href={`/admin/inmuebles/${property.id}/editar`}>Editar</Link><AdminDeletePropertyButton id={property.id} title={property.title} /></div></td>
          </tr>;
        })}</tbody></table></AdminTableRegion> : <AdminEmptyState filtered={Boolean(query.buscar || query.estado)} noun="inmuebles" />}
        <AdminPagination path="/admin/inmuebles" query={query} {...result} />
      </div>
    </>
  );
}
