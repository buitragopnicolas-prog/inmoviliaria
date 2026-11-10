import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminUserForm } from '@/components/AdminUserForm';
import { apiFetch } from '@/lib/api';
import { pesos } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import type { AdminUserSummary, UserFinancialState } from '@/lib/types';
import { AdminCreatePanel } from '@/components/AdminCreatePanel';
import { AdminEmptyState, AdminListControls, AdminPagination } from '@/components/AdminListControls';
import { paginateAdmin, readAdminQuery, type AdminSearchParams } from '@/lib/admin-lists';

export const metadata: Metadata = { title: 'Administrar usuarios' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  await requireUser('ADMIN');
  const params = await searchParams;
  const listQuery = readAdminQuery(params);
  const { buscar } = listQuery;
  const query = buscar.trim() ? `?search=${encodeURIComponent(buscar.trim())}` : '';
  const users = await apiFetch<AdminUserSummary[]>(`/admin/users${query}`, {}, true);
  const result = paginateAdmin(users.filter((user) => !listQuery.estado || user.financial.state === listQuery.estado), listQuery.pagina);

  return (
    <>
          <div className="pageHeading compact">
            <span className="eyebrow">Administración</span>
            <h1>Usuarios</h1>
            <p>Consulta los perfiles de clientes, sus inmuebles, saldos y pagos. Los datos históricos y las cuentas creadas en la web se muestran en una sola vista.</p>
          </div>

          <AdminCreatePanel title="Crear usuario" description="Registra un cliente para gestionar inmuebles, cobros y pagos." open={params.crear === '1'}><AdminUserForm /></AdminCreatePanel>

          <div className="card tableCard">
            <div className="tableTitle"><h2>Directorio de usuarios</h2><span>{users.length} registros</span></div>
            <AdminListControls path="/admin/usuarios" query={listQuery} placeholder="Nombre, correo, documento o teléfono" statuses={[[ 'OVERDUE', 'Vencido' ], ['PENDING', 'Pendiente'], ['PAID', 'Al día'], ['NO_CHARGES', 'Sin cobros']]} />
            {result.total > 0 ? <div className="responsiveTable" role="region" aria-label="Directorio de usuarios" tabIndex={0}>
              <table>
                <thead><tr><th scope="col">Usuario</th><th scope="col">Contacto</th><th scope="col">Acceso web</th><th scope="col">Inmueble actual</th><th scope="col">Estado de pago</th><th scope="col">Saldo</th><th scope="col">Acciones</th></tr></thead>
                <tbody>
                  {result.items.map((user) => (
                    <tr key={user.id}>
                      <td><strong>{user.name}</strong><br /><span className="muted">{user.documentNumber || 'Sin documento'}</span></td>
                      <td>{user.email || 'Sin correo'}<br /><span className="muted">{user.phone || 'Sin teléfono'}</span></td>
                      <td>{user.webAccount ? <span className="status paid">Registrado</span> : <span className="status archived">Sin acceso</span>}</td>
                      <td>{user.activeLease?.property.title ?? <span className="muted">Sin inmueble</span>}</td>
                      <td><span className={`status ${financialClass(user.financial.state)}`}>{financialLabel(user.financial.state)}</span></td>
                      <td>{pesos(user.financial.outstandingAmount)}</td>
                      <td><Link className="textLink" href={`/admin/usuarios/${user.id}`}>Ver detalle →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div> : <AdminEmptyState filtered={Boolean(listQuery.buscar || listQuery.estado)} noun="usuarios" />}
            <AdminPagination path="/admin/usuarios" query={listQuery} {...result} />
          </div>
        </>
  );
}

function financialLabel(state: UserFinancialState): string {
  if (state === 'OVERDUE') return 'Vencido';
  if (state === 'PENDING') return 'Pendiente';
  if (state === 'PAID') return 'Al día';
  return 'Sin cobros';
}

function financialClass(state: UserFinancialState): string {
  if (state === 'OVERDUE') return 'overdue';
  if (state === 'PENDING') return 'pending';
  if (state === 'PAID') return 'paid';
  return 'archived';
}
